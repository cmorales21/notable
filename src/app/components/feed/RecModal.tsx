'use client'

import type { Recommendation, RecComment, RecProfile } from '@/app/lib/types'
import { theme } from '@/app/lib/theme'
import { RecCardExpanded } from './RecCardExpanded'

type Profile = RecProfile
type Comment = RecComment

// RecModal is a thin overlay shell around RecCardExpanded. The card body itself
// (recommender row, description, image, title, external link, action row,
// comments, sticky comment input, sub-overlays) is owned by RecCardExpanded so
// the /rec/[id] permalink can render identical content in-flow.
// Public API is unchanged — GroupedModal and CategoryFeed drive this component
// exactly as before.
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
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      />
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
        <RecCardExpanded
          layout="modal"
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
          focusInput={focusInput}
          onLike={onLike}
          onBookmark={onBookmark}
          onClose={onClose}
          onCommentChange={onCommentChange}
          onCommentSubmit={onCommentSubmit}
          onRecDeleted={onRecDeleted}
          onRecUpdated={onRecUpdated}
          onCommentCountChange={onCommentCountChange}
          onIgnore={onIgnore}
          context={context}
        />
      </div>
    </div>
  )
}
