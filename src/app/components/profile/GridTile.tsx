'use client'

import { useState } from 'react'
import { RecommendationImage } from '@/app/components/RecommendationImage'
import { type Recommendation } from '@/app/components/CategoryFeed'
import { CATEGORY_COLORS } from './types'

export function GridTile({ rec, onClick, onMenu }: { rec: Recommendation; onClick: () => void; onMenu?: (rect: DOMRect) => void }) {
  const [hovered, setHovered] = useState(false)
  const [imgError, setImgError] = useState(false)
  const color = CATEGORY_COLORS[rec.category] ?? '#6b5d4f'
  const showImage = !!rec.image_url && !imgError

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        aspectRatio: '3/4',
        borderRadius: '10px',
        overflow: 'hidden',
        cursor: 'pointer',
        background: showImage ? '#faf8f4' : `${color}18`,
        transform: hovered ? 'scale(1.03)' : 'scale(1)',
        transition: 'transform 0.2s ease',
      }}
    >
      {showImage && (
        <RecommendationImage
          fill
          src={rec.image_url}
          category={rec.category}
          alt={rec.title}
          sizes="(max-width: 768px) 33vw, 25vw"
          onFallback={() => setImgError(true)}
          style={{ objectFit: 'cover' }}
        />
      )}

      {/* Category dot */}
      <div style={{
        position: 'absolute', top: '8px', left: '8px',
        width: '7px', height: '7px', borderRadius: '50%',
        background: color,
        boxShadow: `0 0 6px ${color}88`,
      }} />

      {/* Three-dot menu button */}
      {onMenu && (
        <button
          onClick={e => { e.stopPropagation(); onMenu(e.currentTarget.getBoundingClientRect()) }}
          aria-label="Add to collection"
          style={{
            position: 'absolute', top: '6px', right: '6px',
            width: '24px', height: '24px', borderRadius: '50%',
            background: 'rgba(0,0,0,0.5)',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#ffffff', fontSize: '15px', letterSpacing: '1px',
            opacity: hovered ? 1 : 0,
            transition: 'opacity 0.15s',
            zIndex: 10, lineHeight: 1, paddingBottom: '2px',
          }}
        >
          ···
        </button>
      )}

      {showImage ? (
        <>
          {/* Dark gradient overlay */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.1) 55%, transparent 100%)',
          }} />
          {/* Title over image */}
          <p className="font-display" style={{
            position: 'absolute', bottom: '10px', left: '10px', right: '10px',
            fontSize: '0.82rem', fontWeight: 600, color: '#ffffff',
            lineHeight: 1.3,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            letterSpacing: '-0.01em',
          }}>
            {rec.title}
          </p>
        </>
      ) : (
        /* No image — centered title on tinted background */
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '16px',
        }}>
          <p className="font-display" style={{
            fontSize: '0.88rem', fontWeight: 600, color: color,
            textAlign: 'center', lineHeight: 1.35,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            letterSpacing: '-0.01em',
          }}>
            {rec.title}
          </p>
        </div>
      )}
    </div>
  )
}
