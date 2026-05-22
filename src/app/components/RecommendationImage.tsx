'use client'

import { useState } from 'react'
import Image from 'next/image'

const COLORS: Record<string, string> = {
  books: '#5271FF',
  movies: '#dc4f5c',
  music: '#4aad4e',
  restaurants: '#9055d0',
  podcasts: '#e5a517',
}

const INITIALS: Record<string, string> = {
  books: 'B',
  movies: 'M',
  music: 'M',
  restaurants: 'R',
  podcasts: 'P',
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
  onFallback?: () => void
}

// fill mode: renders Image into caller's position:relative/absolute container.
//   - image loads → <Image fill>
//   - no src or load error → null (caller should collapse the container via onFallback/onError)
//
// fixed-size mode: renders its own container div.
//   - image loads → <Image fill> inside container
//   - no src or load error → category-colored square with initial letter
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
  onFallback,
}: RecommendationImageProps) {
  const [error, setError] = useState(false)
  const color = COLORS[category] ?? '#6b5d4f'
  const showImage = !!src && !error

  const handleError = () => {
    setError(true)
    onError?.()
    onFallback?.()
  }

  if (fill) {
    if (!showImage) return null
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
          background: color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{
            color: '#ffffff',
            fontSize: typeof height === 'number' ? Math.round(height * 0.38) : 16,
            fontWeight: 700,
            letterSpacing: '-0.01em',
            lineHeight: 1,
            userSelect: 'none',
          }}>
            {INITIALS[category] ?? category.charAt(0).toUpperCase()}
          </span>
        </div>
      )}
    </div>
  )
}
