import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Auth callback route.
 *
 * Supabase sends users here after:
 *  - Clicking the email confirmation link
 *  - Completing Google OAuth
 *
 * After exchanging the code we check is_onboarded so every user
 * lands in the right place regardless of how they signed in.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // `next` is the fallback destination for already-onboarded users
  const next = searchParams.get('next') ?? '/lobby'

  if (code) {
    const supabase = await createClient()
    const { data: exchangeData, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Use the user returned directly by exchangeCodeForSession.
      // We cannot call getUser() here because exchangeCodeForSession writes
      // the session to the *response* cookies, but getUser() reads from the
      // *request* cookies — the new session isn't there yet in the same
      // request, so getUser() returns null and the onboarding check is skipped.
      const user = exchangeData?.user

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_onboarded')
          .eq('id', user.id)
          .maybeSingle()

        // No profile yet (Google user) or not onboarded → show onboarding
        if (!profile?.is_onboarded) {
          return NextResponse.redirect(`${origin}/onboarding`)
        }
      }

      // Already onboarded → go to intended destination
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
