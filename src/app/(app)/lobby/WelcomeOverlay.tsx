'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Props {
  userId: string
  hasHandle: boolean
}

export default function WelcomeOverlay({ userId, hasHandle }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  const [overlayOpacity, setOverlayOpacity] = useState(0)
  const [textOpacity, setTextOpacity] = useState(0)
  const [gone, setGone] = useState(false)
  const [handleSaved, setHandleSaved] = useState(false)

  const [handle, setHandle] = useState('')
  const [handleStatus, setHandleStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle')
  const [saving, setSaving] = useState(false)
  const [handleError, setHandleError] = useState<string | null>(null)
  const [focused, setFocused] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const needsHandle = !hasHandle && !handleSaved

  // Fade in on mount: overlay first, then content with a 200ms delay
  useEffect(() => {
    const frameId = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setOverlayOpacity(1)
        setTimeout(() => setTextOpacity(1), 200)
      })
    )
    return () => cancelAnimationFrame(frameId)
  }, [])

  // Debounced handle uniqueness check
  useEffect(() => {
    if (!needsHandle) return
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
  }, [handle, needsHandle, supabase])

  async function saveHandle(e: React.FormEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (handleStatus !== 'available' || saving) return
    setSaving(true)
    setHandleError(null)

    const { error } = await supabase
      .from('profiles')
      .update({ handle })
      .eq('id', userId)

    if (error) {
      setHandleError(error.message)
      setSaving(false)
      return
    }

    setHandleSaved(true)
    setSaving(false)
  }

  async function dismiss() {
    if (needsHandle) return
    setOverlayOpacity(0)

    setTimeout(async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('hints_seen')
        .eq('id', userId)
        .maybeSingle()

      const hintsSeen: string[] = profile?.hints_seen ?? []
      const nextHints = hintsSeen.includes('welcome') ? hintsSeen : [...hintsSeen, 'welcome']

      await supabase
        .from('profiles')
        .update({ is_onboarded: true, hints_seen: nextHints })
        .eq('id', userId)

      router.refresh()
      setGone(true)
    }, 420)
  }

  if (gone) return null

  const canSave = handleStatus === 'available' && !saving

  return (
    <div
      onClick={!needsHandle ? dismiss : undefined}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background: 'rgba(245, 240, 232, 0.3)',
        backdropFilter: 'blur(5px)',
        WebkitBackdropFilter: 'blur(5px)',
        opacity: overlayOpacity,
        transition: 'opacity 0.5s ease',
        cursor: !needsHandle ? 'pointer' : 'default',
      }}
    >
      {/* Card — stops propagation only when handle is required */}
      <div
        onClick={needsHandle ? e => e.stopPropagation() : undefined}
        style={{
          background: '#faf8f4',
          border: '1px solid rgba(0,0,0,0.08)',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          padding: 'clamp(32px, 5vw, 40px)',
          maxWidth: '480px',
          width: '100%',
          textAlign: 'center',
          opacity: textOpacity,
          transition: 'opacity 0.3s ease',
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-playfair)',
            fontSize: 'clamp(1.9rem, 5vw, 2.5rem)',
            fontWeight: 700,
            color: '#33261a',
            letterSpacing: '-0.025em',
            lineHeight: 1.15,
            marginBottom: '16px',
          }}
        >
          Welcome to Notable.
        </h1>

        <p
          className="font-body"
          style={{
            fontSize: 'clamp(0.95rem, 1.5vw, 1.05rem)',
            color: '#6b5d4f',
            lineHeight: 1.7,
            marginBottom: needsHandle ? '24px' : '28px',
          }}
        >
          {needsHandle
            ? 'Pick a handle — this is how people find you.'
            : 'Thanks for signing up! Start exploring recommendations from people with great taste across books, movies, music, restaurants and podcasts.'}
        </p>

        {needsHandle ? (
          <form
            onSubmit={saveHandle}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}
          >
            <div style={{ position: 'relative', width: '100%', maxWidth: '300px' }}>
              <span
                style={{
                  position: 'absolute',
                  left: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#33261a',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  pointerEvents: 'none',
                  userSelect: 'none',
                  fontFamily: 'var(--font-dm-sans)',
                }}
              >
                @
              </span>
              <input
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
                placeholder="yourhandle"
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                className="font-body"
                style={{
                  width: '100%',
                  background: '#fff',
                  border: focused ? '1px solid rgba(51,38,26,0.4)' : '1px solid rgba(51,38,26,0.15)',
                  borderRadius: '10px',
                  padding: '11px 12px 11px 32px',
                  fontSize: '0.95rem',
                  color: '#33261a',
                  outline: 'none',
                  boxShadow: focused ? '0 0 0 3px rgba(51,38,26,0.06)' : 'none',
                  transition: 'border 0.15s ease, box-shadow 0.15s ease',
                }}
              />
              <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }}>
                {handleStatus === 'checking' && (
                  <svg className="animate-spin" style={{ width: 16, height: 16, color: '#9a8d7f' }} viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                )}
                {handleStatus === 'available' && (
                  <svg style={{ width: 16, height: 16 }} viewBox="0 0 24 24" fill="none" stroke="#4aad4e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                )}
                {(handleStatus === 'taken' || handleStatus === 'invalid') && (
                  <svg style={{ width: 16, height: 16 }} viewBox="0 0 24 24" fill="none" stroke="#d4636b" strokeWidth="2.5" strokeLinecap="round">
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
                  : '#9a8d7f',
              }}
            >
              {handleStatus === 'available' && 'That handle is available'}
              {handleStatus === 'taken' && 'That handle is already taken'}
              {handleStatus === 'invalid' && 'Letters, numbers, underscores only · 3–20 characters'}
              {(handleStatus === 'idle' || handleStatus === 'checking') && 'Letters, numbers, and underscores only · 3–20 characters'}
            </p>

            {handleError && (
              <p className="font-body" style={{ fontSize: '0.82rem', color: '#d4636b' }}>
                {handleError}
              </p>
            )}

            <button
              type="submit"
              disabled={!canSave}
              className="font-body font-semibold"
              style={{
                background: canSave ? '#33261a' : 'rgba(51,38,26,0.25)',
                color: canSave ? '#f5f0e8' : 'rgba(51,38,26,0.4)',
                border: 'none',
                borderRadius: '10px',
                padding: '12px 32px',
                fontSize: '0.95rem',
                cursor: canSave ? 'pointer' : 'not-allowed',
                transition: 'background 0.15s ease, color 0.15s ease',
              }}
            >
              {saving ? 'Saving…' : 'Continue'}
            </button>
          </form>
        ) : (
          <p
            className="font-body"
            style={{
              fontSize: '0.78rem',
              color: '#9a8d7f',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            tap anywhere to continue
          </p>
        )}
      </div>
    </div>
  )
}
