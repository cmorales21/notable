'use client'

import { useState, useEffect } from 'react'
import { theme } from '@/app/lib/theme'

export function UndoBar({ collectionName, onUndo, onDismiss }: {
  collectionName: string
  onUndo: () => void
  onDismiss: () => void
}) {
  const [entered, setEntered] = useState(false)
  useEffect(() => {
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setEntered(true)))
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div
      style={{
        position: 'fixed', bottom: '88px', left: '50%',
        transform: `translateX(-50%) translateY(${entered ? '0' : '12px'})`,
        opacity: entered ? 1 : 0, transition: 'opacity 0.22s, transform 0.22s',
        zIndex: 9000,
        background: theme.colors.textPrimary, borderRadius: '999px',
        padding: '10px 8px 10px 20px',
        display: 'flex', alignItems: 'center', gap: '12px',
        boxShadow: '0 4px 24px rgba(58,42,26,0.32)',
        whiteSpace: 'nowrap',
      }}
    >
      <span className="font-body" style={{ color: '#f5f0e8', fontSize: '14px', fontWeight: 500 }}>
        Removed from {collectionName}
      </span>
      <button
        onClick={onUndo}
        className="font-body"
        style={{
          background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '20px',
          padding: '5px 14px', color: '#ffffff', fontSize: '13px', fontWeight: 600,
          cursor: 'pointer', transition: 'background 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.25)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)' }}
      >
        Undo
      </button>
      <button
        onClick={onDismiss}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'rgba(255,255,255,0.55)', padding: '4px 8px',
          display: 'flex', alignItems: 'center',
        }}
        aria-label="Dismiss"
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
