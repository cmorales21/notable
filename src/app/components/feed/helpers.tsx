'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RecComment } from '@/app/lib/types'
import { theme } from '@/app/lib/theme'

// ─── Utilities ────────────────────────────────────────────────────────────────

export function formatRelativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diffMs / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return 'just now'
}

export function sortComments(comments: RecComment[]): RecComment[] {
  return [...comments].sort((a, b) => {
    const aLikes = (a.comment_likes ?? []).length
    const bLikes = (b.comment_likes ?? []).length
    if (bLikes !== aLikes) return bLikes - aLikes
    return b.created_at.localeCompare(a.created_at)
  })
}

export async function fetchComments(
  client: ReturnType<typeof createClient>,
  recId: string,
): Promise<RecComment[]> {
  const { data, error } = await client
    .from('comments')
    .select('*, profiles(name, handle, avatar_url), comment_likes(id, user_id)')
    .eq('recommendation_id', recId)
    .order('created_at', { ascending: true })
  if (!error && data) return sortComments(data)

  const { data: noLikes, error: noLikesErr } = await client
    .from('comments')
    .select('*, profiles(name, handle, avatar_url)')
    .eq('recommendation_id', recId)
    .order('created_at', { ascending: true })
  if (!noLikesErr && noLikes) return sortComments(noLikes)

  const { data: bare, error: bareErr } = await client
    .from('comments')
    .select('*')
    .eq('recommendation_id', recId)
    .order('created_at', { ascending: true })
  if (bareErr) console.error('[Notable] bare fetch failed — check RLS select policy on comments table:', bareErr.message)
  return sortComments(bare ?? [])
}

export function getExternalLinkLabel(_category: string, url: string): string {
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'Watch on YouTube →'
  if (url.includes('spotify.com')) return 'Listen on Spotify →'
  if (url.includes('apple.com')) return 'Open on Apple →'
  if (url.includes('imdb.com')) return 'View on IMDb →'
  if (url.includes('themoviedb.org')) return 'View on TMDB →'
  if (url.includes('openlibrary.org')) return 'Open on Open Library →'
  if (url.includes('goodreads.com')) return 'View on Goodreads →'
  if (url.includes('maps.google.com') || url.includes('google.com/maps')) return 'Open in Google Maps →'
  if (url.includes('yelp.com')) return 'View on Yelp →'
  try { return `View on ${new URL(url).hostname.replace(/^www\./, '')} →` }
  catch { return 'View →' }
}

// ─── UI Components ────────────────────────────────────────────────────────────

export function Avatar({
  url,
  name,
  size,
}: {
  url: string | null | undefined
  name: string | null | undefined
  size: number
}) {
  const initial = name ? name.charAt(0).toUpperCase() : '?'
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name ?? ''}
        width={size}
        height={size}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    )
  }
  return (
    <div
      style={{
        width: size, height: size, borderRadius: '50%',
        background: theme.colors.avatarFallback, border: '1px solid rgba(0,0,0,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.4, color: theme.colors.textPrimary, fontWeight: 500, flexShrink: 0,
      }}
    >
      {initial}
    </div>
  )
}

export function ActionButton({
  onClick,
  active,
  activeColor,
  label,
  children,
}: {
  onClick: (e: React.MouseEvent) => void
  active: boolean
  activeColor: string
  label: string
  children: React.ReactNode
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      aria-label={label}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '5px',
        padding: '6px 10px', border: 'none', cursor: 'pointer',
        borderRadius: '8px', transition: 'background 0.15s',
        background: active
          ? hovered ? `${activeColor}22` : `${activeColor}14`
          : hovered ? 'rgba(0,0,0,0.04)' : 'transparent',
      } as React.CSSProperties}
    >
      {children}
    </button>
  )
}

export function TeaserText({
  text,
  accentColor,
  attribution,
}: {
  text: string
  accentColor: string
  attribution?: { name: string | null; avatarUrl?: string | null }
}) {
  return (
    <div style={{ padding: '6px 16px 0' }}>
      {attribution && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}>
          <Avatar url={attribution.avatarUrl} name={attribution.name} size={18} />
          <span className="font-body" style={{ fontSize: '12px', color: accentColor, fontWeight: 500 }}>
            {attribution.name ?? 'Unknown'}
          </span>
        </div>
      )}
      <p
        className="font-body"
        style={{
          fontSize: '14px', color: theme.colors.textPrimary, lineHeight: '1.55', margin: 0,
          marginBottom: '10px', display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}
      >
        {text}
      </p>
    </div>
  )
}

export function ExternalLink({ href, label, color }: { href: string; label: string; color: string }) {
  const [hovered, setHovered] = useState(false)
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="font-body"
      style={{ color, fontSize: '13px', textDecoration: hovered ? 'underline' : 'none', textUnderlineOffset: '3px' }}
    >
      {label}
    </a>
  )
}

export function SkeletonCard() {
  return (
    <div style={{ background: theme.colors.surface, borderRadius: '16px', border: `1px solid ${theme.colors.border}`, overflow: 'hidden' }}>
      <div className="skeleton-pulse" style={{ height: '280px', background: theme.colors.input }} />
      <div style={{ padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <div className="skeleton-pulse" style={{ width: 32, height: 32, borderRadius: '50%', background: theme.colors.input }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton-pulse" style={{ height: 12, width: '40%', borderRadius: 6, background: theme.colors.input, marginBottom: 6 }} />
            <div className="skeleton-pulse" style={{ height: 10, width: '25%', borderRadius: 6, background: theme.colors.input }} />
          </div>
        </div>
        <div className="skeleton-pulse" style={{ height: 18, width: '80%', borderRadius: 6, background: theme.colors.input, marginBottom: 8 }} />
        <div className="skeleton-pulse" style={{ height: 13, width: '100%', borderRadius: 6, background: theme.colors.input, marginBottom: 6 }} />
        <div className="skeleton-pulse" style={{ height: 13, width: '70%', borderRadius: 6, background: theme.colors.input, marginBottom: 16 }} />
        <div style={{ display: 'flex', gap: '16px' }}>
          <div className="skeleton-pulse" style={{ height: 12, width: 48, borderRadius: 6, background: theme.colors.input }} />
          <div className="skeleton-pulse" style={{ height: 12, width: 32, borderRadius: 6, background: theme.colors.input }} />
          <div className="skeleton-pulse" style={{ height: 12, width: 40, borderRadius: 6, background: theme.colors.input }} />
        </div>
      </div>
    </div>
  )
}

export function EmptyStateIcon({ category }: { category: string }) {
  const stroke = '#6b5d4f'
  const props = { fill: 'none', stroke, strokeWidth: '1.5', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, width: 80, height: 80 }
  if (category === 'books') return (
    <svg viewBox="0 0 64 64" {...props}>
      <line x1="32" y1="10" x2="32" y2="54" />
      <path d="M6 13c0-2.8 2.2-5 5-5h16a5 5 0 015 5v39c0-2.5-2-4-5-4H11a5 5 0 01-5-5V13z" />
      <path d="M58 13c0-2.8-2.2-5-5-5H37a5 5 0 00-5 5v39c0-2.5 2-4 5-4h15a5 5 0 005-5V13z" />
    </svg>
  )
  if (category === 'movies') return (
    <svg viewBox="0 0 64 64" {...props}>
      <rect x="8" y="26" width="48" height="32" rx="3" />
      <rect x="8" y="14" width="48" height="12" rx="2" />
      <line x1="8" y1="26" x2="20" y2="14" />
      <line x1="22" y1="26" x2="34" y2="14" />
      <line x1="36" y1="26" x2="48" y2="14" />
    </svg>
  )
  if (category === 'music') return (
    <svg viewBox="0 0 64 64" {...props}>
      <circle cx="32" cy="36" r="22" />
      <circle cx="32" cy="36" r="9" />
      <circle cx="32" cy="36" r="2.5" />
    </svg>
  )
  if (category === 'restaurants') return (
    <svg viewBox="0 0 64 64" {...props}>
      <circle cx="32" cy="36" r="18" />
      <circle cx="32" cy="36" r="12" />
      <line x1="10" y1="26" x2="10" y2="56" />
      <line x1="54" y1="26" x2="54" y2="56" />
    </svg>
  )
  return (
    <svg viewBox="0 0 64 64" {...props}>
      <rect x="24" y="6" width="16" height="28" rx="8" />
      <path d="M14 24c0 10.5 8.1 18 18 18s18-7.5 18-18" />
      <line x1="32" y1="42" x2="32" y2="54" />
    </svg>
  )
}

