'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import type { RecComment } from '@/app/lib/types'
import { theme, CATEGORY_COLORS } from '@/app/lib/theme'
import { safeExternalHref } from '@/lib/url'

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

// Simplified from a 3-query fallback chain — schema is stable in production
export async function fetchComments(
  client: ReturnType<typeof createClient>,
  recId: string,
): Promise<RecComment[]> {
  const { data, error } = await client
    .from('comments')
    .select('*, profiles(name, handle, avatar_url), comment_likes(id, user_id)')
    .eq('recommendation_id', recId)
    .order('created_at', { ascending: true })
  if (error) {
    if (process.env.NODE_ENV !== 'production') console.error('[Notable] fetchComments failed:', error.message)
    return []
  }
  return sortComments(data ?? [])
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
  const [imgErr, setImgErr] = useState(false)
  const initial = name ? name.charAt(0).toUpperCase() : '?'
  if (url && !imgErr) {
    return (
      <Image
        src={url}
        alt={name ?? ''}
        width={size}
        height={size}
        onError={() => setImgErr(true)}
        style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
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
  label,
  children,
}: {
  onClick: (e: React.MouseEvent) => void
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
        background: hovered ? 'rgba(0,0,0,0.04)' : 'transparent',
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
  const [expanded, setExpanded] = useState(false)
  const [overflows, setOverflows] = useState(false)
  const pRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    const el = pRef.current
    if (!el) return
    // Measure while clamped: scrollHeight > clientHeight means text is cut off
    setOverflows(el.scrollHeight > el.clientHeight + 1)
  }, [text])

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
        ref={pRef}
        className="font-body"
        style={{
          fontSize: '14px', color: theme.colors.textPrimary, lineHeight: '1.55', margin: 0,
          marginBottom: overflows && !expanded ? '4px' : '10px',
          ...(expanded ? {} : {
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }),
        }}
      >
        {text}
      </p>
      {overflows && !expanded && (
        <button
          onClick={e => { e.stopPropagation(); setExpanded(true) }}
          className="font-body"
          style={{
            background: 'none', border: 'none', padding: '0 0 6px',
            fontSize: '13px', color: accentColor, cursor: 'pointer', fontWeight: 500,
          }}
        >
          see more
        </button>
      )}
    </div>
  )
}

export function ExternalLink({ href, label, color, onTrackClick }: { href: string; label: string; color: string; onTrackClick?: () => void }) {
  const [hovered, setHovered] = useState(false)
  const safeHref = safeExternalHref(href)
  if (!safeHref) {
    return (
      <span className="font-body" style={{ color, fontSize: '13px' }}>
        {label}
      </span>
    )
  }
  return (
    <a
      href={safeHref}
      target="_blank"
      rel="noopener noreferrer"
      onClick={e => { e.stopPropagation(); onTrackClick?.() }}
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

const EMPTY_STATE_ICONS: Record<string, { src: string; color: string; padding: string }> = {
  books:       { src: '/icons/books-small.svg',       color: CATEGORY_COLORS.books,       padding: '12px' },
  movies:      { src: '/icons/movies-small.svg',      color: CATEGORY_COLORS.movies,      padding: '16px' },
  music:       { src: '/icons/music-small.svg',       color: CATEGORY_COLORS.music,       padding: '14px' },
  restaurants: { src: '/icons/restaurants-small.svg', color: CATEGORY_COLORS.restaurants, padding: '12px' },
  podcasts:    { src: '/icons/podcasts-small.svg',    color: CATEGORY_COLORS.podcasts,    padding: '12px' },
}

export function EmptyStateIcon({ category }: { category: string }) {
  const icon = EMPTY_STATE_ICONS[category]
  if (!icon) return null
  return (
    <div
      style={{
        width: 56, height: 56, borderRadius: '14px',
        background: icon.color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: icon.padding,
        boxSizing: 'border-box',
      }}
    >
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <Image
          src={icon.src}
          alt={category}
          fill
          style={{ filter: 'brightness(0) invert(1)', opacity: 0.92 }}
        />
      </div>
    </div>
  )
}

