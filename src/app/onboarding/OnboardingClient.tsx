'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// ─── Category definitions (icons match the landing page exactly) ─────────────

const CATEGORIES = [
  {
    id: 'books',
    name: 'Books',
    color: '#5271FF',
    placeholder: 'Book title...',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10">
        <path d="M24 42V12" />
        <path d="M6 10c0-2.2 1.8-4 4-4h10a4 4 0 014 4v30c0-2.2-1.8-4-4-4H10a4 4 0 01-4-4V10z" />
        <path d="M42 10c0-2.2-1.8-4-4-4H28a4 4 0 00-4 4v30c0-2.2 1.8-4 4-4h10a4 4 0 004-4V10z" />
        <line x1="10" y1="18" x2="20" y2="18" />
        <line x1="10" y1="24" x2="20" y2="24" />
        <line x1="38" y1="18" x2="28" y2="18" />
        <line x1="38" y1="24" x2="28" y2="24" />
      </svg>
    ),
  },
  {
    id: 'movies',
    name: 'Movies',
    color: '#dc4f5c',
    placeholder: 'Movie name...',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10">
        <rect x="4" y="14" width="40" height="28" rx="3" />
        <line x1="4" y1="22" x2="44" y2="22" />
        <line x1="16" y1="14" x2="16" y2="8" />
        <line x1="32" y1="14" x2="32" y2="8" />
        <line x1="10" y1="8" x2="16" y2="14" />
        <line x1="26" y1="8" x2="32" y2="14" />
        <line x1="4" y1="8" x2="10" y2="14" />
        <circle cx="14" cy="32" r="2" />
        <circle cx="24" cy="32" r="2" />
        <circle cx="34" cy="32" r="2" />
      </svg>
    ),
  },
  {
    id: 'music',
    name: 'Music',
    color: '#4aad4e',
    placeholder: 'Album or artist...',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10">
        <path d="M8 26c0-8.8 7.2-16 16-16s16 7.2 16 16" />
        <path d="M4 38V26a4 4 0 018 0v12a4 4 0 01-8 0z" />
        <path d="M36 38V26a4 4 0 018 0v12a4 4 0 01-8 0z" />
        <path d="M8 38a4 4 0 008 0M36 38a4 4 0 008 0" />
      </svg>
    ),
  },
  {
    id: 'restaurants',
    name: 'Restaurants',
    color: '#9055d0',
    placeholder: 'Restaurant name...',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10">
        <circle cx="24" cy="24" r="14" />
        <line x1="24" y1="10" x2="24" y2="38" />
        <line x1="10" y1="24" x2="38" y2="24" />
        <line x1="38" y1="8" x2="38" y2="18" />
        <line x1="38" y1="8" x2="34" y2="12" />
        <line x1="38" y1="8" x2="42" y2="12" />
        <line x1="38" y1="18" x2="38" y2="40" />
      </svg>
    ),
  },
  {
    id: 'podcasts',
    name: 'Podcasts',
    color: '#d4920a',
    placeholder: 'Podcast name...',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10">
        <rect x="18" y="4" width="12" height="24" rx="6" />
        <path d="M10 22c0 7.7 6.3 14 14 14s14-6.3 14-14" />
        <line x1="24" y1="36" x2="24" y2="44" />
        <line x1="16" y1="44" x2="32" y2="44" />
      </svg>
    ),
  },
]

// ─── Shared input style helper ────────────────────────────────────────────────

function inputStyle(focused: boolean): React.CSSProperties {
  return {
    background: 'var(--color-surface-2)',
    border: focused
      ? '1px solid rgba(82,113,255,0.5)'
      : '1px solid rgba(0,0,0,0.1)',
    boxShadow: focused ? '0 0 0 3px rgba(82,113,255,0.08)' : 'none',
    color: 'var(--color-text)',
    fontSize: '0.95rem',
    outline: 'none',
    transition: 'border 0.15s ease, box-shadow 0.15s ease',
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  userId: string
  userEmail: string
  initialName: string
  hasHandle: boolean // false for Google users who haven't picked one yet
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function OnboardingClient({
  userId,
  userEmail,
  initialName,
  hasHandle,
}: Props) {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  // Which step we're on
  const [step, setStep] = useState<'handle' | 'recommend'>(
    hasHandle ? 'recommend' : 'handle'
  )

  // ── Step 1: Handle state ──────────────────────────────────────────────────
  const [name, setName] = useState(initialName)
  const [handle, setHandle] = useState('')
  const [handleStatus, setHandleStatus] = useState<
    'idle' | 'checking' | 'available' | 'taken' | 'invalid'
  >('idle')
  const [savingHandle, setSavingHandle] = useState(false)
  const [handleError, setHandleError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Step 2: Recommendation state ─────────────────────────────────────────
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [inputsVisible, setInputsVisible] = useState(false)
  const [saving, setSaving] = useState(false)

  // Focus state for each input (for border highlight)
  const [focusedInput, setFocusedInput] = useState<string | null>(null)

  // ── Handle validation (debounced) ────────────────────────────────────────
  useEffect(() => {
    if (step !== 'handle') return
    if (!handle) { setHandleStatus('idle'); return }

    const valid = /^[a-z0-9_]{3,20}$/.test(handle)
    if (!valid) { setHandleStatus('invalid'); return }

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
  }, [handle, step, supabase])

  // ── Animate inputs in/out when category changes ───────────────────────────
  useEffect(() => {
    if (selectedCategory) {
      // Reset fields when switching categories
      setTitle('')
      setDescription('')
      // Tiny delay so the DOM mounts before the transition fires
      requestAnimationFrame(() => setInputsVisible(true))
    } else {
      setInputsVisible(false)
    }
  }, [selectedCategory])

  // ── Step 1: Save handle and advance ──────────────────────────────────────
  async function saveHandle() {
    setSavingHandle(true)
    setHandleError(null)

    const { error } = await supabase.from('profiles').upsert(
      { id: userId, name: name.trim(), handle, email: userEmail },
      { onConflict: 'id' }
    )

    if (error) {
      setHandleError(error.message)
      setSavingHandle(false)
      return
    }

    setStep('recommend')
    setSavingHandle(false)
  }

  // ── Step 2: Save recommendation + mark onboarded ─────────────────────────
  async function enterNotable() {
    setSaving(true)

    if (selectedCategory && title.trim()) {
      await supabase.from('recommendations').insert({
        user_id: userId,
        category: selectedCategory,
        title: title.trim(),
        description: description.trim() || null,
      })
    }

    await supabase
      .from('profiles')
      .update({ is_onboarded: true })
      .eq('id', userId)

    router.push('/lobby')
    router.refresh()
  }

  // ── Step 2: Skip without saving ──────────────────────────────────────────
  async function skip() {
    setSaving(true)
    await supabase
      .from('profiles')
      .update({ is_onboarded: true })
      .eq('id', userId)
    router.push('/lobby')
    router.refresh()
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 1 — HANDLE COLLECTION
  // ─────────────────────────────────────────────────────────────────────────
  if (step === 'handle') {
    const canContinue =
      name.trim().length > 0 && handleStatus === 'available' && !savingHandle

    return (
      <div
        className="min-h-screen flex items-center justify-center px-6 py-16"
        style={{
          background: 'var(--color-background)',
          backgroundImage:
            'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(82,113,255,0.06) 0%, transparent 60%)',
        }}
      >
        <div className="w-full max-w-md">
          {/* Wordmark */}
          <p
            className="text-center mb-10"
            style={{ fontSize: '1.4rem', letterSpacing: '-0.02em', color: 'var(--color-text)', fontFamily: 'var(--font-climate-crisis)', fontWeight: 700 }}
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
            style={{
              background: 'var(--color-surface)',
              border: '1px solid rgba(0,0,0,0.08)',
            }}
          >
            {/* Error */}
            {handleError && (
              <div
                className="rounded-xl px-4 py-3 font-body"
                style={{
                  background: 'rgba(212,99,107,0.12)',
                  border: '1px solid rgba(212,99,107,0.25)',
                  color: '#d4636b',
                  fontSize: '0.875rem',
                }}
              >
                {handleError}
              </div>
            )}

            {/* Name */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="name"
                className="font-body text-muted"
                style={{ fontSize: '0.78rem', letterSpacing: '0.06em' }}
              >
                YOUR NAME
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex Chen"
                className="font-body rounded-xl px-4 py-3"
                style={inputStyle(focusedInput === 'name')}
                onFocus={() => setFocusedInput('name')}
                onBlur={() => setFocusedInput(null)}
              />
            </div>

            {/* Handle */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="handle"
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
                  id="handle"
                  type="text"
                  value={handle}
                  onChange={(e) =>
                    setHandle(
                      e.target.value.replace(/^@/, '').replace(/[^a-z0-9_]/g, '').toLowerCase().slice(0, 20)
                    )
                  }
                  placeholder="alexchen"
                  className="font-body w-full rounded-xl pl-9 pr-10 py-3"
                  style={inputStyle(focusedInput === 'handle')}
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

              {/* Validation hint */}
              <p
                className="font-body"
                style={{
                  fontSize: '0.78rem',
                  color:
                    handleStatus === 'available'
                      ? '#4aad4e'
                      : handleStatus === 'taken' || handleStatus === 'invalid'
                      ? '#d4636b'
                      : 'var(--color-muted)',
                }}
              >
                {handleStatus === 'available' && 'That handle is available'}
                {handleStatus === 'taken' && 'That handle is already taken'}
                {handleStatus === 'invalid' &&
                  'Letters, numbers, underscores only · 3–20 characters'}
                {(handleStatus === 'idle' || handleStatus === 'checking') &&
                  'Letters, numbers, and underscores only · 3–20 characters'}
              </p>
            </div>

            {/* Continue button */}
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
              {savingHandle ? 'Saving…' : 'Continue'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 2 — RECOMMENDATION
  // ─────────────────────────────────────────────────────────────────────────
  const activeCat = CATEGORIES.find((c) => c.id === selectedCategory)

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 py-16"
      style={{
        background: 'var(--color-background)',
        backgroundImage:
          'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(82,113,255,0.06) 0%, transparent 65%)',
      }}
    >
      <div className="w-full max-w-2xl flex flex-col items-center gap-8">

        {/* Wordmark */}
        <p
          style={{ fontSize: '1.3rem', letterSpacing: '-0.02em', color: 'var(--color-text)', fontFamily: 'var(--font-climate-crisis)', fontWeight: 700 }}
        >
          Notable
        </p>

        {/* Heading */}
        <div className="text-center">
          <h1
            className="font-display font-bold text-text mb-3"
            style={{
              fontSize: 'clamp(1.6rem, 4.5vw, 2.4rem)',
              letterSpacing: '-0.025em',
              lineHeight: 1.1,
            }}
          >
            What&apos;s something you&apos;ve loved lately?
          </h1>
          <p className="font-body text-muted" style={{ fontSize: '0.95rem' }}>
            Share a recommendation to get started — or skip ahead, no pressure.
          </p>
        </div>

        {/* Category tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 w-full">
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(isSelected ? null : cat.id)}
                className="flex flex-col items-center justify-center gap-3 rounded-2xl px-3 py-7 transition-all duration-200"
                style={{
                  background: cat.color,
                  outline: isSelected ? `3px solid white` : '3px solid transparent',
                  outlineOffset: '2px',
                  boxShadow: isSelected
                    ? `0 0 32px ${cat.color}66, 0 8px 24px rgba(0,0,0,0.3)`
                    : '0 4px 16px rgba(0,0,0,0.2)',
                  transform: isSelected ? 'scale(1.04)' : 'scale(1)',
                  cursor: 'pointer',
                }}
              >
                <div className="opacity-90">{cat.icon}</div>
                <span className="font-body font-semibold text-white" style={{ fontSize: '0.9rem' }}>
                  {cat.name}
                </span>
              </button>
            )
          })}
        </div>

        {/* Inputs + "Enter Notable" — animate in together when a category is selected.
            maxHeight is tall enough to fit the card (~280px) + gap + button (~52px). */}
        <div
          style={{
            width: '100%',
            overflow: 'hidden',
            maxHeight: selectedCategory ? '480px' : '0px',
            opacity: inputsVisible ? 1 : 0,
            transform: inputsVisible ? 'translateY(0)' : 'translateY(10px)',
            transition:
              'max-height 0.35s cubic-bezier(0.16,1,0.3,1), opacity 0.3s ease, transform 0.3s ease',
            pointerEvents: selectedCategory ? 'auto' : 'none',
          }}
        >
          <div className="flex flex-col gap-4">
            {/* Input card */}
            <div
              className="rounded-2xl p-6 flex flex-col gap-4"
              style={{
                background: 'var(--color-surface)',
                border: `1px solid ${activeCat ? activeCat.color + '33' : 'rgba(0,0,0,0.08)'}`,
              }}
            >
              <div className="flex flex-col gap-1.5">
                <label
                  className="font-body text-muted"
                  style={{ fontSize: '0.78rem', letterSpacing: '0.06em' }}
                >
                  WHAT&apos;S IT CALLED?
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={activeCat?.placeholder ?? 'Title...'}
                  className="font-body rounded-xl px-4 py-3"
                  style={inputStyle(focusedInput === 'title')}
                  onFocus={() => setFocusedInput('title')}
                  onBlur={() => setFocusedInput(null)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  className="font-body text-muted"
                  style={{ fontSize: '0.78rem', letterSpacing: '0.06em' }}
                >
                  WHAT MADE IT SPECIAL?{' '}
                  <span style={{ color: 'rgba(122,114,96,0.6)', fontStyle: 'italic' }}>optional</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="A few words, a paragraph, whatever feels right..."
                  rows={3}
                  className="font-body rounded-xl px-4 py-3 resize-none"
                  style={inputStyle(focusedInput === 'desc')}
                  onFocus={() => setFocusedInput('desc')}
                  onBlur={() => setFocusedInput(null)}
                />
              </div>
            </div>

            {/* "Enter Notable" — in document flow, clearly part of this form.
                Uses the selected category's accent color as background. */}
            <button
              onClick={enterNotable}
              disabled={saving}
              className="font-body font-semibold w-full py-4 rounded-xl transition-all duration-200"
              style={{
                background: saving
                  ? `${activeCat?.color ?? 'var(--color-books)'}88`
                  : activeCat?.color ?? 'var(--color-books)',
                color: 'var(--color-background)',
                fontSize: '1rem',
                cursor: saving ? 'not-allowed' : 'pointer',
                boxShadow: saving
                  ? 'none'
                  : `0 0 28px ${activeCat?.color ?? 'var(--color-books)'}55`,
                letterSpacing: '-0.01em',
              }}
            >
              {saving ? 'One moment…' : 'Recommend'}
            </button>
          </div>
        </div>

        {/* "Skip for now" — always visible, subtle text link */}
        <button
          onClick={skip}
          disabled={saving}
          className="font-body transition-colors duration-200"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--color-muted)',
            fontSize: '0.875rem',
            cursor: saving ? 'not-allowed' : 'pointer',
            padding: '0.25rem 0.5rem',
            marginTop: selectedCategory ? '-8px' : '0',
          }}
        >
          Skip
        </button>

      </div>
    </div>
  )
}
