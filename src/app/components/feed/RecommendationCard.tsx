'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import type { Recommendation } from '@/app/lib/types'
import { Avatar, ActionButton, TeaserText } from './helpers'
import { LikeIcon, BookmarkIcon, CommentIcon } from './icons'

export function RecommendationCard({
  rec,
  accentColor,
  liked,
  bookmarked,
  likeCount,
  commentCount,
  onLike,
  onBookmark,
  onClick,
  onCommentClick,
}: {
  rec: Recommendation
  accentColor: string
  liked: boolean
  bookmarked: boolean
  likeCount: number
  commentCount: number
  onLike: (e: React.MouseEvent) => void
  onBookmark: (e: React.MouseEvent) => void
  onClick: () => void
  onCommentClick: (e: React.MouseEvent) => void
}) {
  const profile = rec.profiles
  const [imageHovered, setImageHovered] = useState(false)
  const [imgError, setImgError] = useState(false)

  return (
    <div
      onClick={onClick}
      style={{
        background: '#faf8f4', borderRadius: '16px',
        border: '1px solid rgba(0,0,0,0.08)', overflow: 'hidden',
        cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s',
      }}
      className="rec-card"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px 0' }}>
        {profile?.handle ? (
          <Link href={`/profile/${profile.handle}`} onClick={e => e.stopPropagation()} style={{ lineHeight: 0 }}>
            <Avatar url={profile.avatar_url} name={profile.name} size={32} />
          </Link>
        ) : (
          <Avatar url={profile?.avatar_url} name={profile?.name} size={32} />
        )}
        <div>
          {profile?.handle ? (
            <Link href={`/profile/${profile.handle}`} onClick={e => e.stopPropagation()} className="font-body"
              style={{ color: '#33261a', fontSize: '14px', fontWeight: 500, textDecoration: 'none' }}>
              {profile.name ?? 'Unknown'}
            </Link>
          ) : (
            <span className="font-body" style={{ color: '#33261a', fontSize: '14px', fontWeight: 500 }}>
              {profile?.name ?? 'Unknown'}
            </span>
          )}
          {profile?.handle && (
            <span className="font-body" style={{ color: '#6b5d4f', fontSize: '13px' }}>
              {' · '}@{profile.handle}
            </span>
          )}
        </div>
      </div>

      <TeaserText text={rec.description} accentColor={accentColor} />

      <div style={{ height: '280px', overflow: 'hidden', position: 'relative', background: '#faf8f4' }}>
        {rec.external_url ? (
          <a
            href={rec.external_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            onMouseEnter={() => setImageHovered(true)}
            onMouseLeave={() => setImageHovered(false)}
            style={{ display: 'block', height: '100%', position: 'relative' }}
          >
            {rec.image_url && !imgError ? (
              <Image src={rec.image_url} alt={rec.title} fill onError={() => setImgError(true)} sizes="(max-width: 768px) 100vw, 50vw" style={{ objectFit: 'contain', background: '#faf8f4' }} />
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
          rec.image_url && !imgError ? (
            <Image src={rec.image_url} alt={rec.title} fill onError={() => setImgError(true)} sizes="(max-width: 768px) 100vw, 50vw" style={{ objectFit: 'contain', background: '#faf8f4' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${accentColor}55, ${accentColor}22)` }} />
          )
        )}
      </div>

      <div style={{ padding: '8px 16px 10px' }}>
        <h2
          className="font-display"
          style={{ fontSize: '20px', fontWeight: 600, color: '#33261a', letterSpacing: '-0.01em', marginBottom: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
        >
          {rec.title}
        </h2>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <ActionButton onClick={onLike} active={liked} activeColor={accentColor} label="Like">
            <LikeIcon filled={liked} color={liked ? accentColor : '#6b5d4f'} />
            <span style={{ fontSize: '13px', fontWeight: 500, color: liked ? accentColor : '#6b5d4f', transition: 'color 0.15s' }}>
              {likeCount > 0 ? likeCount : ''}
            </span>
          </ActionButton>
          <ActionButton onClick={onBookmark} active={bookmarked} activeColor={accentColor} label="Bookmark">
            <BookmarkIcon filled={bookmarked} color={bookmarked ? accentColor : '#6b5d4f'} />
          </ActionButton>
          <ActionButton onClick={onCommentClick} active={false} activeColor={accentColor} label="Comments">
            <CommentIcon color="#6b5d4f" />
            <span style={{ fontSize: '13px', fontWeight: 500, color: '#6b5d4f' }}>
              {commentCount > 0 ? commentCount : ''}
            </span>
          </ActionButton>
        </div>
      </div>
    </div>
  )
}
