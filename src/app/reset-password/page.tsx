'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { friendlyError } from '@/lib/friendlyError'

type Status = 'loading' | 'ready' | 'invalid' | 'success'

export default function ResetPasswordPage() {
  const [status, setStatus]   = useState<Status>('loading')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const supabaseRef             = useRef(createClient())
  const router                  = useRouter()

  useEffect(() => {
    const supabase = supabaseRef.current

    // PKCE flow: Supabase redirects here with ?code=XXX after verifying the
    // recovery token server-side. Exchange it to establish a session.
    const params = new URLSearchParams(window.location.search)
    const code   = params.get('code')

    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) {
          setStatus('invalid')
        } else {
          setStatus('ready')
          // Remove the code from the URL so a refresh doesn't re-exchange
          window.history.replaceState({}, '', '/reset-password')
        }
      })
      return
    }

    // Implicit flow fallback: the client SDK detects tokens in the URL hash
    // and fires PASSWORD_RECOVERY via onAuthStateChange.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setStatus('ready')
      }
    })

    // If neither a code nor a recovery event appears within 1.5 s, check
    // whether there is already a valid session (e.g. arrived from a prior
    // exchange) or declare the link invalid.
    const fallback = setTimeout(() => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setStatus(session ? 'ready' : 'invalid')
      })
    }, 1500)

    return () => {
      subscription.unsubscribe()
      clearTimeout(fallback)
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError("Passwords don't match — please check and try again.")
      return
    }

    setSaving(true)
    const { error } = await supabaseRef.current.auth.updateUser({ password })
    setSaving(false)

    if (error) {
      setError(friendlyError(error))
      return
    }

    setStatus('success')
    setTimeout(() => router.push('/login'), 2000)
  }

  const inputStyle: React.CSSProperties = {
    background: 'var(--color-surface-2)',
    border: '1px solid rgba(0,0,0,0.1)',
    color: 'var(--color-text)',
    fontSize: '0.95rem',
  }

  function onFocus(e: React.FocusEvent<HTMLInputElement>) {
    e.target.style.border = '1px solid rgba(82,113,255,0.5)'
    e.target.style.boxShadow = '0 0 0 3px rgba(82,113,255,0.08)'
  }
  function onBlur(e: React.FocusEvent<HTMLInputElement>) {
    e.target.style.border = '1px solid rgba(0,0,0,0.1)'
    e.target.style.boxShadow = 'none'
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 py-16"
      style={{ background: 'var(--color-background)' }}
    >
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-10">
          <Link
            href="/"
            className="text-text inline-block"
            style={{ fontSize: '1.6rem', letterSpacing: '-0.02em', fontFamily: 'var(--font-climate-crisis)', textTransform: 'uppercase' }}
          >
            Notable
          </Link>
          <p className="font-body text-muted mt-2" style={{ fontSize: '0.9rem' }}>
            Choose a new password
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-8"
          style={{ background: 'var(--color-surface)', border: '1px solid rgba(0,0,0,0.08)' }}
        >

          {/* ── Loading ──────────────────────────────────────────────── */}
          {status === 'loading' && (
            <div className="flex flex-col items-center gap-4 py-4">
              <svg
                viewBox="0 0 24 24" fill="none" stroke="var(--color-muted)"
                strokeWidth="2" width="28" height="28"
                style={{ animation: 'spin 0.9s linear infinite' }}
              >
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
              <p className="font-body" style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>
                Verifying your reset link…
              </p>
              <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            </div>
          )}

          {/* ── Invalid link ─────────────────────────────────────────── */}
          {status === 'invalid' && (
            <div className="flex flex-col items-center gap-4 py-2 text-center">
              <div
                className="rounded-xl px-4 py-4 w-full font-body"
                style={{
                  background: 'rgba(212,99,107,0.1)',
                  border: '1px solid rgba(212,99,107,0.22)',
                  color: '#e05555',
                  fontSize: '0.9rem',
                  lineHeight: '1.55',
                }}
              >
                This reset link is invalid or has expired.
              </div>
              <Link
                href="/forgot-password"
                className="font-body font-semibold py-3 px-6 rounded-xl transition-all duration-200 mt-2"
                style={{
                  display: 'inline-block',
                  background: '#5271FF',
                  color: 'var(--color-background)',
                  fontSize: '0.95rem',
                  textDecoration: 'none',
                  boxShadow: '0 0 24px rgba(82,113,255,0.3)',
                }}
              >
                Request a new link
              </Link>
            </div>
          )}

          {/* ── Password form ─────────────────────────────────────────── */}
          {status === 'ready' && (
            <>
              {error && (
                <div
                  className="rounded-xl px-4 py-3 mb-5 font-body"
                  style={{
                    background: 'rgba(212,99,107,0.12)',
                    border: '1px solid rgba(212,99,107,0.25)',
                    color: '#e05555',
                    fontSize: '0.875rem',
                  }}
                >
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="password"
                    className="font-body text-muted"
                    style={{ fontSize: '0.8rem', letterSpacing: '0.05em' }}
                  >
                    NEW PASSWORD
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    required
                    minLength={8}
                    className="font-body rounded-xl px-4 py-3 outline-none transition-all duration-200"
                    style={inputStyle}
                    onFocus={onFocus}
                    onBlur={onBlur}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="confirm"
                    className="font-body text-muted"
                    style={{ fontSize: '0.8rem', letterSpacing: '0.05em' }}
                  >
                    CONFIRM PASSWORD
                  </label>
                  <input
                    id="confirm"
                    type="password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="Same password again"
                    required
                    className="font-body rounded-xl px-4 py-3 outline-none transition-all duration-200"
                    style={inputStyle}
                    onFocus={onFocus}
                    onBlur={onBlur}
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="font-body font-semibold py-3.5 px-4 rounded-xl mt-2 transition-all duration-200"
                  style={{
                    background: saving ? 'rgba(82,113,255,0.5)' : '#5271FF',
                    color: 'var(--color-background)',
                    fontSize: '0.95rem',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    boxShadow: saving ? 'none' : '0 0 24px rgba(82,113,255,0.3)',
                  }}
                >
                  {saving ? 'Updating…' : 'Update password'}
                </button>
              </form>
            </>
          )}

          {/* ── Success ───────────────────────────────────────────────── */}
          {status === 'success' && (
            <div className="flex flex-col items-center gap-3 py-2 text-center">
              <div
                className="rounded-xl px-4 py-4 w-full font-body"
                style={{
                  background: 'rgba(74,173,78,0.1)',
                  border: '1px solid rgba(74,173,78,0.22)',
                  color: '#3a8f3e',
                  fontSize: '0.9rem',
                  lineHeight: '1.55',
                }}
              >
                Password updated! Redirecting you to login…
              </div>
            </div>
          )}

          {/* Back to login — shown on ready and invalid states */}
          {(status === 'ready' || status === 'invalid') && (
            <p
              className="font-body text-center mt-6"
              style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}
            >
              <Link
                href="/login"
                style={{ color: 'var(--color-muted)', textDecoration: 'none' }}
                onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
              >
                ← Back to login
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
