'use client'

import { useEffect, useRef, useState } from 'react'
import { RecommendationImage } from '@/app/components/RecommendationImage'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { checkedWrite } from '@/lib/writes'
import { RichMediaEmbed, willEmbed } from '@/app/components/RichMediaEmbed'
import type { Recommendation, RecComment, RecProfile } from '@/app/lib/types'
import { Avatar } from '@/app/components/Avatar'
import { ActionButton, ExternalLink, getExternalLinkLabel } from './helpers'
import { formatRelativeTime } from '@/lib/relativeTime'
import { trackClick } from '@/lib/items'
import { LikeIcon, BookmarkIcon, CommentIcon } from './icons'
import { theme } from '@/app/lib/theme'
import { ReportModal } from './ReportModal'
import { useToast } from '@/app/components/Toast'

type Profile = RecProfile
type Comment = RecComment

export function RecModal({
  rec,
  accentColor,
  liked,
  bookmarked,
  likeCount,
  commentCount,
  comments,
  loadingComments,
  commentInput,
  submittingComment,
  currentUserProfile,
  currentUserId,
  commentInputRef,
  focusInput,
  onLike,
  onBookmark,
  onClose,
  onCommentChange,
  onCommentSubmit,
  onRecDeleted,
  onRecUpdated,
  onCommentCountChange,
  onIgnore,
  zIndex = 100,
  context,
}: {
  rec: Recommendation
  accentColor: string
  liked: boolean
  bookmarked: boolean
  likeCount: number
  commentCount: number
  comments: Comment[]
  loadingComments: boolean
  commentInput: string
  submittingComment: boolean
  currentUserProfile: Profile | null
  currentUserId?: string | null
  commentInputRef: React.RefObject<HTMLTextAreaElement | null>
  focusInput: boolean
  onLike: (e: React.MouseEvent) => void
  onBookmark: (e: React.MouseEvent) => void
  onClose: () => void
  onCommentChange: (val: string) => void
  onCommentSubmit: (e: React.FormEvent) => void
  onRecDeleted?: () => void
  onRecUpdated?: (recId: string, newDescription: string) => void
  onCommentCountChange?: (recId: string, delta: number) => void
  onIgnore?: (userId: string, userName: string) => void
  zIndex?: number
  context?: 'profile'
}) {
  const profile = rec.profiles
  const scrollableRef = useRef<HTMLDivElement>(null)
  const supabaseRef = useRef(createClient())
  const [embedFailed, setEmbedFailed] = useState(false)
  const [imgError, setImgError] = useState(false)
  const [likeAnim, setLikeAnim] = useState<'pop' | 'shrink' | null>(null)
  const [bookmarkAnim, setBookmarkAnim] = useState(false)
  const [commentLikesMap, setCommentLikesMap] = useState<Record<string, { count: number; likedByMe: boolean }>>({})
  const [openMenuCommentId, setOpenMenuCommentId] = useState<string | null>(null)
  const [openRecMenu, setOpenRecMenu] = useState(false)
  const [editingDesc, setEditingDesc] = useState(false)
  const [editDescInput, setEditDescInput] = useState(rec.description)
  const [submittingEdit, setSubmittingEdit] = useState(false)
  const [deletingRec, setDeletingRec] = useState(false)
  const [ignoringUser, setIgnoringUser] = useState(false)
  const [localDescription, setLocalDescription] = useState(rec.description)
  const [deletedCommentIds, setDeletedCommentIds] = useState<Set<string>>(new Set())
  const toast = useToast()
  const [reportingRec, setReportingRec] = useState(false)
  const [reportingCommentId, setReportingCommentId] = useState<string | null>(null)

  useEffect(() => {
    const map: Record<string, { count: number; likedByMe: boolean }> = {}
    for (const c of comments) {
      const likes = c.comment_likes ?? []
      map[c.id] = { count: likes.length, likedByMe: likes.some(l => l.user_id === currentUserId) }
    }
    setCommentLikesMap(map)
  }, [comments, currentUserId])

  async function toggleCommentLike(commentId: string) {
    if (!currentUserId) return
    const cur = commentLikesMap[commentId] ?? { count: 0, likedByMe: false }
    setCommentLikesMap(prev => ({
      ...prev,
      [commentId]: { count: cur.count + (cur.likedByMe ? -1 : 1), likedByMe: !cur.likedByMe },
    }))
    const revert = () => setCommentLikesMap(prev => ({ ...prev, [commentId]: cur }))
    if (cur.likedByMe) {
      await checkedWrite(
        supabaseRef.current.from('comment_likes').delete()
          .eq('user_id', currentUserId).eq('comment_id', commentId),
        revert
      )
    } else {
      await checkedWrite(
        supabaseRef.current.from('comment_likes').insert({ user_id: currentUserId, comment_id: commentId }),
        revert
      )
    }
  }

  async function deleteComment(commentId: string, commentUserId: string) {
    if (!currentUserId || (currentUserId !== commentUserId && currentUserId !== rec.user_id)) return
    setOpenMenuCommentId(null)
    setDeletedCommentIds(prev => new Set([...prev, commentId]))
    const ok = await checkedWrite(
      supabaseRef.current.from('comments').delete().eq('id', commentId).eq('user_id', commentUserId)
    )
    if (!ok) {
      setDeletedCommentIds(prev => {
        const next = new Set(prev)
        next.delete(commentId)
        return next
      })
      toast('Couldn’t remove the comment. Please try again.')
      return
    }
    onCommentCountChange?.(rec.id, -1)
    toast('Comment removed')
  }

  async function reportComment(commentId: string, reason: string, details: string): Promise<boolean> {
    if (!currentUserId) return false
    const fullReason = details ? `${reason} — ${details}` : reason
    const { error } = await supabaseRef.current.from('comment_reports').insert({ comment_id: commentId, reporter_id: currentUserId, reason: fullReason })
    return !error
  }

  async function reportRec(reason: string, details: string): Promise<boolean> {
    if (!currentUserId) return false
    const fullReason = details ? `${reason} — ${details}` : reason
    const { error } = await supabaseRef.current.from('recommendation_reports').insert({ recommendation_id: rec.id, reporter_id: currentUserId, reason: fullReason })
    if (error) return false
    toast('Report submitted')
    return true
  }

  async function saveDescEdit() {
    if (!editDescInput.trim()) return
    setSubmittingEdit(true)
    const ok = await checkedWrite(
      supabaseRef.current.from('recommendations').update({ description: editDescInput.trim() }).eq('id', rec.id)
    )
    if (!ok) {
      setSubmittingEdit(false)
      toast('Couldn’t save your changes. Please try again.')
      return
    }
    setLocalDescription(editDescInput.trim())
    onRecUpdated?.(rec.id, editDescInput.trim())
    setEditingDesc(false)
    setSubmittingEdit(false)
    setOpenRecMenu(false)
    toast('Saved')
  }

  async function deleteRec() {
    if (!currentUserId || currentUserId !== rec.user_id) return
    const ok = await checkedWrite(
      supabaseRef.current.from('recommendations').delete().eq('id', rec.id).eq('user_id', currentUserId)
    )
    if (!ok) {
      toast('Couldn’t remove the recommendation. Please try again.')
      return
    }
    onClose()
    onRecDeleted?.()
    toast('Recommendation removed')
  }

  async function handleShare() {
    const url = `${window.location.origin}/rec/${rec.id}`
    await navigator.clipboard.writeText(url)
    toast('Link copied')
  }

  const isRecAuthor = currentUserId === rec.user_id
  const displayComments = comments.filter(c => !deletedCommentIds.has(c.id))
  const displayCommentCount = commentCount - deletedCommentIds.size

  useEffect(() => {
    if (!focusInput || loadingComments) return
    const timer = setTimeout(() => {
      commentInputRef.current?.focus()
      if (scrollableRef.current) {
        scrollableRef.current.scrollTop = scrollableRef.current.scrollHeight
      }
    }, 50)
    return () => clearTimeout(timer)
  }, [focusInput, loadingComments, commentInputRef])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (reportingRec) { setReportingRec(false); return }
      if (reportingCommentId) { setReportingCommentId(null); return }
      if (openRecMenu) { setOpenRecMenu(false); return }
      if (editingDesc) { setEditingDesc(false); return }
      if (deletingRec) { setDeletingRec(false); return }
      if (ignoringUser) { setIgnoringUser(false); return }
      onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [reportingRec, reportingCommentId, openRecMenu, editingDesc, deletingRec, ignoringUser, onClose])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      />

      {/* Sheet */}
      <div
        style={{
          position: 'relative', zIndex: 1, background: theme.colors.surface,
          borderRadius: '20px 20px 0 0', width: '100%', maxWidth: '500px',
          maxHeight: 'calc(100dvh - 56px)', overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          boxShadow: theme.shadows.modal,
        }}
        className="modal-sheet"
      >
        {/* Recommender row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 20px 12px', flexShrink: 0 }}>
          {profile?.handle ? (
            <Link href={`/profile/${profile.handle}`} onClick={onClose} style={{ lineHeight: 0 }}>
              <Avatar url={profile.avatar_url} name={profile.name} size={36} />
            </Link>
          ) : (
            <Avatar url={profile?.avatar_url} name={profile?.name} size={36} />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            {profile?.handle ? (
              <Link href={`/profile/${profile.handle}`} onClick={onClose} className="font-body"
                style={{ color: theme.colors.textPrimary, fontSize: '15px', fontWeight: 500, textDecoration: 'none' }}>
                {profile.name ?? 'Unknown'}
              </Link>
            ) : (
              <span className="font-body" style={{ color: theme.colors.textPrimary, fontSize: '15px', fontWeight: 500 }}>
                {profile?.name ?? 'Unknown'}
              </span>
            )}
            {profile?.handle && (
              <Link href={`/profile/${profile.handle}`} onClick={onClose} className="font-body profile-link"
                style={{ color: theme.colors.textMuted, fontSize: '13px', textDecoration: 'none' }}>
                {' · '}@{profile.handle}
              </Link>
            )}
          </div>
          <div style={{ display: 'flex', gap: '6px', flexShrink: 0, alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <button
                onClick={handleShare}
                style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  background: theme.colors.border, border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: theme.colors.textMuted, transition: 'background 0.15s',
                }}
                aria-label="Share"
              >
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                  <polyline points="16 6 12 2 8 6" />
                  <line x1="12" y1="2" x2="12" y2="15" />
                </svg>
              </button>
            </div>
            {(isRecAuthor || (currentUserId && currentUserId !== rec.user_id)) && (
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setOpenRecMenu(v => !v)}
                  style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    background: openRecMenu ? 'rgba(0,0,0,0.1)' : theme.colors.border,
                    border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: theme.colors.textMuted, transition: 'background 0.15s',
                  }}
                  aria-label="More options"
                >
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
                    <circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" />
                  </svg>
                </button>
                {openRecMenu && (
                  <>
                    <div onClick={() => setOpenRecMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 0 }} />
                    <div style={{
                      position: 'absolute', top: '38px', right: 0, zIndex: 1,
                      background: theme.colors.surface, border: '1px solid rgba(0,0,0,0.1)',
                      borderRadius: '10px', overflow: 'hidden', minWidth: '160px',
                      boxShadow: theme.shadows.menu,
                    }}>
                      {isRecAuthor ? (
                        <>
                          <button
                            onClick={() => { setEditDescInput(localDescription); setEditingDesc(true); setOpenRecMenu(false) }}
                            className="font-body"
                            style={{ display: 'block', width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', color: theme.colors.textPrimary, fontSize: '14px', textAlign: 'left' }}
                          >
                            Edit post
                          </button>
                          <div style={{ height: '1px', background: theme.colors.border }} />
                          <button
                            onClick={() => { setDeletingRec(true); setOpenRecMenu(false) }}
                            className="font-body"
                            style={{ display: 'block', width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', color: theme.colors.error, fontSize: '14px', textAlign: 'left' }}
                          >
                            Delete recommendation
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => { setOpenRecMenu(false); setReportingRec(true) }}
                            className="font-body"
                            style={{ display: 'block', width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', color: theme.colors.textMuted, fontSize: '14px', textAlign: 'left' }}
                          >
                            Report
                          </button>
                          {onIgnore && (
                            <>
                              <div style={{ height: '1px', background: theme.colors.border }} />
                              <button
                                onClick={() => { setIgnoringUser(true); setOpenRecMenu(false) }}
                                className="font-body"
                                style={{ display: 'block', width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', color: theme.colors.textMuted, fontSize: '14px', textAlign: 'left' }}
                              >
                                Ignore {profile?.name ?? 'this person'}
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
            <button
              onClick={onClose}
              style={{
                width: '32px', height: '32px', borderRadius: '50%',
                background: theme.colors.border, border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: theme.colors.textMuted, flexShrink: 0, transition: 'background 0.15s',
              }}
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div ref={scrollableRef} style={{ overflowY: 'auto', flex: 1 }}>
          {editingDesc ? (
            <div onClick={e => e.stopPropagation()} style={{ padding: '14px 20px' }}>
              <textarea
                value={editDescInput}
                onChange={e => setEditDescInput(e.target.value)}
                maxLength={2000}
                rows={4}
                autoFocus
                style={{
                  width: '100%', background: theme.colors.input, border: '1px solid rgba(0,0,0,0.12)',
                  borderRadius: '10px', padding: '10px 14px', color: theme.colors.textPrimary,
                  fontSize: '15px', fontFamily: theme.fonts.body,
                  lineHeight: '1.65', resize: 'none', outline: 'none', boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={saveDescEdit}
                    disabled={submittingEdit || !editDescInput.trim()}
                    className="font-body"
                    style={{ padding: '7px 18px', background: theme.colors.textPrimary, border: 'none', borderRadius: '8px', color: '#ffffff', fontSize: '13px', fontWeight: 600, cursor: submittingEdit ? 'default' : 'pointer', opacity: (!editDescInput.trim() || submittingEdit) ? 0.5 : 1 }}
                  >
                    {submittingEdit ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    onClick={() => { setEditingDesc(false); setOpenRecMenu(false) }}
                    className="font-body"
                    style={{ padding: '7px 14px', background: 'none', border: 'none', color: theme.colors.textMuted, fontSize: '13px', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                </div>
                <span className="font-body" style={{ fontSize: '12px', color: editDescInput.length > 1800 ? theme.colors.error : theme.colors.textMuted }}>
                  {editDescInput.length}/2000
                </span>
              </div>
            </div>
          ) : (
            <div style={{ position: 'relative', padding: '14px 20px' }}>
              <p className="font-body" style={{ fontSize: '15px', color: theme.colors.textPrimary, lineHeight: '1.65', margin: 0, paddingRight: isRecAuthor ? '28px' : 0 }}>
                {localDescription}
              </p>
              {isRecAuthor && (
                <button
                  onClick={() => { setEditDescInput(localDescription); setEditingDesc(true) }}
                  aria-label="Edit description"
                  style={{
                    position: 'absolute', top: '14px', right: '20px',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: theme.colors.textMuted, padding: '3px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    opacity: 0.55, transition: 'opacity 0.15s',
                  }}
                >
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                  </svg>
                </button>
              )}
            </div>
          )}

          {(!willEmbed(rec.external_url, rec.category, context ?? 'feed') || embedFailed) && !!rec.image_url && !imgError && (
            <div style={{ position: 'relative', width: '100%', height: '200px', background: theme.colors.surface }}>
              <RecommendationImage fill src={rec.image_url} category={rec.category} alt={rec.title} sizes="500px" onFallback={() => setImgError(true)} style={{ objectFit: 'contain' }} />
            </div>
          )}

          <h2
            className="font-display"
            style={{
              fontSize: '26px', fontWeight: 600, color: theme.colors.textPrimary, letterSpacing: '-0.02em',
              lineHeight: 1.25, padding: '16px 20px 0',
              marginBottom: rec.external_url ? '6px' : '12px',
            }}
          >
            {rec.title}
          </h2>

          {rec.external_url && (
            <div style={{ padding: '0 20px 14px' }}>
              {willEmbed(rec.external_url, rec.category, context ?? 'feed') && !embedFailed && (
                <RichMediaEmbed external_url={rec.external_url} category={rec.category} context={context ?? 'feed'} title={rec.title} onEmbedFail={() => setEmbedFailed(true)} />
              )}
              <ExternalLink
                href={rec.external_url}
                label={getExternalLinkLabel(rec.category, rec.external_url)}
                color={accentColor}
                onTrackClick={rec.item_id && currentUserId ? () => trackClick({ itemId: rec.item_id!, userId: currentUserId!, category: rec.category, source: 'modal' }) : undefined}
              />
            </div>
          )}

          <div style={{ display: 'flex', gap: '4px', padding: '0 14px', marginBottom: '20px' }}>
            <ActionButton
              onClick={(e) => {
                setLikeAnim(liked ? 'shrink' : 'pop')
                setTimeout(() => setLikeAnim(null), liked ? 150 : 350)
                onLike(e)
              }}
              label="Like"
            >
              <span style={{ display: 'inline-flex' }} className={likeAnim === 'pop' ? 'like-pop' : likeAnim === 'shrink' ? 'like-shrink' : undefined}>
                <LikeIcon filled={liked} color={liked ? accentColor : theme.colors.textMuted} />
              </span>
              <span style={{ fontSize: '14px', fontWeight: 500, color: liked ? accentColor : theme.colors.textMuted, transition: 'color 0.15s' }}>
                {likeCount > 0 ? `${likeCount} ${likeCount === 1 ? 'like' : 'likes'}` : 'Like'}
              </span>
            </ActionButton>
            <ActionButton
              onClick={(e) => {
                if (!bookmarked) { setBookmarkAnim(true); setTimeout(() => setBookmarkAnim(false), 250) }
                onBookmark(e)
              }}
              label="Bookmark"
            >
              <span style={{ display: 'inline-flex' }} className={bookmarkAnim ? 'bm-bounce' : undefined}>
                <BookmarkIcon filled={bookmarked} color={bookmarked ? accentColor : theme.colors.textMuted} />
              </span>
              <span style={{ fontSize: '14px', fontWeight: 500, color: bookmarked ? accentColor : theme.colors.textMuted, transition: 'color 0.15s' }}>
                {bookmarked ? 'Saved' : 'Save'}
              </span>
            </ActionButton>
            <ActionButton
              onClick={(e) => {
                e.stopPropagation()
                commentInputRef.current?.focus()
                if (scrollableRef.current) scrollableRef.current.scrollTop = scrollableRef.current.scrollHeight
              }}
              label="Comment"
            >
              <CommentIcon color={theme.colors.textMuted} />
              <span style={{ fontSize: '14px', fontWeight: 500, color: theme.colors.textMuted }}>
                {displayCommentCount > 0 ? displayCommentCount : ''}
              </span>
            </ActionButton>
          </div>

          <div style={{ padding: '0 20px', marginBottom: '0' }}>
            {loadingComments ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                {[1, 2].map((i) => (
                  <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <div className="skeleton-pulse" style={{ width: 28, height: 28, borderRadius: '50%', background: theme.colors.input, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div className="skeleton-pulse" style={{ height: 11, width: '30%', borderRadius: 6, background: theme.colors.input, marginBottom: 6 }} />
                      <div className="skeleton-pulse" style={{ height: 13, width: '90%', borderRadius: 6, background: theme.colors.input }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : displayComments.length === 0 ? null : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', marginBottom: '20px' }}>
                {displayComments.map((comment) => {
                  const clikes = commentLikesMap[comment.id] ?? { count: 0, likedByMe: false }
                  const canDelete = currentUserId === comment.user_id || isRecAuthor
                  const canReport = !!currentUserId && currentUserId !== comment.user_id
                  return (
                    <div key={comment.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                      {comment.profiles?.handle ? (
                        <Link href={`/profile/${comment.profiles.handle}`} onClick={onClose} style={{ lineHeight: 0, flexShrink: 0 }} className="profile-link">
                          <Avatar url={comment.profiles.avatar_url} name={comment.profiles.name} size={28} />
                        </Link>
                      ) : (
                        <Avatar url={comment.profiles?.avatar_url} name={comment.profiles?.name} size={28} />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px', minWidth: 0 }}>
                            {comment.profiles?.handle ? (
                              <Link href={`/profile/${comment.profiles.handle}`} onClick={onClose} className="font-body profile-link"
                                style={{ color: theme.colors.textPrimary, fontSize: '13px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: 'none' }}>
                                {comment.profiles.name ?? 'Unknown'}
                              </Link>
                            ) : (
                              <span className="font-body" style={{ color: theme.colors.textPrimary, fontSize: '13px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {comment.profiles?.name ?? 'Unknown'}
                              </span>
                            )}
                            {comment.profiles?.handle && (
                              <Link href={`/profile/${comment.profiles.handle}`} onClick={onClose} className="font-body profile-link"
                                style={{ color: theme.colors.textMuted, fontSize: '12px', whiteSpace: 'nowrap', textDecoration: 'none' }}>
                                @{comment.profiles.handle}
                              </Link>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                            <button
                              onClick={() => toggleCommentLike(comment.id)}
                              style={{ display: 'flex', alignItems: 'center', gap: '3px', background: 'none', border: 'none', cursor: 'pointer', padding: '0' }}
                            >
                              <LikeIcon filled={clikes.likedByMe} color={clikes.likedByMe ? accentColor : '#6b5d4f'} />
                              {clikes.count > 0 && (
                                <span className="font-body" style={{ fontSize: '11px', color: clikes.likedByMe ? accentColor : '#6b5d4f', transition: 'color 0.15s' }}>
                                  {clikes.count}
                                </span>
                              )}
                            </button>
                            <span className="font-body" style={{ color: theme.colors.textMuted, fontSize: '12px' }}>
                              {formatRelativeTime(comment.created_at)}
                            </span>
                            {(canDelete || canReport) && (
                              <div style={{ position: 'relative' }}>
                                <button
                                  onClick={() => setOpenMenuCommentId(openMenuCommentId === comment.id ? null : comment.id)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', borderRadius: '6px', color: theme.colors.textTertiary, display: 'flex' }}
                                >
                                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                                    <circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" />
                                  </svg>
                                </button>
                                {openMenuCommentId === comment.id && (
                                  <>
                                    <div onClick={() => setOpenMenuCommentId(null)} style={{ position: 'fixed', inset: 0, zIndex: 0 }} />
                                    <div style={{
                                      position: 'absolute', top: '20px', right: 0, zIndex: 1,
                                      background: theme.colors.surface, border: '1px solid rgba(0,0,0,0.1)',
                                      borderRadius: '10px', overflow: 'hidden', minWidth: '130px',
                                      boxShadow: theme.shadows.menu,
                                    }}>
                                      {canDelete && (
                                        <button
                                          onClick={() => deleteComment(comment.id, comment.user_id)}
                                          className="font-body"
                                          style={{ display: 'block', width: '100%', padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', color: theme.colors.error, fontSize: '13px', textAlign: 'left' }}
                                        >
                                          Delete
                                        </button>
                                      )}
                                      {canReport && (
                                        <button
                                          onClick={() => { setOpenMenuCommentId(null); setReportingCommentId(comment.id) }}
                                          className="font-body"
                                          style={{ display: 'block', width: '100%', padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', color: theme.colors.textMuted, fontSize: '13px', textAlign: 'left' }}
                                        >
                                          Report
                                        </button>
                                      )}
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <p className="font-body" style={{ color: theme.colors.textPrimary, fontSize: '14px', lineHeight: '1.55' }}>
                          {comment.text}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Comment input — sticky at bottom */}
        <div style={{ padding: '8px 16px 10px', borderTop: `1px solid ${theme.colors.border}`, background: theme.colors.surface, flexShrink: 0 }}>
          <form onSubmit={onCommentSubmit} style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
            <Avatar url={currentUserProfile?.avatar_url} name={currentUserProfile?.name} size={32} />
            <div style={{ flex: 1 }}>
              <div style={{ position: 'relative' }}>
                <textarea
                  ref={commentInputRef}
                  value={commentInput}
                  onChange={(e) => {
                    if (e.target.value.length > 280) return
                    onCommentChange(e.target.value)
                    e.target.style.height = 'auto'
                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
                  }}
                  placeholder="Add a comment..."
                  maxLength={280}
                  rows={1}
                  style={{
                    width: '100%', background: theme.colors.input, border: '1px solid rgba(0,0,0,0.1)',
                    borderRadius: '12px', padding: '9px 44px 9px 14px', color: theme.colors.textPrimary,
                    fontSize: '14px', fontFamily: 'var(--font-body, "DM Sans", sans-serif)',
                    resize: 'none', outline: 'none', lineHeight: '1.5', display: 'block',
                    overflow: 'hidden', transition: 'border-color 0.15s', boxSizing: 'border-box',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = 'rgba(0,0,0,0.15)' }}
                  onBlur={(e) => { e.target.style.borderColor = 'rgba(0,0,0,0.1)' }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      onCommentSubmit(e as unknown as React.FormEvent)
                    }
                  }}
                />
                <button
                  type="submit"
                  disabled={!commentInput.trim() || submittingComment}
                  style={{
                    position: 'absolute', right: '8px', bottom: '7px',
                    width: '28px', height: '28px', borderRadius: '8px', border: 'none',
                    cursor: commentInput.trim() ? 'pointer' : 'default',
                    background: commentInput.trim() ? accentColor : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background 0.15s',
                  }}
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke={commentInput.trim() ? '#ffffff' : '#6b5d4f'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 2L11 13" />
                    <path d="M22 2L15 22l-4-9-9-4 20-7z" />
                  </svg>
                </button>
              </div>
              {commentInput.length > 0 && (
                <p className="font-body" style={{ fontSize: '11px', textAlign: 'right', marginTop: '3px', color: commentInput.length >= 250 ? accentColor : '#4a4438' }}>
                  {commentInput.length}/280
                </p>
              )}
            </div>
          </form>
        </div>

        {/* Ignore confirmation overlay */}
        {ignoringUser && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 10,
            background: 'rgba(245,240,232,0.95)', backdropFilter: 'blur(4px)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '24px', gap: '12px',
          }}>
            <p className="font-display" style={{ fontSize: '18px', fontWeight: 600, color: theme.colors.textPrimary, textAlign: 'center' }}>
              Ignore {profile?.name ?? 'this person'}?
            </p>
            <p className="font-body" style={{ fontSize: '14px', color: theme.colors.textMuted, textAlign: 'center', lineHeight: 1.55 }}>
              You won&apos;t see their recommendations in your feeds. You can undo this in Settings.
            </p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
              <button
                onClick={() => setIgnoringUser(false)}
                className="font-body"
                style={{ padding: '9px 20px', background: theme.colors.border, border: 'none', borderRadius: '10px', color: theme.colors.textMuted, fontSize: '14px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setIgnoringUser(false)
                  onIgnore?.(rec.user_id, profile?.name ?? profile?.handle ?? 'this person')
                  onClose()
                }}
                className="font-body"
                style={{ padding: '9px 20px', background: theme.colors.textPrimary, border: 'none', borderRadius: '10px', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
              >
                Ignore
              </button>
            </div>
          </div>
        )}

        {/* Recommendation report modal */}
        {reportingRec && (
          <ReportModal
            title={`Report ${profile?.name ?? 'this recommendation'}`}
            onSubmit={reportRec}
            onClose={() => setReportingRec(false)}
            zIndex={zIndex + 10}
          />
        )}

        {/* Comment report modal */}
        {reportingCommentId && (
          <ReportModal
            title="Report this comment"
            onSubmit={(reason, details) => reportComment(reportingCommentId, reason, details)}
            onClose={() => setReportingCommentId(null)}
            zIndex={zIndex + 10}
          />
        )}

        {/* Delete confirmation overlay */}
        {deletingRec && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 10,
            background: 'rgba(245,240,232,0.95)', backdropFilter: 'blur(4px)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '24px', gap: '12px',
          }}>
            <p className="font-display" style={{ fontSize: '18px', fontWeight: 600, color: theme.colors.textPrimary, textAlign: 'center' }}>
              Delete this recommendation?
            </p>
            <p className="font-body" style={{ fontSize: '14px', color: theme.colors.textMuted, textAlign: 'center' }}>
              This can&apos;t be undone.
            </p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
              <button
                onClick={() => setDeletingRec(false)}
                className="font-body"
                style={{ padding: '9px 20px', background: theme.colors.border, border: 'none', borderRadius: '10px', color: theme.colors.textMuted, fontSize: '14px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={deleteRec}
                className="font-body"
                style={{ padding: '9px 20px', background: theme.colors.error, border: 'none', borderRadius: '10px', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
