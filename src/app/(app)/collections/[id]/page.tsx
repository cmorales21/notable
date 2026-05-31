'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Avatar, RecModal, sortComments, fetchComments } from '@/app/components/CategoryFeed'
import { theme, getCategoryColor } from '@/app/lib/theme'
import { useToast } from '@/app/components/Toast'
import type { Recommendation, RecComment, RecProfile } from '@/app/lib/types'
import {
  type CollectionData, type CollectionItemRow, CATEGORY_LABELS,
} from '@/app/components/collections/types'
import { AddItemsPicker } from '@/app/components/collections/AddItemsPicker'
import { CollectionGridTile } from '@/app/components/collections/CollectionGridTile'
import { EditCollectionModal } from '@/app/components/collections/EditCollectionModal'
import { UndoBar } from '@/app/components/collections/UndoBar'

// ─── Page-only types ──────────────────────────────────────────────────────────

interface CollectionOwner {
  id: string
  name: string | null
  handle: string | null
  avatar_url: string | null
  profile_private?: boolean | null
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CollectionPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = useRef(createClient())
  const toast = useToast()

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [accessDenied, setAccessDenied] = useState<'private_collection' | 'private_profile' | null>(null)

  const [collection, setCollection] = useState<CollectionData | null>(null)
  const [owner, setOwner] = useState<CollectionOwner | null>(null)
  const [items, setItems] = useState<CollectionItemRow[]>([])

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserProfile, setCurrentUserProfile] = useState<RecProfile | null>(null)
  const [isOwnCollection, setIsOwnCollection] = useState(false)

  // Collection-level like / bookmark (for others viewing public collections)
  const [collectionLiked, setCollectionLiked] = useState(false)
  const [collectionLikeCount, setCollectionLikeCount] = useState(0)
  const [collectionBookmarked, setCollectionBookmarked] = useState(false)

  // Edit / delete modals
  const [editOpen, setEditOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Add items picker
  const [addItemsOpen, setAddItemsOpen] = useState(false)

  // Undo remove
  const pendingRemoveRef = useRef<{
    id: string
    item: CollectionItemRow
    timer: ReturnType<typeof setTimeout>
  } | null>(null)
  const [undoVisible, setUndoVisible] = useState(false)

  // Rec modal state
  const [selectedRec, setSelectedRec] = useState<Recommendation | null>(null)
  const [modalLiked, setModalLiked] = useState(false)
  const [modalBookmarked, setModalBookmarked] = useState(false)
  const [modalLikeCount, setModalLikeCount] = useState(0)
  const [modalCommentCount, setModalCommentCount] = useState(0)
  const [modalComments, setModalComments] = useState<RecComment[]>([])
  const [modalLoadingComments, setModalLoadingComments] = useState(false)
  const [modalCommentInput, setModalCommentInput] = useState('')
  const [modalSubmittingComment, setModalSubmittingComment] = useState(false)
  const commentInputRef = useRef<HTMLTextAreaElement | null>(null)

  // ── Load data ──────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [{ data: { user } }, { data: colData, error: colErr }] = await Promise.all([
        supabase.current.auth.getUser(),
        supabase.current.from('collections').select('*').eq('id', id).single(),
      ])

      if (colErr || !colData) { setNotFound(true); return }

      const uid = user?.id ?? null
      setCurrentUserId(uid)
      const isOwner = uid === colData.user_id
      setIsOwnCollection(isOwner)

      const [{ data: ownerData }, { data: myProfile }] = await Promise.all([
        supabase.current.from('profiles').select('id, name, handle, avatar_url, profile_private').eq('id', colData.user_id).single(),
        uid ? supabase.current.from('profiles').select('name, handle, avatar_url').eq('id', uid).maybeSingle() : Promise.resolve({ data: null }),
      ])
      setOwner(ownerData)
      setCurrentUserProfile(myProfile)

      if (!isOwner) {
        if (colData.is_private) { setAccessDenied('private_collection'); return }
        if (ownerData?.profile_private) {
          let isFollowing = false
          if (uid) {
            const { data: followRow } = await supabase.current.from('follows').select('id, status')
              .eq('follower_id', uid).eq('following_id', colData.user_id).maybeSingle()
            isFollowing = (followRow as { id: string; status: string } | null)?.status === 'accepted'
          }
          if (!isFollowing) { setAccessDenied('private_profile'); return }
        }
      }

      setCollection(colData as CollectionData)

      // Fetch items + collection like/bookmark in parallel
      // Note: no FK exists between recommendations→profiles in PostgREST, so profiles are fetched separately
      const [itemsResult, { count: likeCount }, myLikeRes, myBmRes] = await Promise.all([
        supabase.current
          .from('collection_items')
          .select(`
            id,
            recommendation_id,
            added_at,
            recommendations(
              id, user_id, category, title, description, image_url, external_url, item_id, created_at
            )
          `)
          .eq('collection_id', id)
          .order('added_at', { ascending: false }),
        supabase.current.from('collection_likes').select('*', { count: 'exact', head: true }).eq('collection_id', id),
        uid && !isOwner
          ? supabase.current.from('collection_likes').select('id').eq('collection_id', id).eq('user_id', uid).maybeSingle()
          : Promise.resolve({ data: null }),
        uid && !isOwner
          ? supabase.current.from('collection_bookmarks').select('id').eq('collection_id', id).eq('user_id', uid).maybeSingle()
          : Promise.resolve({ data: null }),
      ])

      setCollectionLikeCount(likeCount ?? 0)
      setCollectionLiked(!!myLikeRes.data)
      setCollectionBookmarked(!!myBmRes.data)

      const { data: itemsData, error: itemsErr } = itemsResult
      if (itemsErr) console.error('[collection_items]', itemsErr)

      const validRows = (itemsData ?? []).filter(
        (row: Record<string, unknown>) => row.recommendations != null
      )

      // Batch-fetch profiles (no FK join exists between recommendations and profiles)
      const userIds = [...new Set(validRows.map((row: Record<string, unknown>) =>
        (row.recommendations as Record<string, unknown>).user_id as string
      ))]
      const profileMap: Record<string, RecProfile> = {}
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase.current
          .from('profiles').select('id, name, handle, avatar_url').in('id', userIds)
        for (const p of (profilesData ?? []) as Array<{ id: string } & RecProfile>) {
          profileMap[p.id] = { name: p.name, handle: p.handle, avatar_url: p.avatar_url }
        }
      }

      const rows: CollectionItemRow[] = validRows.map((row: Record<string, unknown>) => {
        const r = row.recommendations as Record<string, unknown>
        return {
          id: row.id as string,
          recommendation_id: row.recommendation_id as string,
          added_at: row.added_at as string,
          rec: {
            id: r.id as string,
            user_id: r.user_id as string,
            category: r.category as string,
            title: r.title as string,
            description: (r.description as string) ?? '',
            image_url: r.image_url as string | null,
            external_url: r.external_url as string | null,
            item_id: r.item_id as string | null,
            created_at: r.created_at as string,
            profiles: profileMap[r.user_id as string] ?? null,
          } satisfies Recommendation,
        }
      })
      setItems(rows)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  // ── Scroll lock ─────────────────────────────────────────────────────────────

  useEffect(() => {
    document.body.style.overflow = (selectedRec || editOpen || deleteConfirm || addItemsOpen) ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [selectedRec, editOpen, deleteConfirm, addItemsOpen])

  // ── Collection like / bookmark ───────────────────────────────────────────────

  async function handleCollectionLike() {
    if (!currentUserId || isOwnCollection || !owner) return
    if (collectionLiked) {
      await supabase.current.from('collection_likes').delete().eq('collection_id', id).eq('user_id', currentUserId)
      setCollectionLiked(false)
      setCollectionLikeCount(c => c - 1)
    } else {
      await supabase.current.from('collection_likes').insert({ collection_id: id, user_id: currentUserId })
      setCollectionLiked(true)
      setCollectionLikeCount(c => c + 1)
      const { data: ownerPrefs } = await supabase.current
        .from('profiles').select('notify_likes').eq('id', owner.id).single()
      if (ownerPrefs?.notify_likes !== false) {
        supabase.current.from('notifications').insert({
          user_id: owner.id,
          actor_id: currentUserId,
          type: 'collection_like',
          collection_id: id,
          read: false,
        })
      }
    }
  }

  async function handleCollectionBookmark() {
    if (!currentUserId || isOwnCollection || !owner) return
    if (collectionBookmarked) {
      await supabase.current.from('collection_bookmarks').delete().eq('collection_id', id).eq('user_id', currentUserId)
      setCollectionBookmarked(false)
    } else {
      await supabase.current.from('collection_bookmarks').insert({ collection_id: id, user_id: currentUserId })
      setCollectionBookmarked(true)
      const { data: ownerPrefs } = await supabase.current
        .from('profiles').select('notify_bookmarks').eq('id', owner.id).single()
      if (ownerPrefs?.notify_bookmarks !== false) {
        supabase.current.from('notifications').insert({
          user_id: owner.id,
          actor_id: currentUserId,
          type: 'collection_bookmark',
          collection_id: id,
          read: false,
        })
      }
    }
  }

  // ── Remove item with undo ────────────────────────────────────────────────────

  function handleRemoveItem(itemId: string) {
    const item = items.find(i => i.id === itemId)
    if (!item) return

    // Commit any existing pending delete immediately
    if (pendingRemoveRef.current) {
      clearTimeout(pendingRemoveRef.current.timer)
      supabase.current.from('collection_items').delete().eq('id', pendingRemoveRef.current.id)
      pendingRemoveRef.current = null
    }

    setItems(prev => prev.filter(i => i.id !== itemId))
    setUndoVisible(true)

    const timer = setTimeout(async () => {
      await supabase.current.from('collection_items').delete().eq('id', itemId)
      pendingRemoveRef.current = null
      setUndoVisible(false)
    }, 4000)

    pendingRemoveRef.current = { id: itemId, item, timer }
  }

  function handleUndo() {
    if (!pendingRemoveRef.current) return
    clearTimeout(pendingRemoveRef.current.timer)
    const restored = pendingRemoveRef.current.item
    setItems(prev => {
      const next = [...prev, restored]
      return next.sort((a, b) => b.added_at.localeCompare(a.added_at))
    })
    pendingRemoveRef.current = null
    setUndoVisible(false)
  }

  function handleUndoDismiss() {
    if (!pendingRemoveRef.current) return
    clearTimeout(pendingRemoveRef.current.timer)
    supabase.current.from('collection_items').delete().eq('id', pendingRemoveRef.current.id)
    pendingRemoveRef.current = null
    setUndoVisible(false)
  }

  // ── Delete collection ────────────────────────────────────────────────────────

  async function handleDeleteCollection() {
    if (!currentUserId || !isOwnCollection) return
    setDeleting(true)
    await supabase.current.from('collections').delete().eq('id', id).eq('user_id', currentUserId)
    toast('Collection deleted')
    router.back()
  }

  // ── Rec modal ────────────────────────────────────────────────────────────────

  async function openRecModal(rec: Recommendation) {
    setSelectedRec(rec)
    setModalCommentInput('')
    setModalLoadingComments(true)

    const [comments, likesRes, myLikeRes, myBmRes] = await Promise.all([
      fetchComments(supabase.current, rec.id),
      supabase.current.from('likes').select('id').eq('recommendation_id', rec.id),
      currentUserId
        ? supabase.current.from('likes').select('id').eq('user_id', currentUserId).eq('recommendation_id', rec.id).maybeSingle()
        : Promise.resolve({ data: null }),
      currentUserId
        ? supabase.current.from('bookmarks').select('id').eq('user_id', currentUserId).eq('recommendation_id', rec.id).maybeSingle()
        : Promise.resolve({ data: null }),
    ])

    setModalComments(comments)
    setModalLikeCount(likesRes.data?.length ?? 0)
    setModalLiked(!!myLikeRes.data)
    setModalBookmarked(!!myBmRes.data)
    setModalCommentCount(comments.length)
    setModalLoadingComments(false)
  }

  async function handleModalLike(e: React.MouseEvent) {
    e.stopPropagation()
    if (!currentUserId || !selectedRec) return
    if (modalLiked) {
      await supabase.current.from('likes').delete().eq('user_id', currentUserId).eq('recommendation_id', selectedRec.id)
      setModalLiked(false)
      setModalLikeCount(c => c - 1)
    } else {
      await supabase.current.from('likes').insert({ user_id: currentUserId, recommendation_id: selectedRec.id })
      setModalLiked(true)
      setModalLikeCount(c => c + 1)
    }
  }

  async function handleModalBookmark(e: React.MouseEvent) {
    e.stopPropagation()
    if (!currentUserId || !selectedRec) return
    if (modalBookmarked) {
      await supabase.current.from('bookmarks').delete().eq('user_id', currentUserId).eq('recommendation_id', selectedRec.id)
      setModalBookmarked(false)
    } else {
      await supabase.current.from('bookmarks').insert({ user_id: currentUserId, recommendation_id: selectedRec.id })
      setModalBookmarked(true)
    }
  }

  async function handleModalComment(e: React.FormEvent) {
    e.preventDefault()
    if (!currentUserId || !selectedRec || !modalCommentInput.trim()) return
    setModalSubmittingComment(true)
    const text = modalCommentInput.trim()
    setModalCommentInput('')
    const { data: inserted, error } = await supabase.current
      .from('comments')
      .insert({ user_id: currentUserId, recommendation_id: selectedRec.id, text })
      .select('*').single()
    if (!error && inserted) {
      const newComment: RecComment = { ...inserted, profiles: currentUserProfile, comment_likes: [] }
      setModalComments(prev => sortComments([...prev, newComment]))
      setModalCommentCount(c => c + 1)
    }
    setModalSubmittingComment(false)
  }

  // ── Derived values ──────────────────────────────────────────────────────────

  const accentColor = collection ? getCategoryColor(collection.category) : theme.colors.textMuted

  // ── Early returns ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '14px 20px 48px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '28px' }}>
          <div className="skeleton-pulse" style={{ width: 32, height: 32, borderRadius: '8px', background: '#efe9e0' }} />
          <div className="skeleton-pulse" style={{ width: '40%', height: 20, borderRadius: 8, background: '#efe9e0' }} />
        </div>
        <div className="skeleton-pulse" style={{ height: 36, width: '60%', borderRadius: 8, background: '#efe9e0', marginBottom: '10px' }} />
        <div className="skeleton-pulse" style={{ height: 16, width: '80%', borderRadius: 6, background: '#efe9e0', marginBottom: '24px' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="skeleton-pulse" style={{ aspectRatio: '3/4', borderRadius: '10px', background: '#efe9e0' }} />
          ))}
        </div>
      </div>
    )
  }

  if (notFound) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '12px' }}>
        <p className="font-display" style={{ fontSize: '1.4rem', fontWeight: 600, color: theme.colors.textPrimary }}>Collection not found</p>
        <p className="font-body" style={{ color: theme.colors.textMuted, fontSize: '14px' }}>This collection may have been deleted.</p>
        <button onClick={() => router.back()} className="font-body" style={{ marginTop: '8px', background: 'transparent', border: '1px solid rgba(0,0,0,0.15)', borderRadius: '20px', padding: '7px 20px', color: theme.colors.textMuted, fontSize: '13px', cursor: 'pointer' }}>
          Go back
        </button>
      </div>
    )
  }

  if (accessDenied) {
    const isPrivateProfile = accessDenied === 'private_profile'
    return (
      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '14px 20px 48px' }}>
        <button
          onClick={() => router.back()}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', marginBottom: '20px', color: theme.colors.textMuted, display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '40px', gap: '10px', textAlign: 'center' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke={theme.colors.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="36" height="36">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
          <p className="font-display" style={{ fontSize: '1.15rem', fontWeight: 600, color: theme.colors.textPrimary, marginTop: '6px' }}>
            {isPrivateProfile ? 'This profile is private' : 'This collection is private'}
          </p>
          <p className="font-body" style={{ color: theme.colors.textMuted, fontSize: '14px', maxWidth: '260px', lineHeight: '1.55' }}>
            {isPrivateProfile
              ? `Follow ${owner?.name ?? `@${owner?.handle}`} to see their collections.`
              : 'This collection is only visible to its owner.'}
          </p>
          {owner?.handle && (
            <Link
              href={`/profile/${owner.handle}`}
              className="font-body"
              style={{ marginTop: '8px', color: theme.colors.textMuted, fontSize: '13px', textDecoration: 'underline', textUnderlineOffset: '3px' }}
            >
              View profile
            </Link>
          )}
        </div>
      </div>
    )
  }

  if (!collection || !owner) return null

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: translateY(0) } }
        .col-item-card { animation: fadeIn 0.25s ease both; }
        .col-item-card:hover { box-shadow: 0 4px 16px rgba(58,42,26,0.1); }
        @media (min-width: 768px) { .undo-bar { bottom: 32px !important; } }
      `}</style>

      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '14px 20px 80px' }}>

        {/* ── Back button ─────────────────────────────────────────────── */}
        <div style={{ marginBottom: '20px' }}>
          <button
            onClick={() => router.back()}
            className="font-body"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '6px 0', color: theme.colors.textMuted,
              display: 'flex', alignItems: 'center', gap: '6px',
              fontSize: '14px', transition: 'color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = theme.colors.textPrimary }}
            onMouseLeave={e => { e.currentTarget.style.color = theme.colors.textMuted }}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        </div>

        {/* ── Collection header ────────────────────────────────────────── */}
        <div style={{ marginBottom: '28px' }}>

          {/* Badge row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
            <span
              className="font-body"
              style={{
                display: 'inline-block',
                background: accentColor, color: '#ffffff',
                fontSize: '11px', fontWeight: 600,
                padding: '3px 10px', borderRadius: '20px',
                letterSpacing: '0.03em',
              }}
            >
              {CATEGORY_LABELS[collection.category] ?? collection.category}
            </span>
            {collection.is_private && (
              <span className="font-body" style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                background: 'rgba(0,0,0,0.07)', color: theme.colors.textMuted,
                fontSize: '11px', fontWeight: 500,
                padding: '3px 9px', borderRadius: '20px',
              }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="10" height="10">
                  <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
                Private
              </span>
            )}
          </div>

          {/* Collection name */}
          <h1
            className="font-display"
            style={{
              fontSize: 'clamp(1.6rem, 5vw, 2.2rem)', fontWeight: 600,
              color: theme.colors.textPrimary, letterSpacing: '-0.02em',
              lineHeight: 1.2, marginBottom: collection.description ? '8px' : '14px',
            }}
          >
            {collection.name}
          </h1>

          {/* Description */}
          {collection.description && (
            <p
              className="font-body"
              style={{
                fontSize: '15px', color: theme.colors.textMuted,
                lineHeight: 1.6, marginBottom: '14px',
              }}
            >
              {collection.description}
            </p>
          )}

          {/* Owner + item count + actions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>

            {/* Owner info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {owner.handle ? (
                <Link href={`/profile/${owner.handle}`} style={{ lineHeight: 0 }}>
                  <Avatar url={owner.avatar_url} name={owner.name} size={28} />
                </Link>
              ) : (
                <Avatar url={owner.avatar_url} name={owner.name} size={28} />
              )}
              <div>
                {owner.handle ? (
                  <Link href={`/profile/${owner.handle}`} className="font-body" style={{ color: theme.colors.textPrimary, fontSize: '14px', fontWeight: 500, textDecoration: 'none' }}>
                    {owner.name ?? owner.handle}
                  </Link>
                ) : (
                  <span className="font-body" style={{ color: theme.colors.textPrimary, fontSize: '14px', fontWeight: 500 }}>
                    {owner.name ?? 'Unknown'}
                  </span>
                )}
                {owner.handle && (
                  <span className="font-body" style={{ color: theme.colors.textMuted, fontSize: '13px' }}> · @{owner.handle}</span>
                )}
              </div>
              <span className="font-body" style={{ color: theme.colors.textMuted, fontSize: '13px', marginLeft: '4px' }}>
                · {items.length} {items.length === 1 ? 'item' : 'items'}
              </span>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {isOwnCollection ? (
                <>
                  {/* Add Items button */}
                  <button
                    onClick={() => setAddItemsOpen(true)}
                    className="font-body"
                    style={{
                      display: 'flex', alignItems: 'center', gap: '5px',
                      padding: '6px 12px', borderRadius: '20px', border: 'none',
                      background: accentColor, color: '#ffffff',
                      fontSize: '13px', fontWeight: 600,
                      cursor: 'pointer', transition: 'opacity 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = '0.85' }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
                  >
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    Add Items
                  </button>
                  {/* Edit button */}
                  <button
                    onClick={() => setEditOpen(true)}
                    aria-label="Edit collection"
                    style={{
                      width: '34px', height: '34px', borderRadius: '50%',
                      background: 'rgba(0,0,0,0.06)', border: 'none',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: theme.colors.textMuted, transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.1)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.06)' }}
                  >
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                    </svg>
                  </button>
                  {/* Delete button */}
                  <button
                    onClick={() => setDeleteConfirm(true)}
                    aria-label="Delete collection"
                    style={{
                      width: '34px', height: '34px', borderRadius: '50%',
                      background: 'rgba(0,0,0,0.06)', border: 'none',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: theme.colors.textMuted, transition: 'background 0.15s, color 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(224,85,85,0.1)'; e.currentTarget.style.color = theme.colors.error }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.06)'; e.currentTarget.style.color = theme.colors.textMuted }}
                  >
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
                    </svg>
                  </button>
                </>
              ) : currentUserId ? (
                <>
                  {/* Collection like button */}
                  <button
                    onClick={handleCollectionLike}
                    className="font-body"
                    style={{
                      display: 'flex', alignItems: 'center', gap: '5px',
                      padding: '6px 12px', borderRadius: '20px', border: 'none',
                      background: collectionLiked ? `${accentColor}18` : 'rgba(0,0,0,0.06)',
                      color: collectionLiked ? accentColor : theme.colors.textMuted,
                      fontSize: '13px', fontWeight: collectionLiked ? 600 : 400,
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    <svg viewBox="0 0 24 24" width="15" height="15" fill={collectionLiked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                    </svg>
                    {collectionLikeCount > 0 ? collectionLikeCount : 'Like'}
                  </button>
                  {/* Collection bookmark button */}
                  <button
                    onClick={handleCollectionBookmark}
                    aria-label={collectionBookmarked ? 'Remove bookmark' : 'Bookmark collection'}
                    style={{
                      width: '34px', height: '34px', borderRadius: '50%',
                      background: collectionBookmarked ? `${accentColor}18` : 'rgba(0,0,0,0.06)',
                      border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: collectionBookmarked ? accentColor : theme.colors.textMuted,
                      transition: 'all 0.15s',
                    }}
                  >
                    <svg viewBox="0 0 24 24" width="15" height="15" fill={collectionBookmarked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
                    </svg>
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>

        {/* ── Divider ──────────────────────────────────────────────────── */}
        <div style={{ height: '1px', background: 'rgba(0,0,0,0.07)', marginBottom: '20px' }} />

        {/* ── Items list ───────────────────────────────────────────────── */}
        {items.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '60px', gap: '10px', textAlign: 'center' }}>
            <div style={{
              width: '52px', height: '52px', borderRadius: '14px',
              background: `${accentColor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke={accentColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z" />
                <path d="M16 3H8a2 2 0 00-2 2v2h12V5a2 2 0 00-2-2z" />
              </svg>
            </div>
            <p className="font-display" style={{ fontSize: '1.15rem', fontWeight: 600, color: theme.colors.textPrimary, marginTop: '6px' }}>
              This collection is empty
            </p>
            <p className="font-body" style={{ color: theme.colors.textMuted, fontSize: '14px', maxWidth: '280px', lineHeight: '1.55' }}>
              {isOwnCollection
                ? 'Tap + Add Items above to start adding recommendations.'
                : `${owner.name ?? 'This person'} hasn't added anything here yet.`}
            </p>
          </div>
        ) : (
          <>
            <style>{`
              @media (max-width: 480px) { .coll-items-grid { grid-template-columns: repeat(2, 1fr) !important; } }
            `}</style>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }} className="coll-items-grid">
              {items.map(item => (
                <CollectionGridTile
                  key={item.id}
                  rec={item.rec}
                  accentColor={accentColor}
                  onRemove={isOwnCollection ? () => handleRemoveItem(item.id) : undefined}
                  onClick={() => openRecModal(item.rec)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Undo remove bar ───────────────────────────────────────────────── */}
      {undoVisible && collection && (
        <UndoBar
          collectionName={collection.name}
          onUndo={handleUndo}
          onDismiss={handleUndoDismiss}
        />
      )}

      {/* ── Edit collection modal ──────────────────────────────────────────── */}
      {editOpen && collection && (
        <EditCollectionModal
          collection={collection}
          onClose={() => setEditOpen(false)}
          onSave={updates => {
            setCollection(prev => prev ? { ...prev, ...updates } : prev)
            setEditOpen(false)
            toast('Collection updated')
          }}
        />
      )}

      {/* ── Delete confirmation ────────────────────────────────────────────── */}
      {deleteConfirm && (
        <div
          onClick={() => !deleting && setDeleteConfirm(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 450,
            background: 'rgba(0,0,0,0.65)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: '400px',
              background: theme.colors.surface, borderRadius: '16px',
              border: `1px solid ${theme.colors.border}`,
              padding: '28px 24px',
              boxShadow: '0 32px 80px rgba(58,42,26,0.5)',
            }}
          >
            <h3 className="font-display" style={{ fontSize: '1.05rem', fontWeight: 600, color: theme.colors.textPrimary, marginBottom: '12px' }}>
              Delete &ldquo;{collection.name}&rdquo;?
            </h3>
            <p className="font-body" style={{ fontSize: '14px', color: theme.colors.textMuted, lineHeight: '1.55', marginBottom: '24px' }}>
              This will remove the collection and all its items, but won&apos;t delete any of the original recommendations or unbookmark anything.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeleteConfirm(false)}
                disabled={deleting}
                className="font-body"
                style={{ background: 'rgba(0,0,0,0.08)', border: 'none', borderRadius: '8px', color: theme.colors.textMuted, fontSize: '14px', padding: '9px 18px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteCollection}
                disabled={deleting}
                className="font-body"
                style={{
                  background: theme.colors.error, border: 'none', borderRadius: '8px',
                  color: '#fff', fontSize: '14px', fontWeight: 600,
                  padding: '9px 18px', cursor: deleting ? 'default' : 'pointer',
                  opacity: deleting ? 0.7 : 1, transition: 'opacity 0.15s',
                }}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Items picker ─────────────────────────────────────────────── */}
      {addItemsOpen && collection && currentUserId && (
        <AddItemsPicker
          collection={collection}
          currentUserId={currentUserId}
          existingIds={new Set(items.map(i => i.recommendation_id))}
          accentColor={accentColor}
          supabase={supabase.current}
          onClose={() => setAddItemsOpen(false)}
          onAdded={(newItems) => {
            setItems(prev => [...newItems, ...prev])
            toast(`Added ${newItems.length} item${newItems.length !== 1 ? 's' : ''}`)
            setAddItemsOpen(false)
          }}
        />
      )}

      {/* ── Rec modal ─────────────────────────────────────────────────────── */}
      {selectedRec && (
        <RecModal
          rec={selectedRec}
          accentColor={getCategoryColor(selectedRec.category)}
          liked={modalLiked}
          bookmarked={modalBookmarked}
          likeCount={modalLikeCount}
          commentCount={modalCommentCount}
          comments={modalComments}
          loadingComments={modalLoadingComments}
          commentInput={modalCommentInput}
          submittingComment={modalSubmittingComment}
          currentUserProfile={currentUserProfile}
          currentUserId={currentUserId}
          commentInputRef={commentInputRef}
          focusInput={false}
          onLike={handleModalLike}
          onBookmark={handleModalBookmark}
          onClose={() => setSelectedRec(null)}
          onCommentChange={setModalCommentInput}
          onCommentSubmit={handleModalComment}
        />
      )}
    </>
  )
}
