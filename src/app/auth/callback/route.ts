import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Auth callback route.
 *
 * Supabase sends users here after:
 *  - Clicking the email confirmation link
 *  - Completing Google OAuth
 *
 * Cookie-setting approach: we create an inline createServerClient that writes
 * session cookies directly onto the response object (not via next/headers).
 * We then flush the microtask queue with a setTimeout so the async
 * onAuthStateChange → applyServerStorage → setAll chain completes before we
 * return the redirect. This guarantees session cookies are in the response
 * regardless of which redirect branch is taken.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const rawNext = searchParams.get('next') ?? '/lobby'
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/lobby'

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
  }

  type PendingCookie = Parameters<NextResponse['cookies']['set']>
  const pendingCookies: PendingCookie[] = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            pendingCookies.push([name, value, options])
          })
        },
      },
    }
  )

  const { data: exchangeData, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
  }

  // Flush the microtask queue so the async onAuthStateChange → applyServerStorage
  // → setAll chain finishes before we build the response. Without this, cookies
  // set inside the async handler would be collected AFTER the redirect is returned.
  await new Promise<void>(r => setTimeout(r, 0))

  function withCookies(res: NextResponse): NextResponse {
    pendingCookies.forEach(args => res.cookies.set(...args))
    return res
  }

  // Password recovery flow — skip onboarding check
  if (next === '/reset-password') {
    return withCookies(NextResponse.redirect(`${origin}/reset-password`))
  }

  // Use the user returned directly by exchangeCodeForSession so we don't need
  // a second round-trip (getUser() reads request cookies which don't have the
  // new session yet in this same request).
  const user = exchangeData?.user
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_onboarded')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile?.is_onboarded) {
      return withCookies(NextResponse.redirect(`${origin}/lobby`))
    }
  }

  return withCookies(NextResponse.redirect(`${origin}${next}`))
}
