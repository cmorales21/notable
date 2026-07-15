'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toggleEngagement } from '@/lib/engagement'
import { checkedWrite } from '@/lib/writes'
import { groupRecommendations, normalizeTitle, type GroupedRecommendation } from '@/lib/groupRecommendations'
import { CATEGORY_CONFIG, type Category } from './feed/categoryConfig'
import { EmptyStateIcon } from './feed/helpers'
import EmptyState from '@/app/components/EmptyState'
import { FeedSkeleton } from '@/app/components/skeletons'
import { GroupedCard } from './feed/GroupedCard'
import CardErrorBoundary from './CardErrorBoundary'
import { GroupedModal } from './feed/GroupedModal'
import { theme } from '@/app/lib/theme'
import { useToast } from '@/app/components/Toast'

// ─── Public re-exports (consumed by profile page, search page, hooks) ─────────

export type { RecProfile, Recommendation, RecComment } from '@/app/lib/types'
export { sortComments, fetchComments } from './feed/helpers'
export { RecModal } from './feed/RecModal'

// ─── Types ────────────────────────────────────────────────────────────────────

import type { RecProfile, Recommendation } from '@/app/lib/types'
type Profile = RecProfile

// Shape returned by the embedded-count select: likes(count) etc. come back as [{ count: n }]
type EngagementCountRow = {
  id: string
  likes: { count: number }[] | null
  comments: { count: number }[] | null
  bookmarks: { count: number }[] | null
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CategoryFeed({ category }: { category: string }) {
  const cat = category as Category
  const config = CATEGORY_CONFIG[cat]

  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  const [recs, setRecs] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(null)
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({})
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({})
  const [bookmarkCounts, setBookmarkCounts] = useState<Record<string, number>>({})
  const [userLikes, setUserLikes] = useState<Set<string>>(new Set())
  const [userBookmarks, setUserBookmarks] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<'discovery' | 'following'>('discovery')
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [followCount, setFollowCount] = useState<number | null>(null)

  const [ignoredUserIds, setIgnoredUserIds] = useState<Set<string>>(new Set())
  const toast = useToast()

  const [selectedGroup, setSelectedGroup] = useState<GroupedRecommendation | null>(null)
  const [focusOnOpen, setFocusOnOpen] = useState(false)
  const autoOpenedRef = useRef(false)
  const loadMoreControllerRef = useRef<AbortController | null>(null)

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchFeed = useCallback(async (signal: AbortSignal) => {
    setLoading(true)
    setRecs([])
    setHasMore(false)
    setFollowCount(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (signal.aborted) return
      const uid = user?.id ?? null
      setCurrentUserId(uid)

      if (uid) {
        const [{ data: profileData }, { data: ignoreData }, { data: blockedByMe }, { data: blockingMe }] = await Promise.all([
          supabase.from('profiles').select('name, handle, avatar_url').eq('id', uid).abortSignal(signal).maybeSingle(),
          supabase.from('user_ignores').select('ignored_user_id').eq('user_id', uid).abortSignal(signal),
          supabase.from('user_blocks').select('blocked_id').eq('blocker_id', uid).abortSignal(signal),
          supabase.from('user_blocks').select('blocker_id').eq('blocked_id', uid).abortSignal(signal),
        ])
        if (signal.aborted) return
        setCurrentUserProfile(profileData)
        setIgnoredUserIds(new Set([
          ...(ignoreData ?? []).map((r: { ignored_user_id: string }) => r.ignored_user_id),
          ...(blockedByMe ?? []).map((r: { blocked_id: string }) => r.blocked_id),
          ...(blockingMe ?? []).map((r: { blocker_id: string }) => r.blocker_id),
        ]))
      }

      let followedUserIds: string[] | null = null
      if (activeTab === 'following') {
        if (!uid) return
        const { data: followData } = await supabase
          .from('follows').select('following_id').eq('follower_id', uid).eq('status', 'accepted').abortSignal(signal)
        if (signal.aborted) return
        followedUserIds = (followData ?? []).map((f: { following_id: string }) => f.following_id)
        setFollowCount(followedUserIds.length)
        if (followedUserIds.length === 0) return
      }

      let recsRaw: Recommendation[] | null = null
      if (activeTab === 'discovery') {
        const { data: rpcData, error: rpcError } = await supabase
          .rpc('get_discovery_feed', { p_category: cat, p_user_id: uid ?? null, p_limit: 30, p_offset: 0 }).abortSignal(signal)
        if (signal.aborted) return
        if (!rpcError) {
          recsRaw = rpcData
        } else {
          // RPC not yet deployed — fall back to recency order
          const { data } = await supabase
            .from('recommendations').select('*').eq('category', cat)
            .order('created_at', { ascending: false }).limit(30).abortSignal(signal)
          if (signal.aborted) return
          recsRaw = data
        }
      } else {
        const { data } = await supabase
          .from('recommendations').select('*').eq('category', cat)
          .in('user_id', followedUserIds!)
          .order('created_at', { ascending: false }).limit(30).abortSignal(signal)
        if (signal.aborted) return
        recsRaw = data
      }

      const baseRecs = recsRaw ?? []
      const profileMap: Record<string, Profile> = {}
      if (baseRecs.length > 0) {
        const userIds = [...new Set(baseRecs.map((r: { user_id: string }) => r.user_id))]
        const { data: profilesData } = await supabase
          .from('profiles').select('id, name, handle, avatar_url').in('id', userIds).abortSignal(signal)
        if (signal.aborted) return
        for (const p of profilesData ?? []) {
          profileMap[p.id] = { name: p.name, handle: p.handle, avatar_url: p.avatar_url }
        }
      }

      const fetchedRecs: Recommendation[] = baseRecs.map((r: Recommendation) => ({
        ...r, profiles: profileMap[r.user_id] ?? null,
      }))
      setRecs(fetchedRecs)
      setHasMore(fetchedRecs.length === 30)
      if (fetchedRecs.length === 0) return

      const ids = fetchedRecs.map((r) => r.id)
      const [{ data: countRows }, { data: myLikes }, { data: myBookmarks }] = await Promise.all([
        supabase.from('recommendations').select('id, likes(count), comments(count), bookmarks(count)').in('id', ids).abortSignal(signal),
        uid ? supabase.from('likes').select('recommendation_id').eq('user_id', uid).in('recommendation_id', ids).abortSignal(signal) : Promise.resolve({ data: [] }),
        uid ? supabase.from('bookmarks').select('recommendation_id').eq('user_id', uid).in('recommendation_id', ids).abortSignal(signal) : Promise.resolve({ data: [] }),
      ])
      if (signal.aborted) return

      const lc: Record<string, number> = {}
      const cc: Record<string, number> = {}
      const bc: Record<string, number> = {}
      for (const id of ids) { lc[id] = 0; cc[id] = 0; bc[id] = 0 }
      for (const row of (countRows ?? []) as EngagementCountRow[]) {
        lc[row.id] = row.likes?.[0]?.count ?? 0
        cc[row.id] = row.comments?.[0]?.count ?? 0
        bc[row.id] = row.bookmarks?.[0]?.count ?? 0
      }
      setLikeCounts(lc)
      setCommentCounts(cc)
      setBookmarkCounts(bc)
      setUserLikes(new Set((myLikes ?? []).map((l: { recommendation_id: string }) => l.recommendation_id)))
      setUserBookmarks(new Set((myBookmarks ?? []).map((b: { recommendation_id: string }) => b.recommendation_id)))
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      throw err
    } finally {
      if (!signal.aborted) setLoading(false)
    }
  }, [cat, supabase, activeTab])

  useEffect(() => {
    const controller = new AbortController()
    fetchFeed(controller.signal)
    return () => {
      controller.abort()
      loadMoreControllerRef.current?.abort()
    }
  }, [fetchFeed])

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore) return
    loadMoreControllerRef.current?.abort()
    const controller = new AbortController()
    loadMoreControllerRef.current = controller
    const signal = controller.signal

    setLoadingMore(true)
    try {
      const uid = currentUserId
      let followedUserIds: string[] | null = null
      if (activeTab === 'following') {
        if (!uid) return
        const { data: followData } = await supabase
          .from('follows').select('following_id').eq('follower_id', uid).eq('status', 'accepted').abortSignal(signal)
        if (signal.aborted) return
        followedUserIds = (followData ?? []).map((f: { following_id: string }) => f.following_id)
        if (followedUserIds.length === 0) return
      }

      const offset = recs.length
      let recsRaw: Recommendation[] | null = null
      if (activeTab === 'discovery') {
        const { data: rpcData, error: rpcError } = await supabase
          .rpc('get_discovery_feed', { p_category: cat, p_user_id: uid ?? null, p_limit: 30, p_offset: offset }).abortSignal(signal)
        if (signal.aborted) return
        if (!rpcError) {
          recsRaw = rpcData
        } else {
          const { data } = await supabase
            .from('recommendations').select('*').eq('category', cat)
            .order('created_at', { ascending: false }).range(offset, offset + 29).abortSignal(signal)
          if (signal.aborted) return
          recsRaw = data
        }
      } else {
        const { data } = await supabase
          .from('recommendations').select('*').eq('category', cat)
          .in('user_id', followedUserIds!)
          .order('created_at', { ascending: false }).range(offset, offset + 29).abortSignal(signal)
        if (signal.aborted) return
        recsRaw = data
      }

      const newBaseRecs = recsRaw ?? []
      setHasMore(newBaseRecs.length === 30)
      if (newBaseRecs.length === 0) return

      const profileMap: Record<string, Profile> = {}
      const userIds = [...new Set(newBaseRecs.map((r: { user_id: string }) => r.user_id))]
      const { data: profilesData } = await supabase
        .from('profiles').select('id, name, handle, avatar_url').in('id', userIds).abortSignal(signal)
      if (signal.aborted) return
      for (const p of profilesData ?? []) {
        profileMap[p.id] = { name: p.name, handle: p.handle, avatar_url: p.avatar_url }
      }

      const newRecs: Recommendation[] = newBaseRecs.map((r: Recommendation) => ({
        ...r, profiles: profileMap[r.user_id] ?? null,
      }))
      const ids = newRecs.map((r) => r.id)
      const [{ data: countRows }, { data: myLikes }, { data: myBookmarks }] = await Promise.all([
        supabase.from('recommendations').select('id, likes(count), comments(count), bookmarks(count)').in('id', ids).abortSignal(signal),
        uid ? supabase.from('likes').select('recommendation_id').eq('user_id', uid).in('recommendation_id', ids).abortSignal(signal) : Promise.resolve({ data: [] }),
        uid ? supabase.from('bookmarks').select('recommendation_id').eq('user_id', uid).in('recommendation_id', ids).abortSignal(signal) : Promise.resolve({ data: [] }),
      ])
      if (signal.aborted) return

      const lc: Record<string, number> = {}
      const cc: Record<string, number> = {}
      const bc: Record<string, number> = {}
      for (const id of ids) { lc[id] = 0; cc[id] = 0; bc[id] = 0 }
      for (const row of (countRows ?? []) as EngagementCountRow[]) {
        lc[row.id] = row.likes?.[0]?.count ?? 0
        cc[row.id] = row.comments?.[0]?.count ?? 0
        bc[row.id] = row.bookmarks?.[0]?.count ?? 0
      }

      setRecs(prev => [...prev, ...newRecs])
      setLikeCounts(prev => ({ ...prev, ...lc }))
      setCommentCounts(prev => ({ ...prev, ...cc }))
      setBookmarkCounts(prev => ({ ...prev, ...bc }))
      setUserLikes(prev => {
        const next = new Set(prev)
        for (const l of (myLikes ?? []) as { recommendation_id: string }[]) next.add(l.recommendation_id)
        return next
      })
      setUserBookmarks(prev => {
        const next = new Set(prev)
        for (const b of (myBookmarks ?? []) as { recommendation_id: string }[]) next.add(b.recommendation_id)
        return next
      })
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      throw err
    } finally {
      if (!signal.aborted) setLoadingMore(false)
    }
  }, [recs.length, hasMore, loadingMore, cat, supabase, activeTab, currentUserId])

  // Stable ref so the IntersectionObserver callback always calls the latest loadMore
  const sentinelRef = useRef<HTMLDivElement>(null)
  const loadMoreRef = useRef(loadMore)
  useEffect(() => { loadMoreRef.current = loadMore }, [loadMore])

  useEffect(() => {
    document.body.style.overflow = selectedGroup ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [selectedGroup])

  // ── Like / Bookmark toggles ────────────────────────────────────────────────

  async function toggleLike(e: React.MouseEvent, recId: string) {
    e.stopPropagation()
    if (!currentUserId) return
    const liked = userLikes.has(recId)
    toast(liked ? 'Unliked' : 'Liked')
    await toggleEngagement(supabase, {
      kind: 'like',
      scope: 'rec',
      targetId: recId,
      userId: currentUserId,
      isActive: liked,
      apply: (active) => {
        setUserLikes((prev) => { const next = new Set(prev); if (active) next.add(recId); else next.delete(recId); return next })
        setLikeCounts((prev) => ({ ...prev, [recId]: (prev[recId] ?? 0) + (active ? 1 : -1) }))
      },
      toast,
    })
  }

  async function toggleBookmark(e: React.MouseEvent, recId: string) {
    e.stopPropagation()
    if (!currentUserId) return
    const bookmarked = userBookmarks.has(recId)
    toast(bookmarked ? 'Removed from saved' : 'Saved')
    await toggleEngagement(supabase, {
      kind: 'bookmark',
      scope: 'rec',
      targetId: recId,
      userId: currentUserId,
      isActive: bookmarked,
      apply: (active) => {
        setUserBookmarks((prev) => { const next = new Set(prev); if (active) next.add(recId); else next.delete(recId); return next })
      },
      toast,
    })
  }

  // ── Grouped recs + modal handlers ──────────────────────────────────────────

  const groupedRecs = useMemo(() => {
    const groups = groupRecommendations(recs, likeCounts, commentCounts, userLikes, userBookmarks)
    if (activeTab === 'discovery') {
      const msPerDay = 86_400_000
      groups.sort((a, b) => {
        const score = (g: typeof a) => {
          const groupBookmarks = g.recommenders.reduce(
            (sum, r) => sum + (bookmarkCounts[r.recommendation_id] ?? 0), 0)
          return (
            g.total_likes * 2 +
            g.total_comments * 3 +
            groupBookmarks * 3 +
            10 / (1 + (Date.now() - new Date(g.most_recent_date).getTime()) / msPerDay)
          )
        }
        return score(b) - score(a)
      })
    }
    return groups
  }, [recs, likeCounts, commentCounts, userLikes, userBookmarks, activeTab, bookmarkCounts])

  const visibleGroups = useMemo(() => {
    if (ignoredUserIds.size === 0) return groupedRecs
    return groupedRecs
      .map(group => {
        const visible = group.recommenders.filter(r => !ignoredUserIds.has(r.user_id))
        if (visible.length === 0) return null
        if (visible.length === group.recommenders.length) return group
        return { ...group, recommenders: visible, lead_rec_id: visible[0].recommendation_id }
      })
      .filter(Boolean) as GroupedRecommendation[]
  }, [groupedRecs, ignoredUserIds])

  function closeModal() { setSelectedGroup(null); setFocusOnOpen(false) }

  function handleLikeToggle(recId: string, wasLiked: boolean) {
    setUserLikes(prev => { const next = new Set(prev); if (wasLiked) next.delete(recId); else next.add(recId); return next })
    setLikeCounts(prev => ({ ...prev, [recId]: Math.max(0, (prev[recId] ?? 0) + (wasLiked ? -1 : 1)) }))
  }

  function handleBookmarkToggle(recId: string, wasBookmarked: boolean) {
    setUserBookmarks(prev => { const next = new Set(prev); if (wasBookmarked) next.delete(recId); else next.add(recId); return next })
  }

  async function handleIgnoreUser(targetUserId: string, targetUserName: string) {
    if (!currentUserId) return
    setIgnoredUserIds(prev => new Set([...prev, targetUserId]))
    toast(`${targetUserName} hidden from your feed`)
    const ok = await checkedWrite(
      supabase.from('user_ignores').insert({ user_id: currentUserId, ignored_user_id: targetUserId })
    )
    if (!ok) {
      setIgnoredUserIds(prev => { const n = new Set(prev); n.delete(targetUserId); return n })
      toast(`Couldn’t hide ${targetUserName}. Please try again.`)
    }
  }

  useEffect(() => {
    function onNewPost(e: Event) {
      const evt = e as CustomEvent<{ category: string }>
      if (evt.detail?.category === cat) {
        const ctrl = new AbortController()
        fetchFeed(ctrl.signal)
      }
    }
    window.addEventListener('notable:new-post', onNewPost)
    return () => window.removeEventListener('notable:new-post', onNewPost)
  }, [cat, fetchFeed])

  // IntersectionObserver — trigger loadMore when sentinel enters viewport
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !hasMore || loading) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMoreRef.current() },
      { rootMargin: '500px' }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, loading])

  // Auto-open modal when ?rec=<id> is present in the URL
  useEffect(() => {
    if (loading || autoOpenedRef.current) return
    const recId = new URLSearchParams(window.location.search).get('rec')
    if (!recId) return
    autoOpenedRef.current = true

    const found = groupedRecs.find(g => g.recommenders.some(r => r.recommendation_id === recId))
    if (found) { setSelectedGroup(found); return }

    ;(async () => {
      const { data: recData } = await supabase
        .from('recommendations').select('*').eq('id', recId).maybeSingle()
      if (!recData) return

      const { data: { user } } = await supabase.auth.getUser()
      const uid = user?.id ?? null

      const [{ data: profileData }, { count: likeCount }, { data: myLike }, { count: commentCount }] = await Promise.all([
        supabase.from('profiles').select('id, name, handle, avatar_url, profile_private').eq('id', recData.user_id).maybeSingle(),
        supabase.from('likes').select('*', { count: 'exact', head: true }).eq('recommendation_id', recId),
        uid ? supabase.from('likes').select('id').eq('recommendation_id', recId).eq('user_id', uid).maybeSingle() : Promise.resolve({ data: null }),
        supabase.from('comments').select('*', { count: 'exact', head: true }).eq('recommendation_id', recId),
      ])

      // Privacy gate: a private-profile rec should only auto-open for the
      // author or an accepted follower. Same rule the search + rec/[id] page
      // enforce; without it a shared /?rec=<id> link would bypass privacy.
      if (profileData?.profile_private === true && recData.user_id !== uid) {
        if (!uid) return
        const { data: followRow } = await supabase
          .from('follows')
          .select('id')
          .eq('follower_id', uid)
          .eq('following_id', recData.user_id)
          .eq('status', 'accepted')
          .maybeSingle()
        if (!followRow) return
      }

      const profile = profileData
        ? { name: profileData.name, handle: profileData.handle, avatar_url: profileData.avatar_url } : null

      setSelectedGroup({
        groupKey: `${normalizeTitle(recData.title)}::${recData.category}`,
        title: recData.title, category: recData.category,
        image_url: recData.image_url, external_url: recData.external_url,
        total_likes: likeCount ?? 0, total_comments: commentCount ?? 0,
        most_recent_date: recData.created_at, lead_rec_id: recData.id,
        recommenders: [{
          recommendation_id: recData.id, user_id: recData.user_id, profile,
          description: recData.description, created_at: recData.created_at,
          individual_likes: likeCount ?? 0, individual_comments: commentCount ?? 0,
          is_liked_by_user: !!myLike, is_bookmarked_by_user: false,
          external_url: recData.external_url,
        }],
      })
    })()
  }, [loading, groupedRecs, supabase])

  // ── Render ──────────────────────────────────────────────────────────────────

  const DISCOVERY_DESCRIPTIONS: Record<string, string> = {
    books:       "Be the first to recommend a book. What's worth reading?",
    movies:      "Be the first to recommend something to watch. What's unmissable?",
    music:       "Be the first to recommend music. What's worth hearing?",
    restaurants: "Be the first to recommend a restaurant. Where's worth going?",
    podcasts:    "Be the first to recommend a podcast. What's worth listening to?",
  }

  const accentColor = config.color

  return (
    <>
      <div style={{ maxWidth: '500px', margin: '0 auto', padding: '0 24px 48px' }}>
        {/* Feed header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: '56px', zIndex: 10, background: theme.colors.bg,
          backdropFilter: 'blur(8px)', padding: '10px 0', marginBottom: '14px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flexShrink: 1 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: accentColor, flexShrink: 0 }} />
            <span className="font-display" style={{ fontSize: '22px', fontWeight: 600, color: theme.colors.textPrimary, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {config.label}
            </span>
          </div>

          {/* Discovery / Following toggle */}
          <div style={{ display: 'flex', background: theme.colors.surface, border: `1px solid ${theme.colors.border}`, borderRadius: '999px', padding: '3px', gap: '2px', flexShrink: 0 }}>
            {(['discovery', 'following'] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                padding: '5px 14px', borderRadius: '999px', border: 'none', cursor: 'pointer',
                fontSize: '12px', fontWeight: 500, fontFamily: 'var(--font-body, "DM Sans", sans-serif)',
                transition: 'background 0.15s, color 0.15s',
                background: activeTab === tab ? accentColor : 'transparent',
                color: activeTab === tab ? '#ffffff' : '#6b5d4f',
              }}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Feed content */}
        {loading ? (
          <FeedSkeleton />
        ) : visibleGroups.length === 0 ? (
          activeTab === 'following' ? (
            followCount === 0 ? (
              <EmptyState
                icon={<EmptyStateIcon category={cat} />}
                title="You're not following anyone yet"
                description="Follow people whose taste you trust. Their recommendations will show up here."
              />
            ) : (
              <EmptyState
                icon={<EmptyStateIcon category={cat} />}
                title="Nothing from your people yet"
                description="The people you follow haven't recommended anything here yet. Check Discovery to find something worth your time."
              />
            )
          ) : (
            <EmptyState
              icon={<EmptyStateIcon category={cat} />}
              title="Nothing here yet"
              description={DISCOVERY_DESCRIPTIONS[cat] ?? "Be the first to share something you love."}
            />
          )
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {visibleGroups.map((group) => (
              <CardErrorBoundary key={group.groupKey}>
                <GroupedCard
                  group={group}
                  accentColor={accentColor}
                  tab={activeTab}
                  currentUserId={currentUserId}
                  onLike={(e) => toggleLike(e, group.lead_rec_id)}
                  onBookmark={(e) => toggleBookmark(e, group.lead_rec_id)}
                  onClick={() => { setFocusOnOpen(false); setSelectedGroup(group) }}
                  onCommentClick={(e) => { e.stopPropagation(); setFocusOnOpen(true); setSelectedGroup(group) }}
                  onIgnore={handleIgnoreUser}
                  onDelete={(recId) => setRecs(prev => prev.filter(r => r.id !== recId))}
                />
              </CardErrorBoundary>
            ))}
          </div>
        )}

        {/* Sentinel: IntersectionObserver fires loadMore when this enters viewport */}
        {!loading && <div ref={sentinelRef} style={{ height: 1 }} />}

        {/* Per-page spinner — only shown during subsequent fetches, not initial load */}
        {loadingMore && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
            <div
              className="feed-spinner"
              style={{
                width: 20, height: 20,
                border: `2px solid ${theme.colors.input}`,
                borderTopColor: accentColor,
                borderRadius: '50%',
              }}
            />
          </div>
        )}

        {/* End-of-feed note — quiet close, no doom-scrolling */}
        {!loading && !loadingMore && !hasMore && visibleGroups.length > 0 && (
          <div style={{
            textAlign: 'center', padding: '40px 24px 8px',
            color: theme.colors.textMuted,
            fontFamily: theme.fonts.body,
            fontSize: '13px', fontStyle: 'italic', letterSpacing: '0.01em',
          }}>
            That&rsquo;s everything for now. Time to go enjoy the recommendations.
          </div>
        )}
      </div>

      {selectedGroup && (
        <GroupedModal
          group={selectedGroup}
          accentColor={accentColor}
          currentUserId={currentUserId}
          currentUserProfile={currentUserProfile}
          focusInput={focusOnOpen}
          onLikeToggle={handleLikeToggle}
          onBookmarkToggle={handleBookmarkToggle}
          onClose={closeModal}
          onRecDeleted={(recId) => setRecs(prev => prev.filter(r => r.id !== recId))}
          onRecUpdated={(recId, desc) => setRecs(prev => prev.map(r => r.id === recId ? { ...r, description: desc } : r))}
          onCommentCountChange={(recId, delta) => setCommentCounts(prev => ({ ...prev, [recId]: Math.max(0, (prev[recId] ?? 0) + delta) }))}
          onIgnore={handleIgnoreUser}
        />
      )}
    </>
  )
}

