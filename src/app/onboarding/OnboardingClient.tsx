'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function fieldStyle(focused: boolean): React.CSSProperties {
  return {
    background: 'var(--color-surface-2)',
    border: focused ? '1px solid rgba(82,113,255,0.5)' : '1px solid rgba(0,0,0,0.1)',
    boxShadow: focused ? '0 0 0 3px rgba(82,113,255,0.08)' : 'none',
    color: 'var(--color-text)',
    fontSize: '0.95rem',
    outline: 'none',
    transition: 'border 0.15s ease, box-shadow 0.15s ease',
  }
}

interface Props {
  userId: string
  userEmail: string
  initialName: string
}

export default function OnboardingClient({ userId, userEmail, initialName }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  const [name, setName] = useState(initialName)
  const [handle, setHandle] = useState('')
  const [handleStatus, setHandleStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [focusedInput, setFocusedInput] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounced handle uniqueness check
  useEffect(() => {
    if (!handle) { setHandleStatus('idle'); return }
    if (!/^[a-z0-9_]{3,20}$/.test(handle)) { setHandleStatus('invalid'); return }

    setHandleStatus('checking')
    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('handle')
        .eq('handle', handle)
        .maybeSingle()
      setHandleStatus(data ? 'taken' : 'available')
    }, 450)

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [handle, supabase])

  async function saveHandle() {
    setSaving(true)
    setError(null)

    const { error } = await supabase.from('profiles').upsert(
      { id: userId, name: name.trim(), handle, email: userEmail },
      { onConflict: 'id' }
    )

    if (error) {
      setError(error.message)
      setSaving(false)
      return
    }

    // Handle saved — go to lobby where the welcome overlay will appear
    router.push('/lobby')
    router.refresh()
  }

  const canContinue = name.trim().length > 0 && handleStatus === 'available' && !saving

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 py-16"
      style={{
        background: 'var(--color-background)',
        backgroundImage: 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(82,113,255,0.06) 0%, transparent 60%)',
      }}
    >
      <div className="w-full max-w-md">

        {/* Wordmark */}
        <p
          className="text-center mb-10"
          style={{
            fontSize: '1.4rem',
            letterSpacing: '-0.02em',
            color: 'var(--color-text)',
            fontFamily: 'var(--font-climate-crisis)',
          }}
        >
          Notable
        </p>

        {/* Heading */}
        <div className="text-center mb-8">
          <h1
            className="font-display font-bold text-text mb-3"
            style={{ fontSize: 'clamp(1.7rem, 4vw, 2.2rem)', letterSpacing: '-0.02em' }}
          >
            Choose your handle
          </h1>
          <p className="font-body text-muted" style={{ fontSize: '0.95rem' }}>
            This is how people will find you on Notable
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-8 flex flex-col gap-5"
          style={{ background: 'var(--color-surface)', border: '1px solid rgba(0,0,0,0.08)' }}
        >
          {error && (
            <div
              className="rounded-xl px-4 py-3 font-body"
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

          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="ob-name"
              className="font-body text-muted"
              style={{ fontSize: '0.78rem', letterSpacing: '0.06em' }}
            >
              YOUR NAME
            </label>
            <input
              id="ob-name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Alex Chen"
              className="font-body rounded-xl px-4 py-3"
              style={fieldStyle(focusedInput === 'name')}
              onFocus={() => setFocusedInput('name')}
              onBlur={() => setFocusedInput(null)}
            />
          </div>

          {/* Handle */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="ob-handle"
              className="font-body text-muted"
              style={{ fontSize: '0.78rem', letterSpacing: '0.06em' }}
            >
              HANDLE
            </label>
            <div className="relative">
              <span
                className="absolute left-4 top-1/2 -translate-y-1/2 font-body font-semibold select-none pointer-events-none"
                style={{ color: 'var(--color-books)', fontSize: '0.95rem' }}
              >
                @
              </span>
              <input
                id="ob-handle"
                type="text"
                value={handle}
                onChange={e =>
                  setHandle(
                    e.target.value
                      .replace(/^@/, '')
                      .replace(/[^a-z0-9_]/g, '')
                      .toLowerCase()
                      .slice(0, 20)
                  )
                }
                placeholder="alexchen"
                className="font-body w-full rounded-xl pl-9 pr-10 py-3"
                style={fieldStyle(focusedInput === 'handle')}
                onFocus={() => setFocusedInput('handle')}
                onBlur={() => setFocusedInput(null)}
              />

              {/* Status indicator */}
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {handleStatus === 'checking' && (
                  <svg className="w-4 h-4 animate-spin text-muted" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                )}
                {handleStatus === 'available' && (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="#4aad4e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                )}
                {(handleStatus === 'taken' || handleStatus === 'invalid') && (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="#d4636b" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                )}
              </div>
            </div>

            <p
              className="font-body"
              style={{
                fontSize: '0.78rem',
                color:
                  handleStatus === 'available' ? '#4aad4e'
                  : (handleStatus === 'taken' || handleStatus === 'invalid') ? '#d4636b'
                  : 'var(--color-muted)',
              }}
            >
              {handleStatus === 'available' && 'That handle is available'}
              {handleStatus === 'taken' && 'That handle is already taken'}
              {handleStatus === 'invalid' && 'Letters, numbers, underscores only · 3–20 characters'}
              {(handleStatus === 'idle' || handleStatus === 'checking') &&
                'Letters, numbers, and underscores only · 3–20 characters'}
            </p>
          </div>

          {/* Continue */}
          <button
            onClick={saveHandle}
            disabled={!canContinue}
            className="font-body font-semibold py-3.5 rounded-xl mt-1 transition-all duration-200"
            style={{
              background: canContinue ? '#5271FF' : 'rgba(82,113,255,0.25)',
              color: canContinue ? '#fff' : 'rgba(82,113,255,0.5)',
              cursor: canContinue ? 'pointer' : 'not-allowed',
              boxShadow: canContinue ? '0 0 24px rgba(82,113,255,0.28)' : 'none',
              fontSize: '0.95rem',
            }}
          >
            {saving ? 'Saving…' : 'Continue'}
          </button>
        </div>

      </div>
    </div>
  )
}
