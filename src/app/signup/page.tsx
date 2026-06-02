'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const [name, setName] = useState('')
  const [handle, setHandle] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const router = useRouter()

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const cleanHandle = handle.replace(/^@/, '')

    // 1. Create the auth user.
    //    Store name + handle in user_metadata so onboarding can recover
    //    the profile server-side if the client-side insert below ever races.
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          handle: cleanHandle || undefined,
        },
      },
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

    // 2. With email confirmation disabled, signUp returns a live session.
    //    Explicitly set it before any DB call — this guarantees the auth
    //    token is active and the next insert passes the RLS check.
    if (authData.session) {
      await supabase.auth.setSession({
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
      })
    }

    // 3. Insert the profile. Only attempted when we have a non-empty handle
    //    so we never write handle:'' to the database.
    if (cleanHandle) {
      const { error: insertError } = await supabase.from('profiles').insert({
        id: authData.user.id,
        name,
        handle: cleanHandle,
        email,
      })

      if (insertError) {
        if (insertError.code === '23505') {
          // A Supabase trigger already created the profile row — patch it.
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ name, handle: cleanHandle })
            .eq('id', authData.user.id)
          if (updateError) {
            setError(updateError.message)
            setLoading(false)
            return
          }
        } else {
          setError(insertError.message)
          setLoading(false)
          return
        }
      }
    }

    router.push('/lobby')
  }

  async function handleGoogleSignup() {
    setGoogleLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/lobby`,
      },
    })

    if (error) {
      setError(error.message)
      setGoogleLoading(false)
    }
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
            style={{ fontSize: '1.6rem', letterSpacing: '-0.02em', fontFamily: 'var(--font-climate-crisis)', textTransform: 'uppercase' }}
          >
            Notable
          </Link>
          <p className="font-body text-muted mt-2" style={{ fontSize: '0.9rem' }}>
            Create your account — it&apos;s free
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
            onClick={handleGoogleSignup}
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
                color: '#e05555',
                fontSize: '0.875rem',
              }}
            >
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSignup} className="flex flex-col gap-4">
            {/* Name */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="name"
                className="font-body text-muted"
                style={{ fontSize: '0.8rem', letterSpacing: '0.05em' }}
              >
                FULL NAME
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex Chen"
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

            {/* Handle */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="handle"
                className="font-body text-muted"
                style={{ fontSize: '0.8rem', letterSpacing: '0.05em' }}
              >
                YOUR HANDLE
              </label>
              <div className="relative">
                <span
                  className="absolute left-4 top-1/2 -translate-y-1/2 font-body font-medium select-none"
                  style={{ color: 'var(--color-books)', fontSize: '0.95rem' }}
                >
                  @
                </span>
                <input
                  id="handle"
                  type="text"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value.replace(/^@/, '').replace(/\s/g, '').toLowerCase())}
                  placeholder="alexchen"
                  required
                  className="font-body w-full rounded-xl pl-9 pr-4 py-3 outline-none transition-all duration-200"
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
            </div>

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
                placeholder="At least 8 characters"
                required
                minLength={8}
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
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          {/* Sign in link */}
          <p
            className="font-body text-center mt-6"
            style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}
          >
            Already have an account?{' '}
            <Link
              href="/login"
              className="transition-colors duration-200"
              style={{ color: 'var(--color-books)' }}
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
