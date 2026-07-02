'use client'

import { useEffect, useRef, useState } from 'react'
import { RecommendationImage } from '@/app/components/RecommendationImage'
import { createClient } from '@/lib/supabase/client'
import { toggleEngagement } from '@/lib/engagement'
import { RichMediaEmbed, willEmbed } from '@/app/components/RichMediaEmbed'
import type { Recommendation, RecComment, RecProfile } from '@/app/lib/types'
import type { GroupedRecommendation, GroupedRecommender } from '@/lib/groupRecommendations'
import { ExternalLink, getExternalLinkLabel, fetchComments, sortComments } from './helpers'
import { trackClick } from '@/lib/items'
import { theme } from '@/app/lib/theme'
import { RecModal } from './RecModal'
import { RecommenderSection } from './RecommenderSection'
import { ReportModal } from './ReportModal'
import { useToast } from '@/app/components/Toast'

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
  onIgnore,
  onRecUpdated,
}: {
  recommender: GroupedRecommender
  group: GroupedRecommendation
  accentColor: string
  currentUserId: string | null
  currentUserProfile: Profile | null
  onLikeToggle: (recId: string, wasLiked: boolean) => void
  onBookmarkToggle: (recId: string, wasBookmarked: boolean) => void
  onClose: () => void
  onIgnore?: (userId: string, userName: string) => void
  onRecUpdated?: (recId: string, newDescription: string) => void
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
    await toggleEngagement(supabaseRef.current, {
      kind: 'like',
      scope: 'rec',
      targetId: recommender.recommendation_id,
      userId: currentUserId,
      isActive: liked,
      apply: (active) => {
        onLikeToggle(recommender.recommendation_id, !active)
        setLiked(active)
        setLikeCount(c => c + (active ? 1 : -1))
      },
    })
  }

  async function handleBookmark(e: React.MouseEvent) {
    e.stopPropagation()
    if (!currentUserId) return
    await toggleEngagement(supabaseRef.current, {
      kind: 'bookmark',
      scope: 'rec',
      targetId: recommender.recommendation_id,
      userId: currentUserId,
      isActive: bookmarked,
      apply: (active) => {
        onBookmarkToggle(recommender.recommendation_id, !active)
        setBookmarked(active)
      },
    })
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
    if (error && process.env.NODE_ENV !== 'production') console.error('[Notable] comment insert error:', error.message)
    if (!error && inserted) {
      const newComment: Comment = { ...inserted, profiles: currentUserProfile, comment_likes: [] }
      setComments(prev => sortComments([...prev, newComment]))
      setCommentCount(c => c + 1)
      if (recommender.user_id !== currentUserId) {
        const { data: recipientProfile } = await supabaseRef.current
          .from('profiles').select('notify_comments').eq('id', recommender.user_id).single()
        if (recipientProfile?.notify_comments !== false) {
          void supabaseRef.current.from('notifications').insert({ user_id: recommender.user_id, actor_id: currentUserId, type: 'comment', rec_id: recommender.recommendation_id, read: false })
        }
      }
      // Parse @mentions and notify mentioned users
      const handles = [...new Set([...text.matchAll(/@([a-zA-Z0-9_]+)/g)].map(m => m[1]))]
      if (handles.length > 0) {
        supabaseRef.current.from('profiles').select('id, handle').in('handle', handles)
          .then(({ data: mentioned }) => {
            const rows = (mentioned ?? [])
              .filter((p: { id: string }) => p.id !== currentUserId)
              .map((p: { id: string }) => ({
                user_id: p.id, actor_id: currentUserId, type: 'mention',
                rec_id: recommender.recommendation_id, read: false,
              }))
            if (rows.length > 0) {
              supabaseRef.current.from('notifications').insert(rows)
            }
          })
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
    item_id: recommender.item_id,
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
      onIgnore={onIgnore}
      onRecUpdated={onRecUpdated}
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
  onIgnore,
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
  onIgnore?: (userId: string, userName: string) => void
}) {
  const isSingle = group.recommenders.length === 1
  const leadRec = group.recommenders[0]
  const supabaseRef = useRef(createClient())
  const scrollableRef = useRef<HTMLDivElement>(null)
  const commentInputRef = useRef<HTMLTextAreaElement>(null)
  const [embedFailed, setEmbedFailed] = useState(false)
  const [imgError, setImgError] = useState(false)
  const [expandedRecommender, setExpandedRecommender] = useState<GroupedRecommender | null>(null)
  const toast = useToast()
  const [openRecMenu, setOpenRecMenu] = useState(false)
  const [reportingRec, setReportingRec] = useState(false)

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
      if (reportingRec) { setReportingRec(false); return }
      if (openRecMenu) { setOpenRecMenu(false); return }
      if (expandedRecommender) { setExpandedRecommender(null); return }
      onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isSingle, reportingRec, openRecMenu, expandedRecommender, onClose])

  async function handleShare() {
    const primaryId = group.recommenders[0]?.recommendation_id
    if (!primaryId) return
    const url = `${window.location.origin}/rec/${primaryId}`
    await navigator.clipboard.writeText(url)
    toast('Link copied')
  }

  async function reportRec(reason: string, details: string) {
    if (!currentUserId) return
    const primaryId = group.recommenders[0]?.recommendation_id
    if (!primaryId) return
    const fullReason = details ? `${reason} — ${details}` : reason
    await supabaseRef.current.from('recommendation_reports').insert({ recommendation_id: primaryId, reporter_id: currentUserId, reason: fullReason })
    toast('Report submitted')
  }

  async function handleLike(e: React.MouseEvent) {
    e.stopPropagation()
    if (!currentUserId) return
    toast(liked ? 'Unliked' : 'Liked')
    await toggleEngagement(supabaseRef.current, {
      kind: 'like',
      scope: 'rec',
      targetId: leadRec.recommendation_id,
      userId: currentUserId,
      isActive: liked,
      apply: (active) => {
        onLikeToggle(leadRec.recommendation_id, !active)
        setLiked(active)
        setLikeCount(c => c + (active ? 1 : -1))
      },
    })
  }

  async function handleBookmark(e: React.MouseEvent) {
    e.stopPropagation()
    if (!currentUserId) return
    toast(bookmarked ? 'Removed from saved' : 'Saved')
    await toggleEngagement(supabaseRef.current, {
      kind: 'bookmark',
      scope: 'rec',
      targetId: leadRec.recommendation_id,
      userId: currentUserId,
      isActive: bookmarked,
      apply: (active) => {
        onBookmarkToggle(leadRec.recommendation_id, !active)
        setBookmarked(active)
      },
    })
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
    if (error && process.env.NODE_ENV !== 'production') console.error('[Notable] comment insert error:', error.message)
    if (!error && inserted) {
      const newComment: Comment = { ...inserted, profiles: currentUserProfile, comment_likes: [] }
      setComments(prev => sortComments([...prev, newComment]))
      setCommentCount(c => c + 1)
      onCommentCountChange?.(leadRec.recommendation_id, 1)
      toast('Comment posted')
      if (leadRec.user_id !== currentUserId) {
        const { data: recipientProfile } = await supabaseRef.current
          .from('profiles').select('notify_comments').eq('id', leadRec.user_id).single()
        if (recipientProfile?.notify_comments !== false) {
          void supabaseRef.current.from('notifications').insert({ user_id: leadRec.user_id, actor_id: currentUserId, type: 'comment', rec_id: leadRec.recommendation_id, read: false })
        }
      }
      // Parse @mentions and notify mentioned users
      const handles = [...new Set([...text.matchAll(/@([a-zA-Z0-9_]+)/g)].map(m => m[1]))]
      if (handles.length > 0) {
        supabaseRef.current.from('profiles').select('id, handle').in('handle', handles)
          .then(({ data: mentioned }) => {
            const rows = (mentioned ?? [])
              .filter((p: { id: string }) => p.id !== currentUserId)
              .map((p: { id: string }) => ({
                user_id: p.id, actor_id: currentUserId, type: 'mention',
                rec_id: leadRec.recommendation_id, read: false,
              }))
            if (rows.length > 0) {
              supabaseRef.current.from('notifications').insert(rows)
            }
          })
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
    item_id: leadRec.item_id,
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
        onIgnore={onIgnore}
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
                        <button
                          onClick={() => { setOpenRecMenu(false); setReportingRec(true) }}
                          className="font-body"
                          style={{ display: 'block', width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', color: theme.colors.textMuted, fontSize: '14px', textAlign: 'left' }}
                        >
                          Report
                        </button>
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

          {reportingRec && (
            <ReportModal
              title="Report this recommendation"
              onSubmit={reportRec}
              onClose={() => setReportingRec(false)}
              zIndex={110}
            />
          )}

          <div ref={scrollableRef} style={{ overflowY: 'auto', flex: 1 }}>
            {(!willEmbed(group.external_url, group.category, 'feed') || embedFailed) && !!group.image_url && !imgError && (
              <div style={{ position: 'relative', width: '100%', height: '200px', background: theme.colors.surface }}>
                <RecommendationImage fill src={group.image_url} category={group.category} alt={group.title} sizes="500px" onFallback={() => setImgError(true)} style={{ objectFit: 'contain' }} />
              </div>
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
                {willEmbed(group.external_url, group.category, 'feed') && !embedFailed && (
                  <RichMediaEmbed external_url={group.external_url} category={group.category} context="feed" title={group.title} onEmbedFail={() => setEmbedFailed(true)} />
                )}
                <ExternalLink
                  href={group.external_url}
                  label={getExternalLinkLabel(group.category, group.external_url)}
                  color={accentColor}
                  onTrackClick={leadRec.item_id && currentUserId ? () => trackClick({ itemId: leadRec.item_id!, userId: currentUserId!, category: group.category, source: 'modal' }) : undefined}
                />
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
                onIgnore={onIgnore}
                onRecUpdated={onRecUpdated}
                onClose={onClose}
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
          onIgnore={onIgnore}
          onRecUpdated={onRecUpdated}
        />
      )}
    </>
  )
}
