'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type View = 'signup' | 'login'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}

const inputBaseStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: '8px',
  border: '1px solid rgba(0,0,0,0.12)',
  background: '#faf8f4',
  fontSize: '0.9rem',
  color: 'var(--color-text)',
  outline: 'none',
  boxSizing: 'border-box',
}

function inputFocus(e: React.FocusEvent<HTMLInputElement>) {
  e.target.style.borderColor = 'rgba(82,113,255,0.5)'
  e.target.style.boxShadow = '0 0 0 3px rgba(82,113,255,0.08)'
}
function inputBlur(e: React.FocusEvent<HTMLInputElement>) {
  e.target.style.borderColor = 'rgba(0,0,0,0.12)'
  e.target.style.boxShadow = 'none'
}

export default function AuthCard() {
  const [view, setView] = useState<View>('signup')
  const [fadeOpacity, setFadeOpacity] = useState(1)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [emailSent, setEmailSent] = useState(false)

  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const router = useRouter()

  const isSignup = view === 'signup'
  const busy = loading || googleLoading

  function switchView(v: View) {
    setFadeOpacity(0)
    setTimeout(() => {
      setView(v)
      setError(null)
      setEmailSent(false)
      setName('')
      setEmail('')
      setPassword('')
      setFadeOpacity(1)
    }, 160)
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    if (!authData.user) {
      setError('Something went wrong. Please try again.')
      setLoading(false)
      return
    }

    if (authData.session) {
      await supabase.auth.setSession({
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
      })
      router.push('/onboarding')
    } else {
      // Email confirmation is required — tell user to check their inbox
      setEmailSent(true)
      setLoading(false)
    }
  }

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

    router.push('/lobby')
    router.refresh()
  }

  async function handleGoogleAuth() {
    setGoogleLoading(true)
    setError(null)

    const nextPath = isSignup ? '/onboarding' : '/lobby'
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${nextPath}`,
      },
    })

    if (error) {
      setError(error.message)
      setGoogleLoading(false)
    }
  }

  return (
    <div
      style={{
        background: 'rgba(245,240,232,0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRadius: '20px',
        border: '1px solid rgba(0,0,0,0.08)',
        boxShadow: '0 20px 60px rgba(58,42,26,0.16), inset 0 0 0 1px rgba(255,255,255,0.55)',
        padding: '28px 26px',
        opacity: fadeOpacity,
        transition: 'opacity 0.15s ease',
      }}
    >
      {emailSent ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <p
            className="font-body"
            style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text)', marginBottom: '10px' }}
          >
            Check your email
          </p>
          <p
            className="font-body"
            style={{ fontSize: '0.83rem', color: 'var(--color-muted)', lineHeight: 1.6 }}
          >
            We sent a confirmation link to <strong>{email}</strong>. Click it to finish creating your account.
          </p>
        </div>
      ) : (
        <>
          {/* Google button */}
          <button
            type="button"
            onClick={handleGoogleAuth}
            disabled={busy}
            className="font-body"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '10px 16px',
              borderRadius: '10px',
              border: '1px solid rgba(0,0,0,0.1)',
              background: 'rgba(255,255,255,0.75)',
              color: 'var(--color-text)',
              fontSize: '0.9rem',
              fontWeight: 500,
              cursor: busy ? 'not-allowed' : 'pointer',
              opacity: busy ? 0.6 : 1,
              marginBottom: '14px',
            }}
          >
            <GoogleIcon />
            {googleLoading ? 'Redirecting…' : 'Continue with Google'}
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <div style={{ flex: 1, height: '1px', background: 'rgba(0,0,0,0.1)' }} />
            <span className="font-body" style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>or</span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(0,0,0,0.1)' }} />
          </div>

          {/* Inline error */}
          {error && (
            <div
              className="font-body"
              style={{
                background: 'rgba(212,99,107,0.12)',
                border: '1px solid rgba(212,99,107,0.25)',
                color: '#d4636b',
                borderRadius: '8px',
                padding: '9px 12px',
                fontSize: '0.8rem',
                marginBottom: '12px',
                lineHeight: 1.45,
              }}
            >
              {error}
            </div>
          )}

          {/* Form */}
          <form
            onSubmit={isSignup ? handleSignup : handleLogin}
            style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}
          >
            {isSignup && (
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Name"
                required
                autoComplete="name"
                className="font-body"
                style={inputBaseStyle}
                onFocus={inputFocus}
                onBlur={inputBlur}
              />
            )}
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email"
              required
              autoComplete="email"
              className="font-body"
              style={inputBaseStyle}
              onFocus={inputFocus}
              onBlur={inputBlur}
            />
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              required
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              minLength={isSignup ? 8 : undefined}
              className="font-body"
              style={inputBaseStyle}
              onFocus={inputFocus}
              onBlur={inputBlur}
            />
            <button
              type="submit"
              disabled={busy}
              className="font-body"
              style={{
                width: '100%',
                padding: '11px 24px',
                borderRadius: '10px',
                background: busy ? 'rgba(82,113,255,0.55)' : '#5271FF',
                color: '#fff',
                fontWeight: 600,
                fontSize: '0.9rem',
                border: 'none',
                cursor: busy ? 'not-allowed' : 'pointer',
                marginTop: '2px',
                boxShadow: busy ? 'none' : '0 0 18px rgba(82,113,255,0.25)',
              }}
            >
              {loading
                ? (isSignup ? 'Creating account…' : 'Signing in…')
                : (isSignup ? 'Join Notable' : 'Sign In')}
            </button>
          </form>

          {/* Switch view / footer links */}
          {isSignup ? (
            <p
              className="font-body"
              style={{ fontSize: '0.78rem', color: 'var(--color-muted)', textAlign: 'center', marginTop: '14px' }}
            >
              Already a member?{' '}
              <button
                type="button"
                onClick={() => switchView('login')}
                className="font-body"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-books)',
                  fontWeight: 500,
                  cursor: 'pointer',
                  padding: 0,
                  fontSize: 'inherit',
                }}
              >
                Sign in
              </button>
            </p>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '14px' }}>
              <a
                href="/forgot-password"
                className="font-body"
                style={{ fontSize: '0.78rem', color: 'var(--color-muted)', textDecoration: 'none' }}
                onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.textDecoration = 'underline')}
                onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.textDecoration = 'none')}
              >
                Forgot your password?
              </a>
              <p className="font-body" style={{ fontSize: '0.78rem', color: 'var(--color-muted)', margin: 0 }}>
                New here?{' '}
                <button
                  type="button"
                  onClick={() => switchView('signup')}
                  className="font-body"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-books)',
                    fontWeight: 500,
                    cursor: 'pointer',
                    padding: 0,
                    fontSize: 'inherit',
                  }}
                >
                  Join Notable
                </button>
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
