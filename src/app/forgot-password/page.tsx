'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]       = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const supabaseRef           = useRef(createClient())

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabaseRef.current.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    })

    setLoading(false)

    if (error) {
      setError('Something went wrong. Please try again in a moment.')
      return
    }

    // Always show success — don't reveal whether the email exists
    setSent(true)
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
            Reset your password
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-8"
          style={{ background: 'var(--color-surface)', border: '1px solid rgba(0,0,0,0.08)' }}
        >
          {sent ? (
            /* ── Success state ──────────────────────────────────────── */
            <div>
              <div
                className="rounded-xl px-4 py-4 mb-6 font-body"
                style={{
                  background: 'rgba(74,173,78,0.1)',
                  border: '1px solid rgba(74,173,78,0.22)',
                  color: '#3a8f3e',
                  fontSize: '0.9rem',
                  lineHeight: '1.55',
                }}
              >
                Check your email — we sent you a reset link. It may take a minute to arrive.
              </div>
              <p className="font-body text-center" style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}>
                Didn&apos;t get it?{' '}
                <button
                  onClick={() => { setSent(false); setEmail('') }}
                  className="font-body"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-books)', padding: 0, fontSize: '0.875rem' }}
                >
                  Try again
                </button>
              </p>
            </div>
          ) : (
            /* ── Form state ─────────────────────────────────────────── */
            <>
              <p
                className="font-body mb-6"
                style={{ color: 'var(--color-muted)', fontSize: '0.9rem', lineHeight: '1.6' }}
              >
                Enter your email and we&apos;ll send you a link to reset your password.
              </p>

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
                    onChange={e => setEmail(e.target.value)}
                    placeholder="alex@example.com"
                    required
                    className="font-body rounded-xl px-4 py-3 outline-none transition-all duration-200"
                    style={{
                      background: 'var(--color-surface-2)',
                      border: '1px solid rgba(0,0,0,0.1)',
                      color: 'var(--color-text)',
                      fontSize: '0.95rem',
                    }}
                    onFocus={e => {
                      e.target.style.border = '1px solid rgba(82,113,255,0.5)'
                      e.target.style.boxShadow = '0 0 0 3px rgba(82,113,255,0.08)'
                    }}
                    onBlur={e => {
                      e.target.style.border = '1px solid rgba(0,0,0,0.1)'
                      e.target.style.boxShadow = 'none'
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="font-body font-semibold py-3.5 px-4 rounded-xl mt-2 transition-all duration-200"
                  style={{
                    background: loading ? 'rgba(82,113,255,0.5)' : '#5271FF',
                    color: 'var(--color-background)',
                    fontSize: '0.95rem',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    boxShadow: loading ? 'none' : '0 0 24px rgba(82,113,255,0.3)',
                  }}
                >
                  {loading ? 'Sending…' : 'Send reset link'}
                </button>
              </form>
            </>
          )}

          {/* Back to login */}
          <p
            className="font-body text-center mt-6"
            style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}
          >
            <Link
              href="/login"
              className="transition-colors duration-200"
              style={{ color: 'var(--color-muted)', textDecoration: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
              onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
            >
              ← Back to login
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
