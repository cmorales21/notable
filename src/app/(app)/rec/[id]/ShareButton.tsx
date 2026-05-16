'use client'

import { useState } from 'react'
import { theme } from '@/app/lib/theme'

export function ShareButton({ recId }: { recId: string }) {
  const [copied, setCopied] = useState(false)

  async function handleShare() {
    const url = `${window.location.origin}/rec/${recId}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={handleShare}
        aria-label="Copy link"
        style={{
          width: '32px', height: '32px', borderRadius: '50%',
          background: theme.colors.border, border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: theme.colors.textMuted, transition: 'background 0.15s',
        }}
      >
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
          <polyline points="16 6 12 2 8 6" />
          <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
      </button>
      {copied && (
        <div style={{
          position: 'absolute', bottom: '-32px', right: 0, zIndex: 10,
          background: '#1a1a1a', color: '#fff', fontSize: '12px',
          padding: '4px 10px', borderRadius: '6px', whiteSpace: 'nowrap',
          pointerEvents: 'none', fontFamily: 'var(--font-body, "DM Sans", sans-serif)',
        }}>
          Link copied!
        </div>
      )}
    </div>
  )
}
