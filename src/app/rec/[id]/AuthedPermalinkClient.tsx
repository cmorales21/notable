'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ClientProviders from '@/app/components/ClientProviders'
import AppShell from '@/app/components/AppShell'
import { RecCardExpanded } from '@/app/components/feed/RecCardExpanded'
import { fetchComments, sortComments } from '@/app/components/feed/helpers'
import { createClient } from '@/lib/supabase/client'
import { toggleEngagement } from '@/lib/engagement'
import { useToast } from '@/app/components/Toast'
import type { Recommendation, RecComment, RecProfile } from '@/app/lib/types'
import { theme } from '@/app/lib/theme'

type Profile = RecProfile

interface Props {
  rec: Recommendation
  viewerProfile: Profile | null
  viewerUserId: string
  initialLiked: boolean
  initialBookmarked: boolean
  initialLikeCount: number
  initialCommentCount: number
  initialComments: RecComment[]
  accentColor: string
  backHref: string
  backLabel: string
}

// Authed permalink render tree: ClientProviders (toast) → AppShell (app chrome)
// → in-flow "Back to [category]" link → card container → RecCardExpanded.
// Keeps its own like/bookmark/comment state; RecCardExpanded is presentation-only.
export default function AuthedPermalinkClient(props: Props) {
  return (
    <ClientProviders>
      <AppShell profile={props.viewerProfile} userId={props.viewerUserId}>
        <AuthedPermalinkInner {...props} />
      </AppShell>
    </ClientProviders>
  )
}

function AuthedPermalinkInner({
  rec,
  viewerProfile,
  viewerUserId,
  initialLiked,
  initialBookmarked,
  initialLikeCount,
  initialCommentCount,
  initialComments,
  accentColor,
  backHref,
  backLabel,
}: Props) {
  const router = useRouter()
  const supabaseRef = useRef(createClient())
  const commentInputRef = useRef<HTMLTextAreaElement>(null)
  const toast = useToast()

  const [liked, setLiked] = useState(initialLiked)
  const [bookmarked, setBookmarked] = useState(initialBookmarked)
  const [likeCount, setLikeCount] = useState(initialLikeCount)
  const [commentCount, setCommentCount] = useState(initialCommentCount)
  const [comments, setComments] = useState<RecComment[]>(initialComments)
  const [loadingComments, setLoadingComments] = useState(false)
  const [commentInput, setCommentInput] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)

  // Refresh comments on mount to catch any changes since SSR (the same pattern
  // GroupedModal uses when opening the modal from the feed).
  useEffect(() => {
    let cancelled = false
    setLoadingComments(true)
    fetchComments(supabaseRef.current, rec.id).then(sorted => {
      if (cancelled) return
      setComments(sorted)
      setCommentCount(sorted.length)
      setLoadingComments(false)
    })
    return () => { cancelled = true }
  }, [rec.id])

  async function handleLike(e: React.MouseEvent) {
    e.stopPropagation()
    await toggleEngagement(supabaseRef.current, {
      kind: 'like',
      scope: 'rec',
      targetId: rec.id,
      userId: viewerUserId,
      isActive: liked,
      apply: (active) => {
        setLiked(active)
        setLikeCount(c => c + (active ? 1 : -1))
      },
      toast,
    })
  }

  async function handleBookmark(e: React.MouseEvent) {
    e.stopPropagation()
    await toggleEngagement(supabaseRef.current, {
      kind: 'bookmark',
      scope: 'rec',
      targetId: rec.id,
      userId: viewerUserId,
      isActive: bookmarked,
      apply: (active) => {
        setBookmarked(active)
      },
      toast,
    })
  }

  async function handleCommentSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = commentInput.trim()
    if (!text) return
    setSubmittingComment(true)
    setCommentInput('')
    const { data: inserted, error } = await supabaseRef.current
      .from('comments')
      .insert({ user_id: viewerUserId, recommendation_id: rec.id, text })
      .select('*')
      .single()
    if (error || !inserted) {
      if (process.env.NODE_ENV !== 'production') console.error('[Notable] comment insert error:', error?.message)
      setCommentInput(text)
      toast('Couldn’t post your comment. Please try again.')
    } else {
      const newComment: RecComment = { ...inserted, profiles: viewerProfile, comment_likes: [] }
      setComments(prev => sortComments([...prev, newComment]))
      setCommentCount(c => c + 1)
      toast('Comment posted')
    }
    setSubmittingComment(false)
  }

  function handleRecDeleted() {
    router.push(backHref)
  }

  function handleCommentCountChange(_recId: string, delta: number) {
    setCommentCount(c => Math.max(0, c + delta))
  }

  return (
    <div style={{ padding: '24px 20px 80px' }}>
      <div style={{ maxWidth: '560px', margin: '0 auto' }}>
        <div style={{ marginBottom: '16px' }}>
          <Link
            href={backHref}
            className="font-body"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              color: theme.colors.textMuted, fontSize: '14px', textDecoration: 'none',
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
              strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            Back to {backLabel}
          </Link>
        </div>

        <div style={{
          background: theme.colors.surface,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: theme.radii.card,
          boxShadow: theme.shadows.card,
          overflow: 'hidden',
        }}>
          <RecCardExpanded
            layout="authed-page"
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
            currentUserProfile={viewerProfile}
            currentUserId={viewerUserId}
            commentInputRef={commentInputRef}
            focusInput={false}
            onLike={handleLike}
            onBookmark={handleBookmark}
            onCommentChange={setCommentInput}
            onCommentSubmit={handleCommentSubmit}
            onRecDeleted={handleRecDeleted}
            onCommentCountChange={handleCommentCountChange}
          />
        </div>
      </div>
    </div>
  )
}
