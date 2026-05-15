'use client'

import { useState } from 'react'
import Link from 'next/link'
import { RichMediaEmbed, willEmbed } from '@/app/components/RichMediaEmbed'
import type { GroupedRecommendation, GroupedRecommender } from '@/lib/groupRecommendations'
import { Avatar, ActionButton, TeaserText } from './helpers'
import { LikeIcon, BookmarkIcon, CommentIcon } from './icons'
import { theme } from '@/app/lib/theme'
import Whisper from '@/app/components/Whisper'

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

  // ≤3 in Discovery, or any count in Following: list names
  if (n === 2) return `Recommended by ${name(recommenders[0])} and ${name(recommenders[1])}`
  const allButLast = recommenders.slice(0, -1).map(name).join(', ')
  return `Recommended by ${allButLast} and ${name(recommenders[n - 1])}`
}

export function GroupedCard({
  group,
  accentColor,
  tab,
  showWhisper,
  onLike,
  onBookmark,
  onClick,
  onCommentClick,
}: {
  group: GroupedRecommendation
  accentColor: string
  tab: 'discovery' | 'following'
  showWhisper?: boolean
  onLike: (e: React.MouseEvent) => void
  onBookmark: (e: React.MouseEvent) => void
  onClick: () => void
  onCommentClick: (e: React.MouseEvent) => void
}) {
  const leadRec = group.recommenders[0]
  const isMulti = group.recommenders.length > 1
  const [imageHovered, setImageHovered] = useState(false)
  const [imgError, setImgError] = useState(false)
  const [embedFailed, setEmbedFailed] = useState(false)

  const liked = leadRec.is_liked_by_user
  const bookmarked = leadRec.is_bookmarked_by_user

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
            <span className="font-body" style={{ color: '#b0a290', fontSize: '13px', lineHeight: 1.3 }}>
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
            <div>
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
      ) : (
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
              {group.image_url && !imgError ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={group.image_url} alt={group.title} loading="lazy" onError={() => setImgError(true)} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', background: theme.colors.surface }} />
              ) : (
                <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${accentColor}55, ${accentColor}22)` }} />
              )}
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
            group.image_url && !imgError ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={group.image_url} alt={group.title} loading="lazy" onError={() => setImgError(true)} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', background: theme.colors.surface }} />
            ) : (
              <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${accentColor}55, ${accentColor}22)` }} />
            )
          )}
        </div>
      )}

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
          <ActionButton onClick={onLike} active={liked} activeColor={accentColor} label="Like">
            <LikeIcon filled={liked} color={liked ? accentColor : theme.colors.textMuted} />
            <span style={{ fontSize: '13px', fontWeight: 500, color: liked ? accentColor : theme.colors.textMuted, transition: 'color 0.15s' }}>
              {group.total_likes > 0 ? group.total_likes : ''}
            </span>
          </ActionButton>
          <ActionButton onClick={onBookmark} active={bookmarked} activeColor={accentColor} label="Bookmark">
            <BookmarkIcon filled={bookmarked} color={bookmarked ? accentColor : theme.colors.textMuted} />
          </ActionButton>
          <ActionButton onClick={onCommentClick} active={false} activeColor={accentColor} label="Comments">
            <CommentIcon color={theme.colors.textMuted} />
            <span style={{ fontSize: '13px', fontWeight: 500, color: theme.colors.textMuted }}>
              {group.total_comments > 0 ? group.total_comments : ''}
            </span>
          </ActionButton>
        </div>
      </div>
    </div>

    {showWhisper && (
      <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 40 }}>
        <Whisper id="grouped-card" message="More than one person loved this. Tap to see what they're saying." />
      </div>
    )}
    </div>
  )
}
