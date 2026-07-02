'use client'

import { useState } from 'react'
import Image from 'next/image'
import { CATEGORY_COLORS } from '@/app/lib/theme'

const INITIALS: Record<string, string> = {
  books: 'B',
  movies: 'M',
  music: 'M',
  restaurants: 'R',
  podcasts: 'P',
}

// Hosts we trust to route through the next/image optimizer (WebP/srcset).
// Mirrors next.config.ts remotePatterns. Match is exact host OR subdomain
// (host === domain || host.endsWith('.' + domain)). Anything not listed
// falls back to `unoptimized` — image loads directly from origin, which
// is necessary for arbitrary user-posted hosts (restaurant sites, etc.)
// and prevents next/image from throwing on unconfigured hosts.
const OPTIMIZED_HOSTS: ReadonlySet<string> = new Set([
  // App assets
  'supabase.co', 'pravatar.cc', 'images.unsplash.com', 'picsum.photos',
  // Books
  'covers.openlibrary.org', 'ssl-images-amazon.com', 'm.media-amazon.com',
  'i.gr-assets.com', 'books.google.com', 'prodimage.images-bn.com',
  'images.bookshop.org',
  // Movies & TV
  'image.tmdb.org', 'flxt.tmsimg.com', 'nflxso.net', 'muscache.com', 's.ltrbxd.com',
  // Music
  'scdn.co', 'spotifycdn.com', 'i.ytimg.com', 'mzstatic.com', 'f4.bcbits.com',
  'sndcdn.com', 'lastfm.freetls.fastly.net', 'media.pitchfork.com',
  'e-cdns-images.dzcdn.net',
  // Restaurants
  'googleusercontent.com', 'yelpcdn.com', 'media-cdn.tripadvisor.com',
  'cdninstagram.com', 'img.cdn4dd.com', 'images.otstatic.com',
  'resizer.otstatic.com', 'infatuation.imgix.net',
  // Podcasts
  'megaphone.imgix.net', 'pbcdn1.podbean.com', 'image.simplecastcdn.com',
  'ssl-static.libsyn.com',
  // Misc editorial
  'wikimedia.org', 'static01.nyt.com', 'i.guim.co.uk', 'media.timeout.com',
  'discogs.com',
])

function shouldOptimize(src: string): boolean {
  try {
    const host = new URL(src).hostname.toLowerCase()
    for (const domain of OPTIMIZED_HOSTS) {
      if (host === domain || host.endsWith('.' + domain)) return true
    }
    return false
  } catch {
    return false
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
  const color = CATEGORY_COLORS[category] ?? '#6b5d4f'
  const showImage = !!src && !error

  const handleError = () => {
    setError(true)
    onError?.()
    onFallback?.()
  }

  const optimize = showImage ? shouldOptimize(src!) : false

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
        unoptimized={!optimize}
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
          unoptimized={!optimize}
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
