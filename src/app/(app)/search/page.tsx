'use client'

import { Suspense, useState, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { RecommendationImage } from '@/app/components/RecommendationImage'
import { createClient } from '@/lib/supabase/client'
import { checkedWrite } from '@/lib/writes'
import { useSearch } from '@/app/hooks/useSearch'
import { Avatar } from '@/app/components/Avatar'
import { SearchSkeleton } from '@/app/components/skeletons'
import { useToast } from '@/app/components/Toast'
import type { SearchPerson } from '@/app/hooks/useSearch'
import type { SearchGroupedRec } from '@/lib/groupRecommendations'
import { CATEGORY_COLORS, CATEGORY_LABELS, CATEGORY_ORDER, type Category } from '@/app/lib/theme'

// ─── Constants ────────────────────────────────────────────────────────────────

type FilterId = 'all' | Category | 'people'

const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'all', label: 'All' },
  ...CATEGORY_ORDER.map((id) => ({ id, label: CATEGORY_LABELS[id] })),
  { id: 'people', label: 'People' },
]

// ─── Image with fallback ──────────────────────────────────────────────────────

function RecImage({ imageUrl, category, size }: { imageUrl: string | null; category: string; size: number }) {
  return (
    <RecommendationImage
      src={imageUrl}
      category={category}
      alt=""
      width={size}
      height={size}
      style={{ borderRadius: 10 }}
    />
  )
}

// ─── Recommender attribution text ─────────────────────────────────────────────

function groupAttribution(group: SearchGroupedRec): string {
  const { recommender_count: n, recommenders } = group
  if (n === 0) return ''
  const first = recommenders[0]?.name ?? recommenders[0]?.handle ?? 'Someone'
  if (n === 1) return `Recommended by ${first}`
  if (n === 2) {
    const second = recommenders[1]?.name ?? recommenders[1]?.handle ?? 'Someone'
    return `Recommended by ${first} and ${second}`
  }
  return `Recommended by ${first} and ${n - 1} other${n - 1 > 1 ? 's' : ''}`
}

// ─── Follow button ────────────────────────────────────────────────────────────

function FollowButton({
  following, requested, pending, onToggle,
}: { following: boolean; requested: boolean; pending: boolean; onToggle: () => void }) {
  const [hovered, setHovered] = useState(false)
  const isActive = following || requested
  return (
    <button
      onClick={e => { e.stopPropagation(); onToggle() }}
      disabled={pending}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="font-body"
      style={{
        background: isActive ? (hovered ? 'rgba(212,99,107,0.12)' : 'rgba(0,0,0,0.08)') : 'transparent',
        border: `1px solid ${isActive ? (hovered ? 'rgba(212,99,107,0.4)' : 'rgba(0,0,0,0.12)') : 'rgba(0,0,0,0.15)'}`,
        borderRadius: 20, padding: '5px 14px',
        fontSize: '12px', fontWeight: 500,
        color: isActive ? (hovered ? '#e05555' : '#33261a') : '#33261a',
        cursor: pending ? 'default' : 'pointer',
        transition: 'all 0.15s', flexShrink: 0, minWidth: 80, textAlign: 'center',
      }}
    >
      {following ? (hovered ? 'Unfollow' : 'Following') : requested ? (hovered ? 'Cancel' : 'Requested') : 'Follow'}
    </button>
  )
}

// ─── Main search content ──────────────────────────────────────────────────────

function SearchPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const supabase = useRef(createClient())

  const [inputValue, setInputValue] = useState(searchParams.get('q') ?? '')
  const [filter, setFilter] = useState<FilterId>('all')

  const hookCategory = filter === 'all' || filter === 'people'
    ? filter
    : filter

  const toast = useToast()
  const { groupedRecs, people, loading, error: searchError, setQuery } = useSearch({
    recLimit: 30,
    peopleLimit: 10,
    category: hookCategory,
  })

  // Sync local input → hook query
  useEffect(() => { setQuery(inputValue) }, [inputValue, setQuery])

  // Sync local input → URL (debounced)
  const urlTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (urlTimerRef.current) clearTimeout(urlTimerRef.current)
    urlTimerRef.current = setTimeout(() => {
      const q = inputValue.trim()
      const current = searchParams.get('q') ?? ''
      if (q === current) return
      const params = new URLSearchParams(searchParams.toString())
      if (q) { params.set('q', q) } else { params.delete('q') }
      router.replace(`/search${params.size ? `?${params}` : ''}`, { scroll: false })
    }, 400)
    return () => { if (urlTimerRef.current) clearTimeout(urlTimerRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputValue])

  // Current user & follow state
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set())
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set())
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    supabase.current.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setCurrentUserId(user.id)
    })
  }, [])

  // Batch-load follow states whenever people results change
  useEffect(() => {
    if (!currentUserId || people.length === 0) return
    const ids = people.map(p => p.id)
    supabase.current.from('follows').select('following_id, status')
      .eq('follower_id', currentUserId).in('following_id', ids)
      .then(({ data }) => {
        const accepted = new Set<string>()
        const pending = new Set<string>()
        for (const f of (data ?? []) as { following_id: string; status: string }[]) {
          if (f.status === 'accepted') accepted.add(f.following_id)
          else if (f.status === 'pending') pending.add(f.following_id)
        }
        setFollowedIds(accepted)
        setRequestedIds(pending)
      })
  }, [people, currentUserId])

  async function toggleFollow(targetId: string) {
    if (!currentUserId || pendingIds.has(targetId)) return
    setPendingIds(prev => new Set([...prev, targetId]))

    if (followedIds.has(targetId)) {
      const ok = await checkedWrite(
        supabase.current.from('follows').delete()
          .eq('follower_id', currentUserId).eq('following_id', targetId)
      )
      if (ok) {
        setFollowedIds(prev => { const n = new Set(prev); n.delete(targetId); return n })
      } else {
        toast('Couldn’t unfollow. Please try again.')
      }
    } else if (requestedIds.has(targetId)) {
      const ok = await checkedWrite(
        supabase.current.from('follows').delete()
          .eq('follower_id', currentUserId).eq('following_id', targetId)
      )
      if (ok) {
        setRequestedIds(prev => { const n = new Set(prev); n.delete(targetId); return n })
        void checkedWrite(
          supabase.current.from('notifications').delete()
            .eq('user_id', targetId).eq('actor_id', currentUserId).eq('type', 'follow_request')
        )
      } else {
        toast('Couldn’t cancel the request. Please try again.')
      }
    } else {
      const targetPerson = people.find(p => p.id === targetId)
      if (targetPerson?.profile_private) {
        const ok = await checkedWrite(
          supabase.current.from('follows').insert({ follower_id: currentUserId, following_id: targetId, status: 'pending' })
        )
        if (ok) {
          setRequestedIds(prev => new Set([...prev, targetId]))
        } else {
          toast('Couldn’t send the request. Please try again.')
        }
      } else {
        const ok = await checkedWrite(
          supabase.current.from('follows').insert({ follower_id: currentUserId, following_id: targetId })
        )
        if (ok) {
          setFollowedIds(prev => new Set([...prev, targetId]))
        } else {
          toast('Couldn’t follow. Please try again.')
        }
      }
    }

    setPendingIds(prev => { const n = new Set(prev); n.delete(targetId); return n })
  }

  // People rec counts for display (fetched per person)
  const [recCounts, setRecCounts] = useState<Record<string, number>>({})
  const [followerCounts, setFollowerCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    if (people.length === 0) return
    const ids = people.map(p => p.id)

    supabase.current.from('recommendations').select('user_id').in('user_id', ids)
      .then(({ data }) => {
        const map: Record<string, number> = {}
        for (const id of ids) map[id] = 0
        for (const r of data ?? []) map[r.user_id] = (map[r.user_id] ?? 0) + 1
        setRecCounts(map)
      })

    supabase.current.from('follows').select('following_id').in('following_id', ids).eq('status', 'accepted')
      .then(({ data }) => {
        const map: Record<string, number> = {}
        for (const id of ids) map[id] = 0
        for (const f of data ?? []) map[f.following_id] = (map[f.following_id] ?? 0) + 1
        setFollowerCounts(map)
      })
  }, [people])

  // ── Derived ─────────────────────────────────────────────────────────────────

  const hasQuery = inputValue.trim().length >= 2
  const trimmedQuery = inputValue.trim().startsWith('@') ? inputValue.trim().slice(1) : inputValue.trim()
  const hasError = hasQuery && !loading && searchError
  const isEmpty = hasQuery && !loading && !searchError && groupedRecs.length === 0 && people.length === 0

  const showPeopleSection = (filter === 'all' || filter === 'people') && people.length > 0
  const showRecsSection = filter !== 'people' && groupedRecs.length > 0

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes sp-spin { to { transform: rotate(360deg) } }
        .sp-rec-row:hover { background: rgba(0,0,0,0.02) !important; }
        .sp-person-row:hover { background: rgba(0,0,0,0.02) !important; }
      `}</style>

      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '24px 20px 60px' }}>

        {/* ── Search input ─────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          background: '#faf8f4',
          border: '1px solid rgba(0,0,0,0.1)',
          borderRadius: '12px',
          padding: '12px 16px',
          marginBottom: '16px',
        }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="#6b5d4f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            autoFocus
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            placeholder="Search Notable..."
            className="font-body"
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: '#33261a', fontSize: '15px',
              caretColor: '#33261a',
            }}
          />
          {loading && (
            <svg viewBox="0 0 24 24" fill="none" stroke="#6b5d4f" strokeWidth="2.2" strokeLinecap="round" width="16" height="16"
              style={{ animation: 'sp-spin 0.75s linear infinite', flexShrink: 0 }}>
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          )}
          {inputValue && (
            <button onClick={() => setInputValue('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b5d4f', padding: '2px', display: 'flex', flexShrink: 0 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" width="15" height="15">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* ── Filter pills ─────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', scrollbarWidth: 'none', marginBottom: '24px', paddingBottom: '2px' }}>
          {FILTERS.map(({ id, label }) => {
            const active = filter === id
            const color = id === 'all' || id === 'people' ? '#33261a' : CATEGORY_COLORS[id]
            return (
              <button
                key={id}
                onClick={() => setFilter(id)}
                className="font-body"
                style={{
                  background: active ? (id === 'all' || id === 'people' ? 'rgba(58,42,26,0.12)' : color) : 'transparent',
                  border: `1px solid ${active ? (id === 'all' || id === 'people' ? 'rgba(58,42,26,0.18)' : color) : 'rgba(0,0,0,0.12)'}`,
                  borderRadius: 20, padding: '5px 13px',
                  fontSize: '12px', fontWeight: active ? 600 : 400,
                  color: active
                    ? (id === 'all' || id === 'people' ? '#33261a' : '#ffffff')
                    : '#6b5d4f',
                  cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                  transition: 'all 0.13s',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>

        {/* ── Loading skeleton ──────────────────────────────────────── */}
        {hasQuery && loading && <SearchSkeleton />}

        {/* ── Initial empty state ───────────────────────────────────── */}
        {!hasQuery && (
          <div style={{ paddingTop: '48px', textAlign: 'center' }}>
            <p className="font-display" style={{ color: '#4a4438', fontSize: '1.1rem', fontWeight: 600, letterSpacing: '-0.01em' }}>
              Search for recommendations and people
            </p>
          </div>
        )}

        {/* ── Search failed ─────────────────────────────────────────── */}
        {hasError && (
          <div style={{ paddingTop: '48px', textAlign: 'center' }}>
            <p className="font-display" style={{ color: '#33261a', fontSize: '1.15rem', fontWeight: 600, letterSpacing: '-0.01em', marginBottom: '8px' }}>
              Something went wrong
            </p>
            <p className="font-body" style={{ color: '#6b5d4f', fontSize: '14px' }}>
              We couldn&rsquo;t complete that search. Please try again.
            </p>
          </div>
        )}

        {/* ── No results ────────────────────────────────────────────── */}
        {isEmpty && (
          <div style={{ paddingTop: '48px', textAlign: 'center' }}>
            <p className="font-display" style={{ color: '#33261a', fontSize: '1.15rem', fontWeight: 600, letterSpacing: '-0.01em', marginBottom: '8px' }}>
              No results for &ldquo;{trimmedQuery}&rdquo;
            </p>
            <p className="font-body" style={{ color: '#6b5d4f', fontSize: '14px' }}>
              Try a different spelling or search for someone with @
            </p>
          </div>
        )}

        {/* ── Grouped recommendation results ────────────────────────── */}
        {showRecsSection && (
          <div style={{ marginBottom: showPeopleSection ? '32px' : 0 }}>
            {groupedRecs.map(group => {
              const color = CATEGORY_COLORS[group.category] ?? '#6b5d4f'
              const attribution = groupAttribution(group)
              return (
                <button
                  key={group.groupKey}
                  onClick={() => router.push(`/${group.category}?rec=${group.lead_rec_id}`)}
                  className="sp-rec-row font-body"
                  style={{
                    width: '100%', background: 'transparent', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'flex-start', gap: '16px',
                    padding: '14px 0', textAlign: 'left',
                    borderBottom: '1px solid rgba(0,0,0,0.04)',
                  }}
                >
                  <RecImage imageUrl={group.image_url} category={group.category} size={80} />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="font-display" style={{
                      color: '#33261a', fontSize: '1.1rem', fontWeight: 600,
                      letterSpacing: '-0.01em', lineHeight: 1.25,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      marginBottom: '5px',
                    }}>
                      {group.title}
                    </p>

                    {/* Category pill */}
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginBottom: '5px' }}>
                      <span style={{
                        background: `${color}22`, border: `1px solid ${color}55`,
                        borderRadius: 20, padding: '1px 8px',
                        fontSize: '11px', fontWeight: 500, color: color,
                      }}>
                        {CATEGORY_LABELS[group.category]}
                      </span>
                    </div>

                    {/* Attribution */}
                    {attribution && (
                      <p className="font-body" style={{ color: '#6b5d4f', fontSize: '12px', marginBottom: '5px' }}>
                        {attribution}
                      </p>
                    )}

                    {/* Teaser from most recent rec */}
                    {group.most_recent_description && (
                      <p className="font-body" style={{
                        color: '#6b5d4f', fontSize: '13px', lineHeight: 1.5,
                        overflow: 'hidden', display: '-webkit-box',
                        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                      }}>
                        {group.most_recent_description}
                      </p>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* ── People results ────────────────────────────────────────── */}
        {showPeopleSection && (
          <div>
            {filter === 'all' && groupedRecs.length > 0 && (
              <p className="font-body" style={{ color: '#6b5d4f', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px' }}>
                People
              </p>
            )}
            {people.map((person: SearchPerson) => {
              if (!person.handle) return null
              const isCurrentUser = person.id === currentUserId
              const rCount = recCounts[person.id] ?? 0
              const fCount = followerCounts[person.id] ?? 0
              return (
                <div
                  key={person.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '14px',
                    padding: '14px 0',
                    borderBottom: '1px solid rgba(0,0,0,0.04)',
                  }}
                >
                  <Link
                    href={`/profile/${person.handle}`}
                    className="sp-person-row"
                    style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0, textDecoration: 'none' }}
                  >
                    <Avatar url={person.avatar_url} name={person.name} size={56} />

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="font-body" style={{
                        color: '#33261a', fontSize: '15px', fontWeight: 500,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {person.name ?? person.handle}
                      </p>
                      <p className="font-body" style={{ color: '#6b5d4f', fontSize: '13px', marginBottom: '2px' }}>
                        @{person.handle}
                      </p>
                      {person.bio && (
                        <p className="font-body" style={{
                          color: '#4a4438', fontSize: '12px', lineHeight: 1.4,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          marginBottom: '3px',
                        }}>
                          {person.bio}
                        </p>
                      )}
                      <p className="font-body" style={{ color: '#4a4438', fontSize: '12px' }}>
                        {rCount} recommendation{rCount !== 1 ? 's' : ''} · {fCount} follower{fCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </Link>

                  {!isCurrentUser && currentUserId && (
                    <FollowButton
                      following={followedIds.has(person.id)}
                      requested={requestedIds.has(person.id)}
                      pending={pendingIds.has(person.id)}
                      onToggle={() => toggleFollow(person.id)}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}

// ─── Page export (Suspense wrapper required for useSearchParams) ───────────────

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchPageContent />
    </Suspense>
  )
}
