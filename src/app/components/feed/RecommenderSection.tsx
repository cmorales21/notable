'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { RichMediaEmbed, willEmbed } from '@/app/components/RichMediaEmbed'
import type { RecComment, RecProfile } from '@/app/lib/types'
import type { GroupedRecommender } from '@/lib/groupRecommendations'
import { Avatar, ActionButton, ExternalLink, getExternalLinkLabel, formatRelativeTime, sortComments, fetchComments } from './helpers'
import { LikeIcon, BookmarkIcon, CommentIcon } from './icons'
import { theme } from '@/app/lib/theme'

type Profile = RecProfile
type Comment = RecComment

export function RecommenderSection({
  recommender,
  category,
  title,
  accentColor,
  currentUserId,
  currentUserProfile,
  onLikeToggle,
  onBookmarkToggle,
  onExpand,
}: {
  recommender: GroupedRecommender
  category: string
  title: string
  accentColor: string
  currentUserId: string | null
  currentUserProfile: Profile | null
  onLikeToggle: (recId: string, wasLiked: boolean) => void
  onBookmarkToggle: (recId: string, wasBookmarked: boolean) => void
  onExpand?: () => void
}) {
  const supabaseRef = useRef(createClient())
  const [liked, setLiked] = useState(recommender.is_liked_by_user)
  const [likeCount, setLikeCount] = useState(recommender.individual_likes)
  const [embedFailed, setEmbedFailed] = useState(false)
  const [bookmarked, setBookmarked] = useState(recommender.is_bookmarked_by_user)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [comments, setComments] = useState<Comment[]>([])
  const [loadingComments, setLoadingComments] = useState(false)
  const [commentInput, setCommentInput] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [commentCount, setCommentCount] = useState(recommender.individual_comments)
  const [commentLikesMap, setCommentLikesMap] = useState<Record<string, { count: number; likedByMe: boolean }>>({})
  const [openMenuCommentId, setOpenMenuCommentId] = useState<string | null>(null)
  const [deletedCommentIds, setDeletedCommentIds] = useState<Set<string>>(new Set())

  const recId = recommender.recommendation_id
  const profile = recommender.profile

  function initCommentLikes(data: Comment[]) {
    const map: Record<string, { count: number; likedByMe: boolean }> = {}
    for (const c of data) {
      const likes = c.comment_likes ?? []
      map[c.id] = { count: likes.length, likedByMe: likes.some(l => l.user_id === currentUserId) }
    }
    setCommentLikesMap(map)
  }

  async function toggleLike(e: React.MouseEvent) {
    e.stopPropagation()
    if (!currentUserId) return
    onLikeToggle(recId, liked)
    if (liked) {
      setLiked(false); setLikeCount(c => c - 1)
      await supabaseRef.current.from('likes').delete()
        .eq('user_id', currentUserId).eq('recommendation_id', recId)
    } else {
      setLiked(true); setLikeCount(c => c + 1)
      await supabaseRef.current.from('likes').insert({ user_id: currentUserId, recommendation_id: recId })
      if (recommender.user_id !== currentUserId) {
        void supabaseRef.current.from('notifications').insert({ user_id: recommender.user_id, actor_id: currentUserId, type: 'like', rec_id: recId, read: false })
      }
    }
  }

  async function toggleBookmark(e: React.MouseEvent) {
    e.stopPropagation()
    if (!currentUserId) return
    onBookmarkToggle(recId, bookmarked)
    if (bookmarked) {
      setBookmarked(false)
      await supabaseRef.current.from('bookmarks').delete()
        .eq('user_id', currentUserId).eq('recommendation_id', recId)
    } else {
      setBookmarked(true)
      await supabaseRef.current.from('bookmarks').insert({ user_id: currentUserId, recommendation_id: recId })
      if (recommender.user_id !== currentUserId) {
        void supabaseRef.current.from('notifications').insert({ user_id: recommender.user_id, actor_id: currentUserId, type: 'bookmark', rec_id: recId, read: false })
      }
    }
  }

  async function handleExpandComments(e: React.MouseEvent) {
    e.stopPropagation()
    if (commentsOpen) { setCommentsOpen(false); return }
    setCommentsOpen(true)
    if (comments.length > 0 || loadingComments) return
    setLoadingComments(true)
    const sorted = await fetchComments(supabaseRef.current, recId)
    setComments(sorted)
    setCommentCount(sorted.length)
    initCommentLikes(sorted)
    setLoadingComments(false)
  }

  async function toggleCommentLike(commentId: string) {
    if (!currentUserId) return
    const cur = commentLikesMap[commentId] ?? { count: 0, likedByMe: false }
    setCommentLikesMap(prev => ({
      ...prev,
      [commentId]: { count: cur.count + (cur.likedByMe ? -1 : 1), likedByMe: !cur.likedByMe },
    }))
    if (cur.likedByMe) {
      await supabaseRef.current.from('comment_likes').delete()
        .eq('user_id', currentUserId).eq('comment_id', commentId)
    } else {
      await supabaseRef.current.from('comment_likes').insert({ user_id: currentUserId, comment_id: commentId })
    }
  }

  async function deleteComment(commentId: string, commentUserId: string) {
    if (!currentUserId || currentUserId !== commentUserId) return
    setOpenMenuCommentId(null)
    setDeletedCommentIds(prev => new Set([...prev, commentId]))
    await supabaseRef.current.from('comments').delete().eq('id', commentId).eq('user_id', commentUserId)
  }

  async function reportComment(commentId: string) {
    if (!currentUserId) return
    setOpenMenuCommentId(null)
    await supabaseRef.current.from('comment_reports').insert({ comment_id: commentId, reporter_id: currentUserId })
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault()
    if (!currentUserId || !commentInput.trim()) return
    setSubmittingComment(true)
    const text = commentInput.trim()
    setCommentInput('')
    const { data: inserted, error } = await supabaseRef.current.from('comments')
      .insert({ user_id: currentUserId, recommendation_id: recId, text })
      .select('*')
      .single()
    if (error) console.error('[Notable] comment insert error:', error.message)
    if (!error && inserted) {
      const newComment: Comment = { ...inserted, profiles: currentUserProfile, comment_likes: [] }
      setComments(prev => sortComments([...prev, newComment]))
      setCommentCount(c => c + 1)
      setCommentLikesMap(prev => ({ ...prev, [inserted.id]: { count: 0, likedByMe: false } }))
      if (recommender.user_id !== currentUserId) {
        void supabaseRef.current.from('notifications').insert({ user_id: recommender.user_id, actor_id: currentUserId, type: 'comment', rec_id: recommender.recommendation_id, read: false })
      }
    }
    setSubmittingComment(false)
  }

  return (
    <div
      onClick={onExpand}
      style={{ borderTop: `1px solid ${theme.colors.border}`, padding: '16px 20px', cursor: onExpand ? 'pointer' : undefined }}
    >
      {/* Profile row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
        {profile?.handle ? (
          <Link href={`/profile/${profile.handle}`} onClick={e => e.stopPropagation()} style={{ lineHeight: 0, flexShrink: 0 }}>
            <Avatar url={profile.avatar_url} name={profile.name} size={30} />
          </Link>
        ) : (
          <Avatar url={profile?.avatar_url} name={profile?.name} size={30} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', flexWrap: 'wrap' }}>
            {profile?.handle ? (
              <Link href={`/profile/${profile.handle}`} onClick={e => e.stopPropagation()} className="font-body"
                style={{ color: theme.colors.textPrimary, fontSize: '14px', fontWeight: 500, textDecoration: 'none' }}>
                {profile.name ?? 'Unknown'}
              </Link>
            ) : (
              <span className="font-body" style={{ color: theme.colors.textPrimary, fontSize: '14px', fontWeight: 500 }}>
                {profile?.name ?? 'Unknown'}
              </span>
            )}
            {profile?.handle && (
              <span className="font-body" style={{ color: theme.colors.textMuted, fontSize: '12px' }}>
                @{profile.handle}
              </span>
            )}
            <span className="font-body" style={{ color: theme.colors.textTertiary, fontSize: '11px', marginLeft: 'auto' }}>
              {formatRelativeTime(recommender.created_at)}
            </span>
          </div>
        </div>
        {onExpand && (
          <button
            onClick={e => { e.stopPropagation(); onExpand() }}
            aria-label="View full post"
            style={{ display: 'flex', alignItems: 'center', gap: '3px', background: 'none', border: 'none', cursor: 'pointer', color: theme.colors.textMuted, padding: '4px 0', flexShrink: 0 }}
          >
            <span className="font-body" style={{ fontSize: '12px' }}>View post</span>
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        )}
      </div>

      <p className="font-body" style={{ fontSize: '14px', color: theme.colors.textPrimary, lineHeight: '1.65', marginBottom: '10px' }}>
        {recommender.description}
      </p>

      {recommender.external_url && (
        <div style={{ marginBottom: '10px' }}>
          {willEmbed(recommender.external_url, category, 'feed') && !embedFailed ? (
            <RichMediaEmbed external_url={recommender.external_url} category={category} context="feed" title={title} onEmbedFail={() => setEmbedFailed(true)} />
          ) : (
            <ExternalLink href={recommender.external_url} label={getExternalLinkLabel(category, recommender.external_url)} color={accentColor} />
          )}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <ActionButton onClick={toggleLike} active={liked} activeColor={accentColor} label="Like">
          <LikeIcon filled={liked} color={liked ? accentColor : theme.colors.textMuted} />
          {likeCount > 0 && (
            <span style={{ fontSize: '12px', fontWeight: 500, color: liked ? accentColor : theme.colors.textMuted, transition: 'color 0.15s' }}>
              {likeCount}
            </span>
          )}
        </ActionButton>
        <ActionButton onClick={toggleBookmark} active={bookmarked} activeColor={accentColor} label="Bookmark">
          <BookmarkIcon filled={bookmarked} color={bookmarked ? accentColor : theme.colors.textMuted} />
        </ActionButton>
        <ActionButton onClick={handleExpandComments} active={commentsOpen} activeColor={accentColor} label="Comments">
          <CommentIcon filled={commentsOpen} color={commentsOpen ? accentColor : theme.colors.textMuted} />
          <span style={{ fontSize: '12px', fontWeight: 500, color: commentsOpen ? accentColor : theme.colors.textMuted }}>
            {commentCount > 0 ? commentCount : ''}
          </span>
        </ActionButton>
      </div>

      {commentsOpen && (
        <div onClick={e => e.stopPropagation()} style={{ marginTop: '12px' }}>
          {loadingComments ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '12px' }}>
              {[1, 2].map(i => (
                <div key={i} style={{ display: 'flex', gap: '8px' }}>
                  <div className="skeleton-pulse" style={{ width: 24, height: 24, borderRadius: '50%', background: theme.colors.input, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div className="skeleton-pulse" style={{ height: 10, width: '35%', borderRadius: 5, background: theme.colors.input, marginBottom: 5 }} />
                    <div className="skeleton-pulse" style={{ height: 12, width: '85%', borderRadius: 5, background: theme.colors.input }} />
                  </div>
                </div>
              ))}
            </div>
          ) : comments.filter(c => !deletedCommentIds.has(c.id)).length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '12px' }}>
              {comments.filter(c => !deletedCommentIds.has(c.id)).map(comment => {
                const clikes = commentLikesMap[comment.id] ?? { count: 0, likedByMe: false }
                const canDelete = currentUserId === comment.user_id
                const canReport = !!currentUserId && currentUserId !== comment.user_id
                return (
                  <div key={comment.id} style={{ display: 'flex', gap: '8px' }}>
                    <Avatar url={comment.profiles?.avatar_url} name={comment.profiles?.name} size={24} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px', marginBottom: '2px', flexWrap: 'wrap' }}>
                        <span className="font-body" style={{ color: theme.colors.textPrimary, fontSize: '12px', fontWeight: 500 }}>
                          {comment.profiles?.name ?? 'Unknown'}
                        </span>
                        {comment.profiles?.handle && (
                          <span className="font-body" style={{ color: theme.colors.textMuted, fontSize: '11px' }}>@{comment.profiles.handle}</span>
                        )}
                        <span className="font-body" style={{ color: theme.colors.textTertiary, fontSize: '11px', marginLeft: 'auto' }}>
                          {formatRelativeTime(comment.created_at)}
                        </span>
                      </div>
                      <p className="font-body" style={{ color: theme.colors.textPrimary, fontSize: '13px', lineHeight: '1.5' }}>
                        {comment.text}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px' }}>
                        <button
                          onClick={() => toggleCommentLike(comment.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: '3px', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 3px', borderRadius: '5px' }}
                        >
                          <LikeIcon filled={clikes.likedByMe} color={clikes.likedByMe ? accentColor : theme.colors.textMuted} />
                          {clikes.count > 0 && (
                            <span className="font-body" style={{ fontSize: '10px', color: clikes.likedByMe ? accentColor : theme.colors.textMuted, transition: 'color 0.15s' }}>
                              {clikes.count}
                            </span>
                          )}
                        </button>
                        {(canDelete || canReport) && (
                          <div style={{ position: 'relative', marginLeft: 'auto' }}>
                            <button
                              onClick={() => setOpenMenuCommentId(openMenuCommentId === comment.id ? null : comment.id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 3px', borderRadius: '5px', color: theme.colors.textTertiary, display: 'flex' }}
                            >
                              <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
                                <circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" />
                              </svg>
                            </button>
                            {openMenuCommentId === comment.id && (
                              <>
                                <div onClick={() => setOpenMenuCommentId(null)} style={{ position: 'fixed', inset: 0, zIndex: 0 }} />
                                <div style={{
                                  position: 'absolute', bottom: '20px', right: 0, zIndex: 1,
                                  background: theme.colors.surface, border: '1px solid rgba(0,0,0,0.1)',
                                  borderRadius: '8px', overflow: 'hidden', minWidth: '120px',
                                  boxShadow: theme.shadows.menuSmall,
                                }}>
                                  {canDelete && (
                                    <button
                                      onClick={() => deleteComment(comment.id, comment.user_id)}
                                      className="font-body"
                                      style={{ display: 'block', width: '100%', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', color: theme.colors.error, fontSize: '12px', textAlign: 'left' }}
                                    >
                                      Delete
                                    </button>
                                  )}
                                  {canReport && (
                                    <button
                                      onClick={() => reportComment(comment.id)}
                                      className="font-body"
                                      style={{ display: 'block', width: '100%', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', color: theme.colors.textMuted, fontSize: '12px', textAlign: 'left' }}
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
                  </div>
                )
              })}
            </div>
          ) : null}

          {currentUserId && (
            <form onSubmit={submitComment} style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
              <Avatar url={currentUserProfile?.avatar_url} name={currentUserProfile?.name} size={26} />
              <div style={{ flex: 1 }}>
                <div style={{ position: 'relative' }}>
                  <textarea
                    value={commentInput}
                    onChange={e => {
                      if (e.target.value.length > 280) return
                      setCommentInput(e.target.value)
                      e.target.style.height = 'auto'
                      e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px'
                    }}
                    placeholder="Add a comment..."
                    maxLength={280}
                    rows={1}
                    style={{
                      width: '100%', background: theme.colors.input,
                      border: '1px solid rgba(0,0,0,0.1)', borderRadius: '10px',
                      padding: '7px 40px 7px 12px', color: theme.colors.textPrimary,
                      fontSize: '13px', fontFamily: 'var(--font-body, "DM Sans", sans-serif)',
                      resize: 'none', outline: 'none', lineHeight: '1.5', display: 'block',
                      overflow: 'hidden', boxSizing: 'border-box',
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        submitComment(e as unknown as React.FormEvent)
                      }
                    }}
                  />
                  <button
                    type="submit"
                    disabled={!commentInput.trim() || submittingComment}
                    style={{
                      position: 'absolute', right: '6px', bottom: '5px',
                      width: '26px', height: '26px', borderRadius: '7px', border: 'none',
                      cursor: commentInput.trim() ? 'pointer' : 'default',
                      background: commentInput.trim() ? accentColor : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'background 0.15s',
                    }}
                  >
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none"
                      stroke={commentInput.trim() ? '#ffffff' : theme.colors.textMuted}
                      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 2L11 13" /><path d="M22 2L15 22l-4-9-9-4 20-7z" />
                    </svg>
                  </button>
                </div>
                {commentInput.length > 0 && (
                  <p className="font-body" style={{ fontSize: '10px', textAlign: 'right', marginTop: '2px', color: commentInput.length >= 250 ? accentColor : '#4a4438' }}>
                    {commentInput.length}/280
                  </p>
                )}
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
