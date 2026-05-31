'use client'

import { useState } from 'react'

export function FollowRowButton({
  following, pending, onToggle,
}: {
  following: boolean
  pending: boolean
  onToggle: () => void
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onToggle}
      disabled={pending}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="font-body"
      style={{
        background: following ? (hovered ? 'rgba(224,85,85,0.12)' : 'rgba(0,0,0,0.08)') : 'transparent',
        border: `1px solid ${following ? (hovered ? 'rgba(224,85,85,0.4)' : 'rgba(0,0,0,0.12)') : 'rgba(0,0,0,0.15)'}`,
        borderRadius: '20px', padding: '4px 12px',
        fontSize: '12px', fontWeight: 500,
        color: following ? (hovered ? '#e05555' : '#33261a') : '#33261a',
        cursor: pending ? 'default' : 'pointer',
        transition: 'all 0.15s',
        flexShrink: 0, minWidth: '72px', textAlign: 'center',
      }}
    >
      {following ? (hovered ? 'Unfollow' : 'Following') : 'Follow'}
    </button>
  )
}
