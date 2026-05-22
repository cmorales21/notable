'use client'

import { useState } from 'react'
import Image from 'next/image'

const COLORS: Record<string, string> = {
  books: '#5271FF',
  movies: '#dc4f5c',
  music: '#4aad4e',
  restaurants: '#9055d0',
  podcasts: '#d4920a',
}

function CategorySVG({ category, color }: { category: string; color: string }) {
  const shared = {
    viewBox: '0 0 24 24' as const,
    fill: 'none' as const,
    stroke: color,
    strokeWidth: '1.6',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    width: '100%',
    height: '100%',
  }
  switch (category) {
    case 'books':
      return (
        <svg {...shared}>
          <path d="M12 20V5" />
          <path d="M3 4a2 2 0 012-2h4a2 2 0 012 2v15a2 2 0 00-2-2H5a2 2 0 01-2-2V4z" />
          <path d="M21 4a2 2 0 00-2-2h-4a2 2 0 00-2 2v15a2 2 0 012-2h4a2 2 0 002-2V4z" />
        </svg>
      )
    case 'movies':
      return (
        <svg {...shared}>
          <rect x="2" y="8" width="14" height="10" rx="2" />
          <path d="M16 11l5-3v8l-5-3V11z" />
        </svg>
      )
    case 'music':
      return (
        <svg {...shared}>
          <path d="M3 18v-6a9 9 0 0118 0v6" />
          <path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3z" />
          <path d="M3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z" />
        </svg>
      )
    case 'restaurants':
      return (
        <svg {...shared}>
          <path d="M8 3v5a3 3 0 006 0V3" />
          <path d="M11 8v13" />
          <path d="M16 3a5 5 0 015 5c0 3-2 4.5-5 5v8" />
        </svg>
      )
    case 'podcasts':
      return (
        <svg {...shared}>
          <rect x="9" y="2" width="6" height="12" rx="3" />
          <path d="M5 10v2a7 7 0 0014 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      )
    default:
      return null
  }
}

interface RecommendationImageProps {
  src: string | null | undefined
  alt: string
  category: string
  fill?: boolean
  width?: number
  height?: number
  sizes?: string
  style?: React.CSSProperties
  className?: string
  onError?: () => void
}

export function RecommendationImage({
  src,
  alt,
  category,
  fill,
  width,
  height,
  sizes,
  style,
  className,
  onError,
}: RecommendationImageProps) {
  const [error, setError] = useState(false)
  const color = COLORS[category] ?? '#6b5d4f'
  const showImage = !!src && !error

  const handleError = () => {
    setError(true)
    onError?.()
  }

  if (fill) {
    if (showImage) {
      return (
        <Image
          src={src!}
          alt={alt}
          fill
          sizes={sizes}
          onError={handleError}
          style={style}
          className={className}
        />
      )
    }
    return (
      <div style={{
        position: 'absolute', inset: 0,
        background: `${color}26`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ width: '35%', aspectRatio: '1' }}>
          <CategorySVG category={category} color={`${color}66`} />
        </div>
      </div>
    )
  }

  return (
    <div
      style={{ position: 'relative', width, height, overflow: 'hidden', flexShrink: 0, ...style }}
      className={className}
    >
      {showImage ? (
        <Image
          src={src!}
          alt={alt}
          fill
          sizes={sizes ?? (width ? `${width}px` : undefined)}
          onError={handleError}
          style={{ objectFit: 'cover' }}
        />
      ) : (
        <div style={{
          width: '100%', height: '100%',
          background: `${color}26`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ width: '35%', aspectRatio: '1' }}>
            <CategorySVG category={category} color={`${color}66`} />
          </div>
        </div>
      )}
    </div>
  )
}
