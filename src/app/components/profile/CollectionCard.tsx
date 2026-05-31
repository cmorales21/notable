'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { type Collection, CATEGORY_COLORS, CATEGORY_LABELS } from './types'

export function CollectionCard({ collection }: { collection: Collection }) {
  const [hovered, setHovered] = useState(false)
  const itemCount = collection.collection_items?.length ?? 0
  const accentColor = CATEGORY_COLORS[collection.category] ?? '#6b5d4f'
  const mosaicUrls = (collection.collection_items ?? [])
    .map(ci => ci.recommendations?.image_url ?? null)
    .filter((u): u is string => !!u)
    .slice(0, 4)
  const hasMosaic = mosaicUrls.length > 0

  return (
    <Link href={`/collections/${collection.id}`} style={{ textDecoration: 'none', display: 'block' }}>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: 'relative',
          aspectRatio: '3/4',
          borderRadius: '10px',
          overflow: 'hidden',
          cursor: 'pointer',
          background: hasMosaic ? '#faf8f4' : `${accentColor}18`,
          transform: hovered ? 'scale(1.03)' : 'scale(1)',
          transition: 'transform 0.2s ease',
        }}
      >
        {/* Mosaic image grid */}
        {hasMosaic && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'grid',
            gridTemplateColumns: mosaicUrls.length >= 2 ? '1fr 1fr' : '1fr',
            gridTemplateRows: mosaicUrls.length >= 3 ? '1fr 1fr' : '1fr',
            gap: '1px',
            background: '#e8e0d4',
          }}>
            {mosaicUrls.map((url, i) => (
              <div
                key={i}
                style={{
                  position: 'relative', overflow: 'hidden',
                  gridColumn: mosaicUrls.length === 3 && i === 2 ? 'span 2' : undefined,
                }}
              >
                <Image
                  src={url}
                  alt=""
                  fill
                  sizes="(max-width: 480px) 25vw, 16vw"
                  style={{ objectFit: 'cover' }}
                />
              </div>
            ))}
          </div>
        )}

        {/* Gradient overlay */}
        {hasMosaic && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.1) 55%, transparent 100%)',
          }} />
        )}

        {/* Top row: category badge + lock */}
        <div style={{
          position: 'absolute', top: '8px', left: '8px', right: '8px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span className="font-body" style={{
            fontSize: '10px', fontWeight: 600,
            color: hasMosaic ? '#ffffff' : accentColor,
            background: hasMosaic ? 'rgba(0,0,0,0.38)' : `${accentColor}22`,
            borderRadius: '20px', padding: '2px 7px',
            letterSpacing: '0.03em',
            backdropFilter: hasMosaic ? 'blur(4px)' : 'none',
          }}>
            {CATEGORY_LABELS[collection.category]}
          </span>
          {collection.is_private && (
            <svg viewBox="0 0 24 24" fill="none"
              stroke={hasMosaic ? 'rgba(255,255,255,0.85)' : accentColor}
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          )}
        </div>

        {/* Name + count */}
        {hasMosaic ? (
          <div style={{ position: 'absolute', bottom: '10px', left: '10px', right: '10px' }}>
            <p className="font-display" style={{
              fontSize: '0.82rem', fontWeight: 600, color: '#ffffff',
              lineHeight: 1.3, marginBottom: '3px',
              overflow: 'hidden', display: '-webkit-box',
              WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
              letterSpacing: '-0.01em',
            }}>
              {collection.name}
            </p>
            <p className="font-body" style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.7)' }}>
              {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </p>
          </div>
        ) : (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '16px', gap: '6px',
          }}>
            <p className="font-display" style={{
              fontSize: '0.9rem', fontWeight: 600, color: accentColor,
              textAlign: 'center', lineHeight: 1.35,
              overflow: 'hidden', display: '-webkit-box',
              WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
              filter: 'brightness(0.75)',
            }}>
              {collection.name}
            </p>
            <p className="font-body" style={{ fontSize: '0.72rem', color: accentColor, opacity: 0.6 }}>
              {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </p>
          </div>
        )}
      </div>
    </Link>
  )
}
