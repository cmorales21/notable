'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { groupRecommendations, normalizeTitle, type GroupedRecommendation } from '@/lib/groupRecommendations'
import { CATEGORY_CONFIG, type Category } from './feed/categoryConfig'
import { SkeletonCard, EmptyStateIcon } from './feed/helpers'
import { GroupedCard } from './feed/GroupedCard'
import { GroupedModal } from './feed/GroupedModal'
import { theme } from '@/app/lib/theme'
import { useWhispers } from '@/app/hooks/useWhispers'

// ─── Public re-exports (consumed by profile page, search page, hooks) ─────────

export type { RecProfile, Recommendation, RecComment } from '@/app/lib/types'
export { Avatar, sortComments, fetchComments } from './feed/helpers'
export { RecModal } from './feed/RecModal'

// ─── Types ────────────────────────────────────────────────────────────────────

import type { RecProfile, Recommendation } from '@/app/lib/types'
type Profile = RecProfile

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
  const [userLikes, setUserLikes] = useState<Set<string>>(new Set())
  const [userBookmarks, setUserBookmarks] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<'discovery' | 'following'>('discovery')
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  const [selectedGroup, setSelectedGroup] = useState<GroupedRecommendation | null>(null)
  const [focusOnOpen, setFocusOnOpen] = useState(false)
  const autoOpenedRef = useRef(false)

  const { shouldShow: whisperShouldShow } = useWhispers()

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchFeed = useCallback(async () => {
    setLoading(true)
    setRecs([])
    setHasMore(false)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const uid = user?.id ?? null
      setCurrentUserId(uid)

      if (uid) {
        const { data: profileData } = await supabase
          .from('profiles').select('name, handle, avatar_url').eq('id', uid).maybeSingle()
        setCurrentUserProfile(profileData)
      }

      let followedUserIds: string[] | null = null
      if (activeTab === 'following') {
        if (!uid) return
        const { data: followData } = await supabase
          .from('follows').select('following_id').eq('follower_id', uid)
        followedUserIds = (followData ?? []).map((f: { following_id: string }) => f.following_id)
        if (followedUserIds.length === 0) return
      }

      let recsRaw: Recommendation[] | null = null
      if (activeTab === 'discovery') {
        const { data: rpcData, error: rpcError } = await supabase
          .rpc('get_discovery_feed', { p_category: cat, p_user_id: uid ?? null, p_limit: 30, p_offset: 0 })
        if (!rpcError) {
          recsRaw = rpcData
        } else {
          // RPC not yet deployed — fall back to recency order
          const { data } = await supabase
            .from('recommendations').select('*').eq('category', cat)
            .order('created_at', { ascending: false }).limit(30)
          recsRaw = data
        }
      } else {
        const { data } = await supabase
          .from('recommendations').select('*').eq('category', cat)
          .in('user_id', followedUserIds!)
          .order('created_at', { ascending: false }).limit(30)
        recsRaw = data
      }

      const baseRecs = recsRaw ?? []
      const profileMap: Record<string, Profile> = {}
      if (baseRecs.length > 0) {
        const userIds = [...new Set(baseRecs.map((r: { user_id: string }) => r.user_id))]
        const { data: profilesData } = await supabase
          .from('profiles').select('id, name, handle, avatar_url').in('id', userIds)
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
      const [{ data: allLikes }, { data: allComments }, { data: myLikes }, { data: myBookmarks }] = await Promise.all([
        supabase.from('likes').select('recommendation_id').in('recommendation_id', ids),
        supabase.from('comments').select('recommendation_id').in('recommendation_id', ids),
        uid ? supabase.from('likes').select('recommendation_id').eq('user_id', uid).in('recommendation_id', ids) : Promise.resolve({ data: [] }),
        uid ? supabase.from('bookmarks').select('recommendation_id').eq('user_id', uid).in('recommendation_id', ids) : Promise.resolve({ data: [] }),
      ])

      const lc: Record<string, number> = {}
      const cc: Record<string, number> = {}
      for (const id of ids) { lc[id] = 0; cc[id] = 0 }
      for (const l of allLikes ?? []) lc[l.recommendation_id] = (lc[l.recommendation_id] ?? 0) + 1
      for (const c of allComments ?? []) cc[c.recommendation_id] = (cc[c.recommendation_id] ?? 0) + 1
      setLikeCounts(lc)
      setCommentCounts(cc)
      setUserLikes(new Set((myLikes ?? []).map((l: { recommendation_id: string }) => l.recommendation_id)))
      setUserBookmarks(new Set((myBookmarks ?? []).map((b: { recommendation_id: string }) => b.recommendation_id)))
    } finally {
      setLoading(false)
    }
  }, [cat, supabase, activeTab])

  useEffect(() => { fetchFeed() }, [fetchFeed])

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore) return
    setLoadingMore(true)
    try {
      const uid = currentUserId
      let followedUserIds: string[] | null = null
      if (activeTab === 'following') {
        if (!uid) return
        const { data: followData } = await supabase
          .from('follows').select('following_id').eq('follower_id', uid)
        followedUserIds = (followData ?? []).map((f: { following_id: string }) => f.following_id)
        if (followedUserIds.length === 0) return
      }

      const offset = recs.length
      let recsRaw: Recommendation[] | null = null
      if (activeTab === 'discovery') {
        const { data: rpcData, error: rpcError } = await supabase
          .rpc('get_discovery_feed', { p_category: cat, p_user_id: uid ?? null, p_limit: 30, p_offset: offset })
        if (!rpcError) {
          recsRaw = rpcData
        } else {
          const { data } = await supabase
            .from('recommendations').select('*').eq('category', cat)
            .order('created_at', { ascending: false }).range(offset, offset + 29)
          recsRaw = data
        }
      } else {
        const { data } = await supabase
          .from('recommendations').select('*').eq('category', cat)
          .in('user_id', followedUserIds!)
          .order('created_at', { ascending: false }).range(offset, offset + 29)
        recsRaw = data
      }

      const newBaseRecs = recsRaw ?? []
      setHasMore(newBaseRecs.length === 30)
      if (newBaseRecs.length === 0) return

      const profileMap: Record<string, Profile> = {}
      const userIds = [...new Set(newBaseRecs.map((r: { user_id: string }) => r.user_id))]
      const { data: profilesData } = await supabase
        .from('profiles').select('id, name, handle, avatar_url').in('id', userIds)
      for (const p of profilesData ?? []) {
        profileMap[p.id] = { name: p.name, handle: p.handle, avatar_url: p.avatar_url }
      }

      const newRecs: Recommendation[] = newBaseRecs.map((r: Recommendation) => ({
        ...r, profiles: profileMap[r.user_id] ?? null,
      }))
      const ids = newRecs.map((r) => r.id)
      const [{ data: allLikes }, { data: allComments }, { data: myLikes }, { data: myBookmarks }] = await Promise.all([
        supabase.from('likes').select('recommendation_id').in('recommendation_id', ids),
        supabase.from('comments').select('recommendation_id').in('recommendation_id', ids),
        uid ? supabase.from('likes').select('recommendation_id').eq('user_id', uid).in('recommendation_id', ids) : Promise.resolve({ data: [] }),
        uid ? supabase.from('bookmarks').select('recommendation_id').eq('user_id', uid).in('recommendation_id', ids) : Promise.resolve({ data: [] }),
      ])

      const lc: Record<string, number> = {}
      const cc: Record<string, number> = {}
      for (const id of ids) { lc[id] = 0; cc[id] = 0 }
      for (const l of allLikes ?? []) lc[l.recommendation_id] = (lc[l.recommendation_id] ?? 0) + 1
      for (const c of allComments ?? []) cc[c.recommendation_id] = (cc[c.recommendation_id] ?? 0) + 1

      setRecs(prev => [...prev, ...newRecs])
      setLikeCounts(prev => ({ ...prev, ...lc }))
      setCommentCounts(prev => ({ ...prev, ...cc }))
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
    } finally {
      setLoadingMore(false)
    }
  }, [recs.length, hasMore, loadingMore, cat, supabase, activeTab, currentUserId])

  useEffect(() => {
    document.body.style.overflow = selectedGroup ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [selectedGroup])

  // ── Like / Bookmark toggles ────────────────────────────────────────────────

  async function toggleLike(e: React.MouseEvent, recId: string) {
    e.stopPropagation()
    if (!currentUserId) return
    const liked = userLikes.has(recId)
    setUserLikes((prev) => { const next = new Set(prev); if (liked) next.delete(recId); else next.add(recId); return next })
    setLikeCounts((prev) => ({ ...prev, [recId]: (prev[recId] ?? 0) + (liked ? -1 : 1) }))
    if (liked) {
      await supabase.from('likes').delete().eq('user_id', currentUserId).eq('recommendation_id', recId)
    } else {
      await supabase.from('likes').insert({ user_id: currentUserId, recommendation_id: recId })
      const recAuthorId = recs.find(r => r.id === recId)?.user_id ?? null
      if (recAuthorId && recAuthorId !== currentUserId) {
        void supabase.from('notifications').insert({ user_id: recAuthorId, actor_id: currentUserId, type: 'like', rec_id: recId, read: false })
      }
    }
  }

  async function toggleBookmark(e: React.MouseEvent, recId: string) {
    e.stopPropagation()
    if (!currentUserId) return
    const bookmarked = userBookmarks.has(recId)
    setUserBookmarks((prev) => { const next = new Set(prev); if (bookmarked) next.delete(recId); else next.add(recId); return next })
    if (bookmarked) {
      await supabase.from('bookmarks').delete().eq('user_id', currentUserId).eq('recommendation_id', recId)
    } else {
      await supabase.from('bookmarks').insert({ user_id: currentUserId, recommendation_id: recId })
      const recAuthorId = recs.find(r => r.id === recId)?.user_id ?? null
      if (recAuthorId && recAuthorId !== currentUserId) {
        void supabase.from('notifications').insert({ user_id: recAuthorId, actor_id: currentUserId, type: 'bookmark', rec_id: recId, read: false })
      }
    }
  }

  // ── Grouped recs + modal handlers ──────────────────────────────────────────

  const groupedRecs = useMemo(() => {
    const groups = groupRecommendations(recs, likeCounts, commentCounts, userLikes, userBookmarks)
    if (activeTab === 'discovery') {
      const msPerDay = 86_400_000
      groups.sort((a, b) => {
        const score = (g: typeof a) =>
          g.total_likes * 3 +
          g.total_comments * 2 +
          10 / (1 + (Date.now() - new Date(g.most_recent_date).getTime()) / msPerDay)
        return score(b) - score(a)
      })
    }
    return groups
  }, [recs, likeCounts, commentCounts, userLikes, userBookmarks, activeTab])

  function closeModal() { setSelectedGroup(null); setFocusOnOpen(false) }

  function handleLikeToggle(recId: string, wasLiked: boolean) {
    setUserLikes(prev => { const next = new Set(prev); if (wasLiked) next.delete(recId); else next.add(recId); return next })
    setLikeCounts(prev => ({ ...prev, [recId]: Math.max(0, (prev[recId] ?? 0) + (wasLiked ? -1 : 1)) }))
  }

  function handleBookmarkToggle(recId: string, wasBookmarked: boolean) {
    setUserBookmarks(prev => { const next = new Set(prev); if (wasBookmarked) next.delete(recId); else next.add(recId); return next })
  }

  useEffect(() => {
    function onNewPost(e: Event) {
      const evt = e as CustomEvent<{ category: string }>
      if (evt.detail?.category === cat) fetchFeed()
    }
    window.addEventListener('notable:new-post', onNewPost)
    return () => window.removeEventListener('notable:new-post', onNewPost)
  }, [cat, fetchFeed])

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
        supabase.from('profiles').select('id, name, handle, avatar_url').eq('id', recData.user_id).maybeSingle(),
        supabase.from('likes').select('*', { count: 'exact', head: true }).eq('recommendation_id', recId),
        uid ? supabase.from('likes').select('id').eq('recommendation_id', recId).eq('user_id', uid).maybeSingle() : Promise.resolve({ data: null }),
        supabase.from('comments').select('*', { count: 'exact', head: true }).eq('recommendation_id', recId),
      ])

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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <SkeletonCard /><SkeletonCard /><SkeletonCard />
          </div>
        ) : groupedRecs.length === 0 ? (
          activeTab === 'following' ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: '80px', gap: '12px', textAlign: 'center' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke={theme.colors.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="36" height="36">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
              </svg>
              <p className="font-display" style={{ fontSize: '20px', fontWeight: 600, color: theme.colors.textPrimary, marginTop: '4px' }}>Nothing here yet</p>
              <p className="font-body" style={{ color: theme.colors.textMuted, fontSize: '14px', maxWidth: '260px', lineHeight: '1.5' }}>
                Follow people to see their recommendations here. Switch to Discovery to find people to follow.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: '80px', gap: '16px', textAlign: 'center' }}>
              <EmptyStateIcon category={cat} />
              <p className="font-display" style={{ fontSize: '22px', fontWeight: 600, color: theme.colors.textPrimary, marginTop: '8px' }}>No recommendations yet</p>
              <p className="font-body" style={{ color: theme.colors.textMuted, fontSize: '14px' }}>Be the first to share something you love</p>
            </div>
          )
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {groupedRecs.map((group, idx) => (
              <GroupedCard
                key={group.groupKey}
                group={group}
                accentColor={accentColor}
                tab={activeTab}
                showWhisper={idx === 0 && whisperShouldShow('grouped-card')}
                onLike={(e) => toggleLike(e, group.lead_rec_id)}
                onBookmark={(e) => toggleBookmark(e, group.lead_rec_id)}
                onClick={() => { setFocusOnOpen(false); setSelectedGroup(group) }}
                onCommentClick={(e) => { e.stopPropagation(); setFocusOnOpen(true); setSelectedGroup(group) }}
              />
            ))}
          </div>
        )}

        {hasMore && !loading && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '24px' }}>
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="font-body"
              style={{
                padding: '12px 28px', background: theme.colors.surface, border: '1px solid rgba(0,0,0,0.12)',
                borderRadius: '999px', fontSize: '14px', fontWeight: 500, color: theme.colors.textPrimary,
                cursor: loadingMore ? 'default' : 'pointer',
                fontFamily: 'var(--font-body, "DM Sans", sans-serif)',
                transition: 'background 0.15s, border-color 0.15s', opacity: loadingMore ? 0.7 : 1,
              }}
            >
              {loadingMore ? 'Loading…' : 'Load more recommendations'}
            </button>
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
        />
      )}
    </>
  )
}

