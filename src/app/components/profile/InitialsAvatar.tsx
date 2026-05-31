'use client'

export function InitialsAvatar({ name, size }: { name: string | null; size: number }) {
  const initial = name ? name.charAt(0).toUpperCase() : '?'
  const hue = name ? (name.charCodeAt(0) * 37) % 360 : 200
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `linear-gradient(135deg, hsl(${hue},40%,82%), hsl(${hue},30%,75%))`,
      border: '2px solid rgba(0,0,0,0.1)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 600, color: `hsl(${hue},45%,30%)`,
      fontFamily: 'var(--font-display, "Playfair Display", serif)',
    }}>
      {initial}
    </div>
  )
}
