'use client'

import { useRef, useState } from 'react'
import { RecommendationImage } from '@/app/components/RecommendationImage'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { RichMediaEmbed, willEmbed } from '@/app/components/RichMediaEmbed'
import type { GroupedRecommendation, GroupedRecommender } from '@/lib/groupRecommendations'
import { Avatar, ActionButton, TeaserText } from './helpers'
import { LikeIcon, BookmarkIcon, CommentIcon } from './icons'
import { theme } from '@/app/lib/theme'
import { ReportModal } from './ReportModal'
import { useToast } from '@/app/components/Toast'

function OverlappingAvatars({ recommenders }: { recommenders: GroupedRecommender[] }) {
  const shown = recommenders.slice(0, 3)
  const extra = recommenders.length - shown.length
  const SIZE = 26

  return (
    <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
      {shown.map((r, i) => (
        <div
          key={r.recommendation_id}
          style={{ marginLeft: i === 0 ? 0 : -(SIZE * 0.28), zIndex: shown.length - i, position: 'relative', borderRadius: '50%', outline: '2px solid #ffffff' }}
        >
          <Avatar url={r.profile?.avatar_url} name={r.profile?.name} size={SIZE} />
        </div>
      ))}
      {extra > 0 && (
        <div
          style={{
            marginLeft: -(SIZE * 0.28), zIndex: 0,
            width: SIZE, height: SIZE, borderRadius: '50%',
            background: theme.colors.avatarFallback, outline: '2px solid #ffffff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '9px', fontWeight: 600, color: theme.colors.textMuted,
          }}
        >
          +{extra}
        </div>
      )}
    </div>
  )
}

function getAttributionText(
  recommenders: GroupedRecommender[],
  tab: 'discovery' | 'following',
): string {
  const n = recommenders.length
  if (n <= 1) return ''
  const name = (r: GroupedRecommender) => r.profile?.name ?? r.profile?.handle ?? 'Someone'

  if (tab === 'discovery' && n >= 4) {
    return `Recommended by ${n.toLocaleString()} people`
  }

  if (n === 2) return `Recommended by ${name(recommenders[0])} and ${name(recommenders[1])}`
  const allButLast = recommenders.slice(0, -1).map(name).join(', ')
  return `Recommended by ${allButLast} and ${name(recommenders[n - 1])}`
}

export function GroupedCard({
  group,
  accentColor,
  tab,
  currentUserId,
  onLike,
  onBookmark,
  onClick,
  onCommentClick,
  onIgnore,
  onDelete,
}: {
  group: GroupedRecommendation
  accentColor: string
  tab: 'discovery' | 'following'
  currentUserId?: string | null
  onLike: (e: React.MouseEvent) => void
  onBookmark: (e: React.MouseEvent) => void
  onClick: () => void
  onCommentClick: (e: React.MouseEvent) => void
  onIgnore?: (userId: string, userName: string) => void
  onDelete?: (recId: string) => void
}) {
  const toast = useToast()
  const supabaseRef = useRef(createClient())
  const leadRec = group.recommenders[0]
  const isMulti = group.recommenders.length > 1
  const [imageHovered, setImageHovered] = useState(false)
  const [imgError, setImgError] = useState(false)
  const [embedFailed, setEmbedFailed] = useState(false)
  const [openMenu, setOpenMenu] = useState(false)
  const [ignoreConfirm, setIgnoreConfirm] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [likeAnim, setLikeAnim] = useState<'pop' | 'shrink' | null>(null)
  const [bookmarkAnim, setBookmarkAnim] = useState<boolean>(false)

  const liked = leadRec.is_liked_by_user
  const bookmarked = leadRec.is_bookmarked_by_user
  const isOwnCard = !isMulti && currentUserId != null && leadRec.user_id === currentUserId
  const isOtherCard = !isMulti && currentUserId != null && leadRec.user_id !== currentUserId
  const showMenu = isOwnCard || isOtherCard

  async function doDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (!currentUserId) return
    await supabaseRef.current.from('recommendations')
      .delete()
      .eq('id', leadRec.recommendation_id)
      .eq('user_id', currentUserId)
    setDeleteConfirm(false)
    onDelete?.(leadRec.recommendation_id)
    toast('Recommendation removed')
  }

  function doIgnoreConfirm(e: React.MouseEvent) {
    e.stopPropagation()
    setOpenMenu(false)
    setIgnoreConfirm(true)
  }

  function doDeleteConfirm(e: React.MouseEvent) {
    e.stopPropagation()
    setOpenMenu(false)
    setDeleteConfirm(true)
  }

  function doIgnore(e: React.MouseEvent) {
    e.stopPropagation()
    const name = leadRec.profile?.name ?? leadRec.profile?.handle ?? 'this person'
    setIgnoreConfirm(false)
    onIgnore?.(leadRec.user_id, name)
  }

  const leadName = leadRec.profile?.name ?? leadRec.profile?.handle ?? 'this person'

  async function reportRec(reason: string, details: string) {
    if (!currentUserId) return
    const fullReason = details ? `${reason} — ${details}` : reason
    await supabaseRef.current.from('recommendation_reports').insert({
      recommendation_id: leadRec.recommendation_id,
      reporter_id: currentUserId,
      reason: fullReason,
    })
    toast('Report submitted')
  }

  return (
    <div style={{ position: 'relative' }}>
    <div
      onClick={onClick}
      style={{
        background: theme.colors.surface, borderRadius: '16px',
        border: `1px solid ${theme.colors.border}`, overflow: 'hidden',
        cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s',
      }}
      className="rec-card"
    >
      {/* Recommender row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px 0' }}>
        {isMulti ? (
          <>
            <OverlappingAvatars recommenders={group.recommenders} />
            <span className="font-body" style={{ color: '#6b5d4f', fontSize: '13px', lineHeight: 1.3, flex: 1, minWidth: 0 }}>
              {getAttributionText(group.recommenders, tab)}
            </span>
          </>
        ) : (
          <>
            {leadRec.profile?.handle ? (
              <Link href={`/profile/${leadRec.profile.handle}`} onClick={e => e.stopPropagation()} style={{ lineHeight: 0 }}>
                <Avatar url={leadRec.profile.avatar_url} name={leadRec.profile.name} size={32} />
              </Link>
            ) : (
              <Avatar url={leadRec.profile?.avatar_url} name={leadRec.profile?.name} size={32} />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              {leadRec.profile?.handle ? (
                <Link href={`/profile/${leadRec.profile.handle}`} onClick={e => e.stopPropagation()} className="font-body"
                  style={{ color: theme.colors.textPrimary, fontSize: '14px', fontWeight: 500, textDecoration: 'none' }}>
                  {leadRec.profile.name ?? 'Unknown'}
                </Link>
              ) : (
                <span className="font-body" style={{ color: theme.colors.textPrimary, fontSize: '14px', fontWeight: 500 }}>
                  {leadRec.profile?.name ?? 'Unknown'}
                </span>
              )}
              {leadRec.profile?.handle && (
                <span className="font-body" style={{ color: theme.colors.textMuted, fontSize: '13px' }}>
                  {' · '}@{leadRec.profile.handle}
                </span>
              )}
            </div>
          </>
        )}

        {/* Three-dot menu */}
        {showMenu && (
          <div style={{ position: 'relative', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
            <button
              onClick={e => { e.stopPropagation(); setOpenMenu(v => !v) }}
              style={{
                width: '28px', height: '28px', borderRadius: '50%',
                background: openMenu ? 'rgba(0,0,0,0.08)' : 'transparent',
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: theme.colors.textMuted, transition: 'background 0.15s',
              }}
              aria-label="More options"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                <circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" />
              </svg>
            </button>
            {openMenu && (
              <>
                <div onClick={() => setOpenMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 0 }} />
                <div style={{
                  position: 'absolute', top: '32px', right: 0, zIndex: 10,
                  background: theme.colors.surface, border: '1px solid rgba(0,0,0,0.1)',
                  borderRadius: '10px', overflow: 'hidden', minWidth: '160px',
                  boxShadow: theme.shadows.menu,
                }}>
                  {isOtherCard && (
                    <>
                      <button
                        onClick={doIgnoreConfirm}
                        className="font-body"
                        style={{ display: 'block', width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', color: theme.colors.textMuted, fontSize: '14px', textAlign: 'left' }}
                      >
                        Ignore {leadName}
                      </button>
                      <div style={{ height: '1px', background: theme.colors.border }} />
                      <button
                        onClick={e => { e.stopPropagation(); setOpenMenu(false); setShowReport(true) }}
                        className="font-body"
                        style={{ display: 'block', width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', color: theme.colors.textMuted, fontSize: '14px', textAlign: 'left' }}
                      >
                        Report
                      </button>
                    </>
                  )}
                  {isOwnCard && !isMulti && (
                    <button
                      onClick={doDeleteConfirm}
                      className="font-body"
                      style={{ display: 'block', width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', color: theme.colors.error, fontSize: '14px', textAlign: 'left' }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <TeaserText
        text={leadRec.description}
        accentColor={accentColor}
        attribution={isMulti ? { name: leadRec.profile?.name ?? null, avatarUrl: leadRec.profile?.avatar_url } : undefined}
      />

      {/* Image / Embed */}
      {willEmbed(leadRec.external_url, group.category, 'feed') && !embedFailed ? (
        <div style={{ padding: '0 16px' }}>
          <RichMediaEmbed external_url={leadRec.external_url!} category={group.category} context="feed" title={group.title} onEmbedFail={() => setEmbedFailed(true)} />
        </div>
      ) : !!group.image_url && !imgError ? (
        <div style={{ height: '280px', overflow: 'hidden', position: 'relative', background: theme.colors.surface }}>
          {leadRec.external_url ? (
            <a
              href={leadRec.external_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              onMouseEnter={() => setImageHovered(true)}
              onMouseLeave={() => setImageHovered(false)}
              style={{ display: 'block', height: '100%', position: 'relative' }}
            >
              <RecommendationImage fill src={group.image_url} category={group.category} alt={group.title} sizes="(max-width: 768px) 100vw, 50vw" onFallback={() => setImgError(true)} style={{ objectFit: 'contain', background: theme.colors.surface }} />
              <div style={{
                position: 'absolute', top: '8px', right: '8px',
                background: 'rgba(0,0,0,0.55)', borderRadius: '7px',
                width: '28px', height: '28px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: imageHovered ? 1 : 0, transition: 'opacity 0.15s',
                backdropFilter: 'blur(4px)', pointerEvents: 'none',
              }}>
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 17L17 7M17 7H7M17 7v10" />
                </svg>
              </div>
            </a>
          ) : (
            <RecommendationImage fill src={group.image_url} category={group.category} alt={group.title} sizes="(max-width: 768px) 100vw, 50vw" onFallback={() => setImgError(true)} style={{ objectFit: 'contain', background: theme.colors.surface }} />
          )}
        </div>
      ) : null}

      <div style={{ padding: '8px 16px 10px' }}>
        <h2
          className="font-display"
          style={{
            fontSize: '20px', fontWeight: 600, color: theme.colors.textPrimary,
            letterSpacing: '-0.01em', marginBottom: '6px',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}
        >
          {group.title}
        </h2>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <ActionButton
            onClick={(e) => {
              setLikeAnim(liked ? 'shrink' : 'pop')
              setTimeout(() => setLikeAnim(null), liked ? 150 : 350)
              onLike(e)
            }}
            active={liked} activeColor={accentColor} label="Like"
          >
            <span style={{ display: 'inline-flex' }} className={likeAnim === 'pop' ? 'like-pop' : likeAnim === 'shrink' ? 'like-shrink' : undefined}>
              <LikeIcon filled={liked} color={liked ? accentColor : theme.colors.textMuted} />
            </span>
            <span style={{ fontSize: '13px', fontWeight: 500, color: liked ? accentColor : theme.colors.textMuted, transition: 'color 0.15s' }}>
              {group.total_likes > 0 ? group.total_likes : ''}
            </span>
          </ActionButton>
          <ActionButton
            onClick={(e) => {
              if (!bookmarked) { setBookmarkAnim(true); setTimeout(() => setBookmarkAnim(false), 250) }
              onBookmark(e)
            }}
            active={bookmarked} activeColor={accentColor} label="Bookmark"
          >
            <span style={{ display: 'inline-flex' }} className={bookmarkAnim ? 'bm-bounce' : undefined}>
              <BookmarkIcon filled={bookmarked} color={bookmarked ? accentColor : theme.colors.textMuted} />
            </span>
          </ActionButton>
          <ActionButton onClick={onCommentClick} active={false} activeColor={accentColor} label="Comments">
            <CommentIcon color={theme.colors.textMuted} />
            <span style={{ fontSize: '13px', fontWeight: 500, color: theme.colors.textMuted }}>
              {group.total_comments > 0 ? group.total_comments : ''}
            </span>
          </ActionButton>
        </div>
      </div>

      {/* Ignore confirmation overlay */}
      {ignoreConfirm && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'absolute', inset: 0, zIndex: 10,
            background: 'rgba(245,240,232,0.96)', backdropFilter: 'blur(4px)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '20px', gap: '10px', borderRadius: '16px',
          }}
        >
          <p className="font-display" style={{ fontSize: '16px', fontWeight: 600, color: theme.colors.textPrimary, textAlign: 'center' }}>
            Ignore {leadName}?
          </p>
          <p className="font-body" style={{ fontSize: '13px', color: theme.colors.textMuted, textAlign: 'center', lineHeight: 1.5 }}>
            You won&apos;t see their recommendations in your feeds. You can undo this in Settings.
          </p>
          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <button
              onClick={e => { e.stopPropagation(); setIgnoreConfirm(false) }}
              className="font-body"
              style={{ padding: '8px 18px', background: theme.colors.border, border: 'none', borderRadius: '8px', color: theme.colors.textMuted, fontSize: '13px', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              onClick={doIgnore}
              className="font-body"
              style={{ padding: '8px 18px', background: theme.colors.textPrimary, border: 'none', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
            >
              Ignore
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation overlay */}
      {deleteConfirm && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'absolute', inset: 0, zIndex: 10,
            background: 'rgba(245,240,232,0.96)', backdropFilter: 'blur(4px)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '20px', gap: '10px', borderRadius: '16px',
          }}
        >
          <p className="font-display" style={{ fontSize: '16px', fontWeight: 600, color: theme.colors.textPrimary, textAlign: 'center' }}>
            Delete this recommendation?
          </p>
          <p className="font-body" style={{ fontSize: '13px', color: theme.colors.textMuted, textAlign: 'center' }}>
            This can&apos;t be undone.
          </p>
          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <button
              onClick={e => { e.stopPropagation(); setDeleteConfirm(false) }}
              className="font-body"
              style={{ padding: '8px 18px', background: theme.colors.border, border: 'none', borderRadius: '8px', color: theme.colors.textMuted, fontSize: '13px', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              onClick={doDelete}
              className="font-body"
              style={{ padding: '8px 18px', background: theme.colors.error, border: 'none', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>

    {showReport && (
      <ReportModal
        title={`Report "${group.title}"`}
        onSubmit={reportRec}
        onClose={() => setShowReport(false)}
        zIndex={200}
      />
    )}
    </div>
  )
}
