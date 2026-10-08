'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Avatar } from '@/app/components/Avatar'
import type { RecComment } from '@/app/lib/types'
import { theme, CATEGORY_COLORS } from '@/app/lib/theme'
import { safeExternalHref } from '@/lib/url'

// ─── Utilities ────────────────────────────────────────────────────────────────

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
        padding: '4px 8px', border: 'none', cursor: 'pointer',
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
  // null = full text fits in 2 lines (no "see more"); string = word-boundary
  // prefix to show, followed by "… see more".
  const [truncatedText, setTruncatedText] = useState<string | null>(null)
  const pRef = useRef<HTMLParagraphElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const compute = useCallback(() => {
    const p = pRef.current
    const m = measureRef.current
    if (!p || !m) return

    const width = p.clientWidth
    if (width === 0) return  // not laid out yet; a later effect will retry

    const lineHeightPx = 14 * 1.55  // matches the paragraph's inline style
    const maxHeight = lineHeightPx * 2 + 0.5  // subpixel tolerance

    m.style.width = `${width}px`

    // Fast path: does the full text already fit in 2 lines?
    m.textContent = text
    if (m.scrollHeight <= maxHeight) {
      setTruncatedText(null)
      return
    }

    // Binary search for the longest word-prefix such that
    //   `<prefix> … see more`
    // (with the suffix kept together via white-space:nowrap) fits in 2 lines.
    const words = text.split(/\s+/).filter(Boolean)
    const setContent = (prefix: string) => {
      m.textContent = ''
      if (prefix) m.appendChild(document.createTextNode(prefix + ' '))
      const nowrap = document.createElement('span')
      nowrap.style.whiteSpace = 'nowrap'
      const dots = document.createElement('span')
      dots.textContent = '… '
      nowrap.appendChild(dots)
      const btn = document.createElement('span')
      btn.style.fontSize = '13px'
      btn.style.fontWeight = '500'
      btn.textContent = 'see more'
      nowrap.appendChild(btn)
      m.appendChild(nowrap)
    }

    let lo = 0, hi = words.length, best = 0
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2)
      setContent(words.slice(0, mid).join(' '))
      if (m.scrollHeight <= maxHeight) { best = mid; lo = mid + 1 }
      else { hi = mid - 1 }
    }

    // Trim trailing punctuation that reads oddly before an ellipsis.
    const prefix = words.slice(0, best).join(' ').replace(/[,:;!?]+$/, '')
    // Fallback: if even zero words + suffix won't fit (ultra-narrow column),
    // still show the first word so the layout isn't empty.
    setTruncatedText(prefix || (words[0] ?? ''))
  }, [text])

  // Measure synchronously before paint so the user never sees the full-text
  // intermediate state on first render.
  useLayoutEffect(() => {
    if (expanded) return
    compute()
  }, [compute, expanded])

  // Re-measure when the container width changes (window resize, column reflow).
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => { if (!expanded) compute() })
    ro.observe(el)
    return () => ro.disconnect()
  }, [compute, expanded])

  // Re-measure once webfonts (DM Sans) finish loading — the first measurement
  // may run with a fallback metric. Guarded for environments without
  // document.fonts (older browsers, SSR).
  useEffect(() => {
    if (expanded) return
    const fonts = typeof document !== 'undefined' ? document.fonts : undefined
    if (!fonts?.ready) return
    let cancelled = false
    fonts.ready.then(() => { if (!cancelled) compute() })
    return () => { cancelled = true }
  }, [compute, expanded])

  const showTruncated = !expanded && truncatedText !== null

  return (
    <div style={{ padding: '4px 20px 0' }}>
      {attribution && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}>
          <Avatar url={attribution.avatarUrl} name={attribution.name} size={18} />
          <span className="font-body" style={{ fontSize: '12px', color: accentColor, fontWeight: 500 }}>
            {attribution.name ?? 'Unknown'}
          </span>
        </div>
      )}
      <div ref={containerRef}>
        <p
          ref={pRef}
          className="font-body"
          style={{
            fontSize: '14px', color: theme.colors.textPrimary, lineHeight: '1.55',
            margin: 0, marginBottom: '2px',
          }}
        >
          {showTruncated ? (
            <>
              {truncatedText}
              <span style={{ whiteSpace: 'nowrap' }}>
                <span>… </span>
                <button
                  onClick={e => { e.stopPropagation(); setExpanded(true) }}
                  className="font-body"
                  style={{
                    background: 'none', border: 'none', padding: 0,
                    fontSize: '13px', fontWeight: 500, color: accentColor, cursor: 'pointer',
                  }}
                >
                  see more
                </button>
              </span>
            </>
          ) : (
            text
          )}
        </p>
      </div>
      {/* Off-screen measurement node — matches the paragraph's typography. */}
      <div
        ref={measureRef}
        aria-hidden
        className="font-body"
        style={{
          position: 'fixed', left: '-10000px', top: 0,
          fontSize: '14px', lineHeight: '1.55',
          visibility: 'hidden', pointerEvents: 'none',
          padding: 0, margin: 0,
        }}
      />
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

