import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * Notable route guard.
 *
 * Runs before every request and handles two things:
 *
 *  1. Session refresh — Supabase auth tokens expire. This middleware
 *     transparently refreshes the session cookie on every request
 *     so users never get unexpectedly logged out.
 *
 *  2. Route protection — if a visitor tries to access a protected
 *     route (/lobby, /profile, etc.) without being logged in,
 *     they get redirected to /login.
 *
 * Public routes (no login required): /, /login, /signup, /auth/*,
 *   /about, /privacy, /terms, /contact
 *
 * Fine-grained routing (done at the page level, not here):
 *   No handle, not onboarded  → /lobby  (welcome overlay shows handle step)
 *   Has handle, not onboarded → /lobby  (welcome overlay shows welcome message)
 *   Has handle, onboarded     → /lobby  (normal)
 */

const PUBLIC_ROUTES = ['/', '/login', '/signup', '/about', '/privacy', '/terms', '/contact']
const PUBLIC_PREFIXES = ['/auth/', '/rec/', '/forgot-password', '/reset-password']

export async function middleware(request: NextRequest) {
  // We need to forward cookies in both directions.
  // Start with a "pass through" response that we'll mutate.
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Forward the refreshed cookies to the request…
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          // …and to the browser via the response.
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Do not add any logic between createServerClient and getUser()
  // that could interfere with the cookie exchange.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Signed-in users shouldn't linger on the marketing/auth entry pages.
  // /reset-password is intentionally excluded so recovery sessions can reach it.
  if (user && (pathname === '/' || pathname === '/login' || pathname === '/signup')) {
    const lobbyUrl = new URL('/lobby', request.url)
    return NextResponse.redirect(lobbyUrl)
  }

  // Check if this is a public route
  const isPublic =
    PUBLIC_ROUTES.includes(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))

  // Redirect unauthenticated visitors away from protected routes
  if (!user && !isPublic) {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  // Return the response with any refreshed session cookies baked in
  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Run on all routes except:
     * - _next/static  (Next.js build assets)
     * - _next/image   (image optimization)
     * - favicon.ico and common static image types
     */
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
