'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RichMediaEmbed, willEmbed } from '@/app/components/RichMediaEmbed'
import type { Recommendation, RecComment, RecProfile } from '@/app/lib/types'
import type { GroupedRecommendation, GroupedRecommender } from '@/lib/groupRecommendations'
import { ExternalLink, getExternalLinkLabel, fetchComments, sortComments } from './helpers'
import { theme } from '@/app/lib/theme'
import { RecModal } from './RecModal'
import { RecommenderSection } from './RecommenderSection'

type Profile = RecProfile
type Comment = RecComment

function SingleRecDetailModal({
  recommender,
  group,
  accentColor,
  currentUserId,
  currentUserProfile,
  onLikeToggle,
  onBookmarkToggle,
  onClose,
}: {
  recommender: GroupedRecommender
  group: GroupedRecommendation
  accentColor: string
  currentUserId: string | null
  currentUserProfile: Profile | null
  onLikeToggle: (recId: string, wasLiked: boolean) => void
  onBookmarkToggle: (recId: string, wasBookmarked: boolean) => void
  onClose: () => void
}) {
  const supabaseRef = useRef(createClient())
  const commentInputRef = useRef<HTMLTextAreaElement>(null)
  const [liked, setLiked] = useState(recommender.is_liked_by_user)
  const [bookmarked, setBookmarked] = useState(recommender.is_bookmarked_by_user)
  const [likeCount, setLikeCount] = useState(recommender.individual_likes)
  const [commentCount, setCommentCount] = useState(recommender.individual_comments)
  const [comments, setComments] = useState<Comment[]>([])
  const [loadingComments, setLoadingComments] = useState(true)
  const [commentInput, setCommentInput] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)

  useEffect(() => {
    fetchComments(supabaseRef.current, recommender.recommendation_id).then(sorted => {
      setComments(sorted)
      setCommentCount(sorted.length)
      setLoadingComments(false)
    })
  }, [recommender.recommendation_id])

  async function handleLike(e: React.MouseEvent) {
    e.stopPropagation()
    if (!currentUserId) return
    onLikeToggle(recommender.recommendation_id, liked)
    if (liked) {
      setLiked(false); setLikeCount(c => c - 1)
      await supabaseRef.current.from('likes').delete()
        .eq('user_id', currentUserId).eq('recommendation_id', recommender.recommendation_id)
    } else {
      setLiked(true); setLikeCount(c => c + 1)
      await supabaseRef.current.from('likes').insert({ user_id: currentUserId, recommendation_id: recommender.recommendation_id })
      if (recommender.user_id !== currentUserId) {
        void supabaseRef.current.from('notifications').insert({ user_id: recommender.user_id, actor_id: currentUserId, type: 'like', rec_id: recommender.recommendation_id, read: false })
      }
    }
  }

  async function handleBookmark(e: React.MouseEvent) {
    e.stopPropagation()
    if (!currentUserId) return
    onBookmarkToggle(recommender.recommendation_id, bookmarked)
    if (bookmarked) {
      setBookmarked(false)
      await supabaseRef.current.from('bookmarks').delete()
        .eq('user_id', currentUserId).eq('recommendation_id', recommender.recommendation_id)
    } else {
      setBookmarked(true)
      await supabaseRef.current.from('bookmarks').insert({ user_id: currentUserId, recommendation_id: recommender.recommendation_id })
      if (recommender.user_id !== currentUserId) {
        void supabaseRef.current.from('notifications').insert({ user_id: recommender.user_id, actor_id: currentUserId, type: 'bookmark', rec_id: recommender.recommendation_id, read: false })
      }
    }
  }

  async function handleComment(e: React.FormEvent) {
    e.preventDefault()
    if (!currentUserId || !commentInput.trim()) return
    setSubmittingComment(true)
    const text = commentInput.trim()
    setCommentInput('')
    const { data: inserted, error } = await supabaseRef.current.from('comments')
      .insert({ user_id: currentUserId, recommendation_id: recommender.recommendation_id, text })
      .select('*')
      .single()
    if (error) console.error('[Notable] comment insert error:', error.message)
    if (!error && inserted) {
      const newComment: Comment = { ...inserted, profiles: currentUserProfile, comment_likes: [] }
      setComments(prev => sortComments([...prev, newComment]))
      setCommentCount(c => c + 1)
      if (recommender.user_id !== currentUserId) {
        void supabaseRef.current.from('notifications').insert({ user_id: recommender.user_id, actor_id: currentUserId, type: 'comment', rec_id: recommender.recommendation_id, read: false })
      }
    }
    setSubmittingComment(false)
  }

  const rec: Recommendation = {
    id: recommender.recommendation_id,
    user_id: recommender.user_id,
    category: group.category,
    title: group.title,
    description: recommender.description,
    image_url: group.image_url,
    external_url: recommender.external_url,
    created_at: recommender.created_at,
    profiles: recommender.profile,
  }

  return (
    <RecModal
      rec={rec}
      accentColor={accentColor}
      liked={liked}
      bookmarked={bookmarked}
      likeCount={likeCount}
      commentCount={commentCount}
      comments={comments}
      loadingComments={loadingComments}
      commentInput={commentInput}
      submittingComment={submittingComment}
      currentUserProfile={currentUserProfile}
      currentUserId={currentUserId}
      commentInputRef={commentInputRef}
      focusInput={false}
      onLike={handleLike}
      onBookmark={handleBookmark}
      onClose={onClose}
      onCommentChange={setCommentInput}
      onCommentSubmit={handleComment}
      zIndex={200}
    />
  )
}

export function GroupedModal({
  group,
  accentColor,
  currentUserId,
  currentUserProfile,
  focusInput,
  onLikeToggle,
  onBookmarkToggle,
  onClose,
  onRecDeleted,
  onRecUpdated,
  onCommentCountChange,
}: {
  group: GroupedRecommendation
  accentColor: string
  currentUserId: string | null
  currentUserProfile: Profile | null
  focusInput: boolean
  onLikeToggle: (recId: string, wasLiked: boolean) => void
  onBookmarkToggle: (recId: string, wasBookmarked: boolean) => void
  onClose: () => void
  onRecDeleted?: (recId: string) => void
  onRecUpdated?: (recId: string, newDescription: string) => void
  onCommentCountChange?: (recId: string, delta: number) => void
}) {
  const isSingle = group.recommenders.length === 1
  const leadRec = group.recommenders[0]
  const supabaseRef = useRef(createClient())
  const scrollableRef = useRef<HTMLDivElement>(null)
  const commentInputRef = useRef<HTMLTextAreaElement>(null)
  const [imgError, setImgError] = useState(false)
  const [embedFailed, setEmbedFailed] = useState(false)
  const [expandedRecommender, setExpandedRecommender] = useState<GroupedRecommender | null>(null)
  const [showCopied, setShowCopied] = useState(false)
  const [openRecMenu, setOpenRecMenu] = useState(false)
  const [reportStep, setReportStep] = useState<'idle' | 'thanks'>('idle')

  const [liked, setLiked] = useState(leadRec.is_liked_by_user)
  const [bookmarked, setBookmarked] = useState(leadRec.is_bookmarked_by_user)
  const [likeCount, setLikeCount] = useState(leadRec.individual_likes)
  const [commentCount, setCommentCount] = useState(leadRec.individual_comments)
  const [comments, setComments] = useState<Comment[]>([])
  const [loadingComments, setLoadingComments] = useState(false)
  const [commentInput, setCommentInput] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)

  useEffect(() => {
    if (!isSingle) return
    setLoadingComments(true)
    fetchComments(supabaseRef.current, leadRec.recommendation_id).then(sorted => {
      setComments(sorted)
      setCommentCount(sorted.length)
      setLoadingComments(false)
    })
  }, [isSingle, leadRec.recommendation_id])

  useEffect(() => {
    if (!isSingle || !focusInput || loadingComments) return
    const t = setTimeout(() => {
      commentInputRef.current?.focus()
      if (scrollableRef.current) scrollableRef.current.scrollTop = scrollableRef.current.scrollHeight
    }, 50)
    return () => clearTimeout(t)
  }, [isSingle, focusInput, loadingComments])

  useEffect(() => {
    if (isSingle) return
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (openRecMenu) { setOpenRecMenu(false); return }
      if (expandedRecommender) { setExpandedRecommender(null); return }
      onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isSingle, openRecMenu, expandedRecommender, onClose])

  async function handleShare() {
    const primaryId = group.recommenders[0]?.recommendation_id
    if (!primaryId) return
    const url = `${window.location.origin}/rec/${primaryId}`
    const text = `Check out ${group.title} on Notable`
    if (navigator.share) {
      try { await navigator.share({ title: group.title, text, url }) } catch (_) {}
    } else {
      await navigator.clipboard.writeText(url)
      setShowCopied(true)
      setTimeout(() => setShowCopied(false), 2000)
    }
  }

  async function handleLike(e: React.MouseEvent) {
    e.stopPropagation()
    if (!currentUserId) return
    onLikeToggle(leadRec.recommendation_id, liked)
    if (liked) {
      setLiked(false); setLikeCount(c => c - 1)
      await supabaseRef.current.from('likes').delete()
        .eq('user_id', currentUserId).eq('recommendation_id', leadRec.recommendation_id)
    } else {
      setLiked(true); setLikeCount(c => c + 1)
      await supabaseRef.current.from('likes').insert({ user_id: currentUserId, recommendation_id: leadRec.recommendation_id })
      if (leadRec.user_id !== currentUserId) {
        void supabaseRef.current.from('notifications').insert({ user_id: leadRec.user_id, actor_id: currentUserId, type: 'like', rec_id: leadRec.recommendation_id, read: false })
      }
    }
  }

  async function handleBookmark(e: React.MouseEvent) {
    e.stopPropagation()
    if (!currentUserId) return
    onBookmarkToggle(leadRec.recommendation_id, bookmarked)
    if (bookmarked) {
      setBookmarked(false)
      await supabaseRef.current.from('bookmarks').delete()
        .eq('user_id', currentUserId).eq('recommendation_id', leadRec.recommendation_id)
    } else {
      setBookmarked(true)
      await supabaseRef.current.from('bookmarks').insert({ user_id: currentUserId, recommendation_id: leadRec.recommendation_id })
      if (leadRec.user_id !== currentUserId) {
        void supabaseRef.current.from('notifications').insert({ user_id: leadRec.user_id, actor_id: currentUserId, type: 'bookmark', rec_id: leadRec.recommendation_id, read: false })
      }
    }
  }

  async function handleComment(e: React.FormEvent) {
    e.preventDefault()
    if (!currentUserId || !commentInput.trim()) return
    setSubmittingComment(true)
    const text = commentInput.trim()
    setCommentInput('')
    const { data: inserted, error } = await supabaseRef.current.from('comments')
      .insert({ user_id: currentUserId, recommendation_id: leadRec.recommendation_id, text })
      .select('*')
      .single()
    if (error) console.error('[Notable] comment insert error:', error.message)
    if (!error && inserted) {
      const newComment: Comment = { ...inserted, profiles: currentUserProfile, comment_likes: [] }
      setComments(prev => sortComments([...prev, newComment]))
      setCommentCount(c => c + 1)
      onCommentCountChange?.(leadRec.recommendation_id, 1)
      if (leadRec.user_id !== currentUserId) {
        void supabaseRef.current.from('notifications').insert({ user_id: leadRec.user_id, actor_id: currentUserId, type: 'comment', rec_id: leadRec.recommendation_id, read: false })
      }
    }
    setSubmittingComment(false)
  }

  const singleRec: Recommendation = {
    id: leadRec.recommendation_id,
    user_id: leadRec.user_id,
    category: group.category,
    title: group.title,
    description: leadRec.description,
    image_url: group.image_url,
    external_url: leadRec.external_url,
    created_at: leadRec.created_at,
    profiles: leadRec.profile,
  }

  if (isSingle) {
    return (
      <RecModal
        rec={singleRec}
        accentColor={accentColor}
        liked={liked}
        bookmarked={bookmarked}
        likeCount={likeCount}
        commentCount={commentCount}
        comments={comments}
        loadingComments={loadingComments}
        commentInput={commentInput}
        submittingComment={submittingComment}
        currentUserProfile={currentUserProfile}
        currentUserId={currentUserId}
        commentInputRef={commentInputRef}
        focusInput={focusInput}
        onLike={handleLike}
        onBookmark={handleBookmark}
        onClose={onClose}
        onCommentChange={setCommentInput}
        onCommentSubmit={handleComment}
        onRecDeleted={() => onRecDeleted?.(singleRec.id)}
        onRecUpdated={onRecUpdated}
        onCommentCountChange={onCommentCountChange}
      />
    )
  }

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
        <div
          onClick={onClose}
          style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
        />
        <div
          style={{
            position: 'relative', zIndex: 1, background: theme.colors.surface,
            borderRadius: '20px 20px 0 0', width: '100%', maxWidth: '500px',
            maxHeight: 'calc(100dvh - 56px)', overflow: 'hidden', display: 'flex', flexDirection: 'column',
            boxShadow: theme.shadows.modal,
          }}
          className="modal-sheet"
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px 12px', flexShrink: 0 }}>
            <span className="font-body" style={{ color: theme.colors.textMuted, fontSize: '13px' }}>
              {group.recommenders.length} people recommended this
            </span>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
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
                {showCopied && (
                  <div style={{
                    position: 'absolute', bottom: '-30px', right: 0, zIndex: 10,
                    background: '#1a1a1a', color: '#fff', fontSize: '12px',
                    padding: '4px 10px', borderRadius: '6px', whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                  }}>
                    Link copied!
                  </div>
                )}
              </div>
              {currentUserId && (
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
                        {reportStep === 'thanks' ? (
                          <div className="font-body" style={{ padding: '10px 14px', color: theme.colors.textMuted, fontSize: '14px' }}>
                            Thank you — we&apos;ll review this.
                          </div>
                        ) : (
                          <button
                            onClick={() => { setReportStep('thanks'); setOpenRecMenu(false) }}
                            className="font-body"
                            style={{ display: 'block', width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', color: theme.colors.textMuted, fontSize: '14px', textAlign: 'left' }}
                          >
                            Report
                          </button>
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
                  color: theme.colors.textMuted, transition: 'background 0.15s',
                }}
              >
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div ref={scrollableRef} style={{ overflowY: 'auto', flex: 1 }}>
            {(!willEmbed(group.external_url, group.category, 'feed') || embedFailed) && (
              group.image_url && !imgError ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={group.image_url}
                  alt={group.title}
                  onError={() => setImgError(true)}
                  style={{ width: '100%', height: '200px', objectFit: 'contain', display: 'block', background: theme.colors.surface }}
                />
              ) : (
                <div style={{ width: '100%', height: '200px', background: `linear-gradient(135deg, ${accentColor}55, ${accentColor}22)` }} />
              )
            )}

            <h2
              className="font-display"
              style={{
                fontSize: '26px', fontWeight: 600, color: theme.colors.textPrimary,
                letterSpacing: '-0.02em', lineHeight: 1.25, padding: '16px 20px 0',
                marginBottom: group.external_url ? '6px' : '4px',
              }}
            >
              {group.title}
            </h2>

            {group.external_url && (
              <div style={{ padding: '0 20px 12px' }}>
                {willEmbed(group.external_url, group.category, 'feed') && !embedFailed ? (
                  <RichMediaEmbed external_url={group.external_url} category={group.category} context="feed" title={group.title} onEmbedFail={() => setEmbedFailed(true)} />
                ) : (
                  <ExternalLink href={group.external_url} label={getExternalLinkLabel(group.category, group.external_url)} color={accentColor} />
                )}
              </div>
            )}

            <div style={{ padding: '8px 20px 0' }}>
              <p className="font-body" style={{ color: theme.colors.textMuted, fontSize: '11px', letterSpacing: '0.07em', textTransform: 'uppercase', fontWeight: 500 }}>
                What people said
              </p>
            </div>

            {group.recommenders.map(recommender => (
              <RecommenderSection
                key={recommender.recommendation_id}
                recommender={recommender}
                category={group.category}
                title={group.title}
                accentColor={accentColor}
                currentUserId={currentUserId}
                currentUserProfile={currentUserProfile}
                onLikeToggle={onLikeToggle}
                onBookmarkToggle={onBookmarkToggle}
                onExpand={() => setExpandedRecommender(recommender)}
              />
            ))}

            <div style={{ height: '24px' }} />
          </div>
        </div>
      </div>

      {expandedRecommender && (
        <SingleRecDetailModal
          recommender={expandedRecommender}
          group={group}
          accentColor={accentColor}
          currentUserId={currentUserId}
          currentUserProfile={currentUserProfile}
          onLikeToggle={onLikeToggle}
          onBookmarkToggle={onBookmarkToggle}
          onClose={() => setExpandedRecommender(null)}
        />
      )}
    </>
  )
}
