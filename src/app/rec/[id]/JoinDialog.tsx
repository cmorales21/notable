'use client'

import { useState, useEffect, type ReactNode, type CSSProperties } from 'react'
import Link from 'next/link'
import { theme } from '@/app/lib/theme'

// Intent-triggered signup dialog. Opens the moment a logged-out visitor
// taps something that requires an account (heart, save, comment, a name).
// Never intercepts reading — dismissable via the X, tap-outside, or Escape.

type Trigger = 'heart' | 'bookmark' | 'comment' | 'name'

function copyFor(trigger: Trigger, name?: string | null): string {
  switch (trigger) {
    case 'heart':    return 'Love it? Join Notable and discover your next favorite thing.'
    case 'bookmark': return "Save this for later. Join Notable and it'll be waiting in your library."
    case 'comment':  return 'Join Notable to join the conversation.'
    case 'name':
      // If we truly have no display name (or the name is an empty string),
      // switch to a grammatically correct generic line rather than rendering
      // "see everything  recommends." with a blank.
      return name && name.trim()
        ? `Join Notable to see everything ${name.trim()} recommends.`
        : 'Join Notable to see everything they recommend.'
  }
}

// ─── Dialog ──────────────────────────────────────────────────────────────────

function JoinDialog({
  open, onClose, copy, nextUrl,
}: {
  open: boolean
  onClose: () => void
  copy: string
  nextUrl: string
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null
  const encoded = encodeURIComponent(nextUrl)

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(51,38,26,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        style={{
          background: theme.colors.surface,
          borderRadius: theme.radii.card,
          padding: '30px 26px 24px',
          maxWidth: '360px',
          width: '100%',
          boxShadow: theme.shadows.card,
          position: 'relative',
        }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute', top: '10px', right: '10px',
            width: 30, height: 30, borderRadius: '50%',
            background: 'transparent', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: theme.colors.textMuted,
          }}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <p
          className="font-display"
          style={{
            fontSize: '17px', fontWeight: 600, color: theme.colors.textPrimary,
            lineHeight: 1.4, letterSpacing: '-0.01em', margin: '0 0 20px',
            paddingRight: '20px',
          }}
        >
          {copy}
        </p>

        <Link
          href={`/signup?next=${encoded}`}
          className="font-body"
          style={{
            display: 'block', textAlign: 'center',
            padding: '11px 20px', borderRadius: theme.radii.pill,
            background: theme.categoryColors.books, color: '#ffffff',
            fontSize: '14px', fontWeight: 600, textDecoration: 'none',
            marginBottom: '12px',
          }}
        >
          Join Notable
        </Link>

        <Link
          href={`/login?next=${encoded}`}
          className="font-body"
          style={{
            display: 'block', textAlign: 'center',
            fontSize: '13px', color: theme.colors.textMuted,
            textDecoration: 'none',
          }}
        >
          Already a member? <span style={{ color: theme.categoryColors.books, fontWeight: 500 }}>Sign in</span>
        </Link>
      </div>
    </div>
  )
}

// ─── Action pills row ────────────────────────────────────────────────────────

const pillBase: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '6px',
  padding: '8px 14px', borderRadius: theme.radii.pill,
  background: theme.colors.input,
  fontSize: '14px', fontWeight: 500, color: theme.colors.textMuted,
  border: 'none', cursor: 'pointer', fontFamily: theme.fonts.body,
}

function PillButton({
  onClick, icon, label,
}: { onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button type="button" onClick={onClick} style={pillBase} className="font-body">
      {icon}
      {label}
    </button>
  )
}

export function LoggedOutActionRow({
  likeCount, bookmarkCount, commentCount, nextUrl, hasComments,
}: {
  likeCount: number
  bookmarkCount: number
  commentCount: number
  nextUrl: string
  hasComments: boolean
}) {
  const [trigger, setTrigger] = useState<Trigger | null>(null)

  return (
    <>
      <div style={{ display: 'flex', gap: '6px', marginBottom: hasComments ? '28px' : '0' }}>
        <PillButton
          onClick={() => setTrigger('heart')}
          icon={
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>
          }
          label={likeCount > 0 ? `${likeCount} ${likeCount === 1 ? 'like' : 'likes'}` : 'Like'}
        />
        <PillButton
          onClick={() => setTrigger('bookmark')}
          icon={
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 3h14a1 1 0 011 1v17l-8-4-8 4V4a1 1 0 011-1z" />
            </svg>
          }
          label={bookmarkCount > 0 ? `${bookmarkCount} saved` : 'Save'}
        />
        <PillButton
          onClick={() => setTrigger('comment')}
          icon={
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
          }
          label={commentCount > 0 ? String(commentCount) : 'Comment'}
        />
      </div>

      <JoinDialog
        open={trigger !== null}
        onClose={() => setTrigger(null)}
        copy={trigger ? copyFor(trigger) : ''}
        nextUrl={nextUrl}
      />
    </>
  )
}

// ─── Recommender name trigger ────────────────────────────────────────────────

export function LoggedOutNameTrigger({
  displayName, handle, nextUrl,
}: {
  // Nullable so the dialog copy can pick the correct grammar. When null, the
  // visible label falls back to "Unknown" (matches the logged-in server render).
  displayName: string | null
  handle: string | null
  nextUrl: string
}) {
  const [open, setOpen] = useState(false)
  const visibleLabel = displayName && displayName.trim() ? displayName.trim() : 'Unknown'
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          background: 'transparent', border: 'none', padding: 0,
          textAlign: 'left', cursor: 'pointer', display: 'block', width: '100%',
        }}
      >
        <span
          className="font-body"
          style={{
            color: theme.colors.textPrimary, fontSize: '15px', fontWeight: 500,
            display: 'block',
          }}
        >
          {visibleLabel}
        </span>
        {handle && (
          <span
            className="font-body"
            style={{ color: theme.colors.textMuted, fontSize: '13px' }}
          >
            @{handle}
          </span>
        )}
      </button>

      <JoinDialog
        open={open}
        onClose={() => setOpen(false)}
        copy={copyFor('name', displayName)}
        nextUrl={nextUrl}
      />
    </>
  )
}
