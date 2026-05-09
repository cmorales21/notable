'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // Session is set — send them to the lobby
    router.push('/lobby')
    router.refresh() // force server components to re-render with new session
  }

  async function handleGoogleLogin() {
    setGoogleLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // After Google, user returns to /auth/callback which redirects to /lobby
        redirectTo: `${window.location.origin}/auth/callback?next=/lobby`,
      },
    })

    if (error) {
      setError(error.message)
      setGoogleLoading(false)
    }
    // On success, browser is redirected to Google — no further code runs here
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 py-16"
      style={{
        background: 'var(--color-background)',
        backgroundImage: 'none',
      }}
    >
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <Link
            href="/"
            className="text-text inline-block"
            style={{ fontSize: '1.6rem', letterSpacing: '-0.02em', fontFamily: 'var(--font-climate-crisis)' }}
          >
            Notable
          </Link>
          <p className="font-body text-muted mt-2" style={{ fontSize: '0.9rem' }}>
            Welcome back
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-8"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid rgba(0,0,0,0.08)',
          }}
        >
          {/* Google button */}
          <button
            onClick={handleGoogleLogin}
            disabled={googleLoading || loading}
            className="w-full flex items-center justify-center gap-3 font-body font-medium py-3 px-4 rounded-xl mb-6 transition-all duration-200"
            style={{
              background: 'var(--color-surface-2)',
              border: '1px solid rgba(0,0,0,0.08)',
              color: 'var(--color-text)',
              fontSize: '0.95rem',
              opacity: googleLoading || loading ? 0.6 : 1,
            }}
          >
            {/* Google SVG icon */}
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {googleLoading ? 'Redirecting…' : 'Continue with Google'}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px" style={{ background: 'rgba(0,0,0,0.08)' }} />
            <span className="font-body text-muted" style={{ fontSize: '0.8rem' }}>or</span>
            <div className="flex-1 h-px" style={{ background: 'rgba(0,0,0,0.08)' }} />
          </div>

          {/* Error message */}
          {error && (
            <div
              className="rounded-xl px-4 py-3 mb-5 font-body"
              style={{
                background: 'rgba(212,99,107,0.12)',
                border: '1px solid rgba(212,99,107,0.25)',
                color: '#d4636b',
                fontSize: '0.875rem',
              }}
            >
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="email"
                className="font-body text-muted"
                style={{ fontSize: '0.8rem', letterSpacing: '0.05em' }}
              >
                EMAIL
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alex@example.com"
                required
                className="font-body rounded-xl px-4 py-3 outline-none transition-all duration-200"
                style={{
                  background: 'var(--color-surface-2)',
                  border: '1px solid rgba(0,0,0,0.1)',
                  color: 'var(--color-text)',
                  fontSize: '0.95rem',
                }}
                onFocus={(e) => {
                  e.target.style.border = '1px solid rgba(82,113,255,0.5)'
                  e.target.style.boxShadow = '0 0 0 3px rgba(82,113,255,0.08)'
                }}
                onBlur={(e) => {
                  e.target.style.border = '1px solid rgba(0,0,0,0.1)'
                  e.target.style.boxShadow = 'none'
                }}
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="password"
                className="font-body text-muted"
                style={{ fontSize: '0.8rem', letterSpacing: '0.05em' }}
              >
                PASSWORD
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                required
                className="font-body rounded-xl px-4 py-3 outline-none transition-all duration-200"
                style={{
                  background: 'var(--color-surface-2)',
                  border: '1px solid rgba(0,0,0,0.1)',
                  color: 'var(--color-text)',
                  fontSize: '0.95rem',
                }}
                onFocus={(e) => {
                  e.target.style.border = '1px solid rgba(82,113,255,0.5)'
                  e.target.style.boxShadow = '0 0 0 3px rgba(82,113,255,0.08)'
                }}
                onBlur={(e) => {
                  e.target.style.border = '1px solid rgba(0,0,0,0.1)'
                  e.target.style.boxShadow = 'none'
                }}
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || googleLoading}
              className="font-body font-semibold py-3.5 px-4 rounded-xl mt-2 transition-all duration-200"
              style={{
                background: loading || googleLoading ? 'rgba(82,113,255,0.5)' : '#5271FF',
                color: 'var(--color-background)',
                fontSize: '0.95rem',
                cursor: loading || googleLoading ? 'not-allowed' : 'pointer',
                boxShadow: loading || googleLoading ? 'none' : '0 0 24px rgba(82,113,255,0.3)',
              }}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          {/* Sign up link */}
          <p
            className="font-body text-center mt-6"
            style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}
          >
            New to Notable?{' '}
            <Link
              href="/signup"
              className="transition-colors duration-200"
              style={{ color: 'var(--color-books)' }}
            >
              Join free
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
