'use client'

import React, { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSearch } from '@/app/hooks/useSearch'
import { Avatar } from '@/app/components/CategoryFeed'
import { SkeletonPulse } from '@/app/components/skeletons'
import type { SearchGroupedRec } from '@/lib/groupRecommendations'

const CATEGORY_COLORS: Record<string, string> = {
  books: '#5271FF',
  movies: '#dc4f5c',
  music: '#4aad4e',
  restaurants: '#9055d0',
  podcasts: '#d4920a',
}

const CATEGORY_LABELS: Record<string, string> = {
  books: 'Books',
  movies: 'Movies & TV',
  music: 'Music',
  restaurants: 'Restaurants',
  podcasts: 'Podcasts',
}

// ─── Rec thumbnail (48×48) ────────────────────────────────────────────────────

function RecThumbnail({ imageUrl, category }: { imageUrl: string | null; category: string }) {
  const [imgError, setImgError] = useState(false)
  const color = CATEGORY_COLORS[category] ?? '#6b5d4f'
  const showImage = !!imageUrl && !imgError

  return (
    <div style={{
      position: 'relative', width: 48, height: 48, borderRadius: 8, overflow: 'hidden',
      flexShrink: 0, background: showImage ? '#faf8f4' : `${color}26`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {showImage ? (
        <Image
          src={imageUrl!}
          alt=""
          fill
          sizes="48px"
          onError={() => setImgError(true)}
          style={{ objectFit: 'cover' }}
        />
      ) : (
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
      )}
    </div>
  )
}

// ─── Attribution text ─────────────────────────────────────────────────────────

function recAttribution(group: SearchGroupedRec): string {
  const { recommender_count: n, recommenders } = group
  if (n === 0) return ''
  const first = recommenders[0]?.name ?? recommenders[0]?.handle ?? 'Someone'
  if (n === 1) return `by ${first}`
  if (n === 2) {
    const second = recommenders[1]?.name ?? recommenders[1]?.handle ?? 'Someone'
    return `by ${first} and ${second}`
  }
  return `by ${first} and ${n - 1} others`
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg
      viewBox="0 0 24 24" fill="none" stroke="#6b5d4f" strokeWidth="2.2"
      strokeLinecap="round" width="16" height="16"
      style={{ animation: 'sd-spin 0.75s linear infinite', flexShrink: 0 }}
    >
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  )
}

// ─── SearchDropdown ───────────────────────────────────────────────────────────

export default function SearchDropdown({ onClose, panelRef }: { onClose: () => void; panelRef: React.RefObject<HTMLDivElement | null> }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  const { groupedRecs, people, loading, query, setQuery } = useSearch({ recLimit: 6, peopleLimit: 3 })

  // Auto-focus
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Escape to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const hasQuery = query.trim().length >= 2
  const trimmedQuery = query.trim().startsWith('@') ? query.trim().slice(1) : query.trim()
  const isEmpty = hasQuery && !loading && groupedRecs.length === 0 && people.length === 0

  // Show up to 3 grouped recs + up to 2 people, capped at 5 total
  const shownRecs = groupedRecs.slice(0, 3)
  const shownPeople = people.slice(0, Math.max(0, 5 - shownRecs.length))

  function handleRecClick(group: SearchGroupedRec) {
    router.push(`/${group.category}?rec=${group.lead_rec_id}`)
    onClose()
  }

  return (
    <>
      <style>{`
        @keyframes sd-spin { to { transform: rotate(360deg) } }
        @keyframes sd-fade { from { opacity: 0; transform: translateY(-6px) } to { opacity: 1; transform: translateY(0) } }
        .sd-panel { animation: sd-fade 0.15s ease both; }
        .sd-row:hover { background: rgba(0,0,0,0.03) !important; }
        @media (max-width: 768px) {
          .sd-mobile-close { display: flex !important; }
          .sd-panel { left: 0 !important; right: 0 !important; top: 0 !important; width: auto !important; max-height: 100dvh !important; border-radius: 0 !important; }
        }
      `}</style>

      {/* Panel */}
      <div
        ref={panelRef}
        className="sd-panel"
        style={{
          position: 'fixed',
          top: '56px',
          right: '12px',
          width: '380px',
          zIndex: 95,
          background: '#faf8f4',
          border: '1px solid rgba(0,0,0,0.1)',
          borderRadius: '12px',
          boxShadow: '0 20px 60px rgba(58,42,26,0.25), 0 4px 16px rgba(58,42,26,0.12)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          maxHeight: 'calc(100dvh - 72px)',
        }}
      >
        {/* Input row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '12px 14px',
          borderBottom: '1px solid rgba(0,0,0,0.08)',
          flexShrink: 0,
        }}>
          {/* Mobile close button */}
          <button
            onClick={onClose}
            style={{
              display: 'none',
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#6b5d4f', padding: '2px', flexShrink: 0,
            }}
            className="sd-mobile-close"
            aria-label="Close search"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" width="20" height="20">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>

          {/* Search icon */}
          <svg viewBox="0 0 24 24" fill="none" stroke="#6b5d4f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>

          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search Notable..."
            className="font-body"
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: '#33261a', fontSize: '14px',
              caretColor: '#33261a',
            }}
          />

          {loading && <Spinner />}

          {query && (
            <button
              onClick={() => setQuery('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b5d4f', padding: '2px', flexShrink: 0, display: 'flex' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" width="14" height="14">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Results */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {!hasQuery && (
            <div style={{ padding: '24px 16px', textAlign: 'center' }}>
              <p className="font-body" style={{ color: '#4a4438', fontSize: '13px' }}>
                Search for recommendations and people
              </p>
            </div>
          )}

          {hasQuery && loading && (
            <div style={{ padding: '6px 0' }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 14px' }}>
                  <SkeletonPulse style={{ width: 48, height: 48, borderRadius: 8, flexShrink: 0 }} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <SkeletonPulse style={{ height: 13, width: '65%', borderRadius: 5 }} />
                    <SkeletonPulse style={{ height: 10, width: '40%', borderRadius: 5 }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {isEmpty && (
            <div style={{ padding: '24px 16px', textAlign: 'center' }}>
              <p className="font-body" style={{ color: '#6b5d4f', fontSize: '13px' }}>
                No results for &ldquo;{trimmedQuery}&rdquo;
              </p>
            </div>
          )}

          {(shownRecs.length > 0 || shownPeople.length > 0) && (
            <div style={{ padding: '6px 0' }}>
              {/* Grouped rec results */}
              {shownRecs.map(group => {
                const color = CATEGORY_COLORS[group.category] ?? '#6b5d4f'
                const attribution = recAttribution(group)
                return (
                  <button
                    key={group.groupKey}
                    onClick={() => handleRecClick(group)}
                    className="sd-row font-body"
                    style={{
                      width: '100%', background: 'transparent', border: 'none',
                      cursor: 'pointer', padding: '9px 14px',
                      display: 'flex', alignItems: 'center', gap: '12px',
                      textAlign: 'left',
                    }}
                  >
                    <RecThumbnail imageUrl={group.image_url} category={group.category} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="font-display" style={{
                        color: '#33261a', fontSize: '0.9rem', fontWeight: 600,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        letterSpacing: '-0.01em',
                      }}>
                        {group.title}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' }}>
                        <div style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0 }} />
                        <span style={{ color: '#6b5d4f', fontSize: '11px' }}>{CATEGORY_LABELS[group.category]}</span>
                        {attribution && (
                          <>
                            <span style={{ color: '#4a4438', fontSize: '11px' }}>·</span>
                            <span style={{ color: '#6b5d4f', fontSize: '11px' }}>{attribution}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}

              {/* People results */}
              {shownPeople.map(person => {
                if (!person.handle) return null
                return (
                  <Link
                    key={person.id}
                    href={`/profile/${person.handle}`}
                    onClick={onClose}
                    className="sd-row"
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '9px 14px', textDecoration: 'none',
                    }}
                  >
                    <Avatar url={person.avatar_url} name={person.name} size={40} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="font-body" style={{
                        color: '#33261a', fontSize: '13px', fontWeight: 500,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {person.name ?? person.handle}
                      </p>
                      <p className="font-body" style={{ color: '#6b5d4f', fontSize: '12px' }}>
                        @{person.handle}
                      </p>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer — "See all results" */}
        {hasQuery && (
          <div style={{
            borderTop: '1px solid rgba(0,0,0,0.08)',
            padding: '10px 14px',
            flexShrink: 0,
          }}>
            <Link
              href={`/search?q=${encodeURIComponent(query.trim())}`}
              onClick={onClose}
              className="font-body"
              style={{
                display: 'block', textAlign: 'center',
                color: '#6b5d4f', fontSize: '13px', textDecoration: 'none',
                padding: '4px 0',
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = '#33261a')}
              onMouseLeave={e => (e.currentTarget.style.color = '#6b5d4f')}
            >
              See all results for &ldquo;{query.trim()}&rdquo;
            </Link>
          </div>
        )}
      </div>
    </>
  )
}
