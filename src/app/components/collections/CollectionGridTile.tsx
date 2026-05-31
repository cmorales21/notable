'use client'

import { useState } from 'react'
import { RecommendationImage } from '@/app/components/RecommendationImage'
import type { Recommendation } from '@/app/lib/types'

export function CollectionGridTile({
  rec, accentColor, onRemove, onClick,
}: {
  rec: Recommendation
  accentColor: string
  onRemove?: () => void
  onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const [imgError, setImgError] = useState(false)
  const showImage = !!rec.image_url && !imgError

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative', aspectRatio: '3/4', borderRadius: '10px',
        overflow: 'hidden', cursor: 'pointer',
        background: showImage ? '#faf8f4' : `${accentColor}18`,
        transform: hovered ? 'scale(1.03)' : 'scale(1)',
        transition: 'transform 0.2s ease',
      }}
    >
      {showImage && (
        <RecommendationImage
          fill src={rec.image_url} category={rec.category} alt={rec.title}
          sizes="(max-width: 768px) 33vw, 25vw"
          onFallback={() => setImgError(true)}
          style={{ objectFit: 'cover' }}
        />
      )}

      {onRemove && (
        <button
          onClick={e => { e.stopPropagation(); onRemove() }}
          aria-label="Remove from collection"
          style={{
            position: 'absolute', top: '6px', right: '6px', zIndex: 10,
            width: '22px', height: '22px', borderRadius: '50%',
            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: hovered ? 1 : 0, transition: 'opacity 0.15s',
          }}
        >
          <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="white" strokeWidth="2.8" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      )}

      {showImage ? (
        <>
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.1) 55%, transparent 100%)',
          }} />
          <p className="font-display" style={{
            position: 'absolute', bottom: '10px', left: '10px', right: '10px',
            fontSize: '0.82rem', fontWeight: 600, color: '#ffffff', lineHeight: 1.3,
            overflow: 'hidden', display: '-webkit-box',
            WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', letterSpacing: '-0.01em',
          }}>
            {rec.title}
          </p>
        </>
      ) : (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <p className="font-display" style={{
            fontSize: '0.88rem', fontWeight: 600, color: accentColor,
            textAlign: 'center', lineHeight: 1.35,
            overflow: 'hidden', display: '-webkit-box',
            WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', letterSpacing: '-0.01em',
          }}>
            {rec.title}
          </p>
        </div>
      )}
    </div>
  )
}
