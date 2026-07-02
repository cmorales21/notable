'use client'

import { useState } from 'react'
import Image from 'next/image'
import { theme } from '@/app/lib/theme'

// variant="default"  — flat warm disc fallback (feed, search, notifications)
// variant="gradient" — per-name hue gradient disc (profile header, edit modal)

export function Avatar({
  url,
  name,
  size,
  variant = 'default',
}: {
  url?: string | null
  name: string | null | undefined
  size: number
  variant?: 'default' | 'gradient'
}) {
  const [imgErr, setImgErr] = useState(false)
  const initial = name ? name.charAt(0).toUpperCase() : '?'

  if (url && !imgErr) {
    return (
      <Image
        src={url}
        alt={name ?? ''}
        width={size}
        height={size}
        onError={() => setImgErr(true)}
        style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    )
  }

  if (variant === 'gradient') {
    const hue = name ? (name.charCodeAt(0) * 37) % 360 : 200
    return (
      <div
        style={{
          width: size, height: size, borderRadius: '50%', flexShrink: 0,
          background: `linear-gradient(135deg, hsl(${hue},40%,82%), hsl(${hue},30%,75%))`,
          border: '2px solid rgba(0,0,0,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: size * 0.38, fontWeight: 600, color: `hsl(${hue},45%,30%)`,
          fontFamily: 'var(--font-display, "Playfair Display", serif)',
        }}
      >
        {initial}
      </div>
    )
  }

  return (
    <div
      style={{
        width: size, height: size, borderRadius: '50%',
        background: theme.colors.avatarFallback, border: '1px solid rgba(0,0,0,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.4, color: theme.colors.textPrimary, fontWeight: 500, flexShrink: 0,
      }}
    >
      {initial}
    </div>
  )
}
