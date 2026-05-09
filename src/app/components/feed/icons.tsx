'use client'

export function LikeIcon({ filled, color }: { filled: boolean; color: string }) {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'fill 0.15s, stroke 0.15s' }}>
      <path
        d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"
        stroke={color}
        fill={filled ? color : 'none'}
      />
    </svg>
  )
}

export function BookmarkIcon({ filled, color }: { filled: boolean; color: string }) {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" style={{ transition: 'fill 0.15s, stroke 0.15s' }}>
      <path
        d="M5 3h14a1 1 0 011 1v17l-8-4-8 4V4a1 1 0 011-1z"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={filled ? color : 'none'}
      />
    </svg>
  )
}

export function CommentIcon({ filled, color }: { filled?: boolean; color: string }) {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'fill 0.2s, stroke 0.2s' }}>
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" fill={filled ? color : 'none'} />
    </svg>
  )
}
