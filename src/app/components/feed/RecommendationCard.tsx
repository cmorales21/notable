'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { RecommendationImage } from '@/app/components/RecommendationImage'
import type { Recommendation } from '@/app/lib/types'
import { Avatar, ActionButton, TeaserText } from './helpers'
import { LikeIcon, BookmarkIcon, CommentIcon } from './icons'
import { trackImpression, trackExpand } from '@/lib/items'
import { safeExternalHref } from '@/lib/url'

const loggedImpressions = new Set<string>()
const loggedExpands = new Set<string>()

export function RecommendationCard({
  rec,
  accentColor,
  liked,
  bookmarked,
  likeCount,
  commentCount,
  currentUserId,
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
  currentUserId?: string | null
  onLike: (e: React.MouseEvent) => void
  onBookmark: (e: React.MouseEvent) => void
  onClick: () => void
  onCommentClick: (e: React.MouseEvent) => void
}) {
  const profile = rec.profiles
  const cardRef = useRef<HTMLDivElement>(null)
  const [imageHovered, setImageHovered] = useState(false)
  const [imgError, setImgError] = useState(false)
  const [likeAnim, setLikeAnim] = useState<'pop' | 'shrink' | null>(null)
  const [bookmarkAnim, setBookmarkAnim] = useState(false)

  useEffect(() => {
    if (!rec.item_id || !currentUserId) return
    const el = cardRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loggedImpressions.has(rec.item_id!)) {
          loggedImpressions.add(rec.item_id!)
          trackImpression(rec.item_id!, currentUserId, rec.category)
        }
        observer.disconnect()
      },
      { threshold: 0.5 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [rec.item_id, currentUserId, rec.category])

  return (
    <div
      ref={cardRef}
      onClick={() => {
        if (rec.item_id && currentUserId && !loggedExpands.has(rec.item_id)) {
          loggedExpands.add(rec.item_id)
          trackExpand(rec.item_id, currentUserId, rec.category)
        }
        onClick()
      }}
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

      {!!rec.image_url && !imgError && (
        <div style={{ height: '280px', overflow: 'hidden', position: 'relative', background: '#faf8f4' }}>
          {(() => {
            const safeHref = safeExternalHref(rec.external_url)
            return safeHref ? (
              <a
                href={safeHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                onMouseEnter={() => setImageHovered(true)}
                onMouseLeave={() => setImageHovered(false)}
                style={{ display: 'block', height: '100%', position: 'relative' }}
              >
                <RecommendationImage fill src={rec.image_url} category={rec.category} alt={rec.title} sizes="(max-width: 768px) 100vw, 50vw" onFallback={() => setImgError(true)} style={{ objectFit: 'contain', background: '#faf8f4' }} />
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
              <RecommendationImage fill src={rec.image_url} category={rec.category} alt={rec.title} sizes="(max-width: 768px) 100vw, 50vw" onFallback={() => setImgError(true)} style={{ objectFit: 'contain', background: '#faf8f4' }} />
            )
          })()}
        </div>
      )}

      <div style={{ padding: '8px 16px 10px' }}>
        <h2
          className="font-display"
          style={{ fontSize: '20px', fontWeight: 600, color: '#33261a', letterSpacing: '-0.01em', marginBottom: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
        >
          {rec.title}
        </h2>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <ActionButton
            onClick={(e) => {
              setLikeAnim(liked ? 'shrink' : 'pop')
              setTimeout(() => setLikeAnim(null), liked ? 150 : 350)
              onLike(e)
            }}
            label="Like"
          >
            <span style={{ display: 'inline-flex' }} className={likeAnim === 'pop' ? 'like-pop' : likeAnim === 'shrink' ? 'like-shrink' : undefined}>
              <LikeIcon filled={liked} color={liked ? accentColor : '#6b5d4f'} />
            </span>
            <span style={{ fontSize: '13px', fontWeight: 500, color: liked ? accentColor : '#6b5d4f', transition: 'color 0.15s' }}>
              {likeCount > 0 ? likeCount : ''}
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
              <BookmarkIcon filled={bookmarked} color={bookmarked ? accentColor : '#6b5d4f'} />
            </span>
          </ActionButton>
          <ActionButton onClick={onCommentClick} label="Comments">
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
