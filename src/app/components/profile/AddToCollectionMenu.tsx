'use client'

import { useRef, useEffect } from 'react'
import { type Recommendation } from '@/app/components/CategoryFeed'
import { type Collection, CATEGORY_COLORS, CATEGORY_LABELS } from './types'

export function AddToCollectionMenu({
  rec,
  userCollections,
  membership,
  position,
  onToggle,
  onNewCollection,
  onClose,
}: {
  rec: Recommendation
  userCollections: Collection[]
  membership: Set<string>
  position: { top: number; right: number }
  onToggle: (collectionId: string) => void
  onNewCollection: () => void
  onClose: () => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)
  const filtered = userCollections.filter(c => c.category === rec.category)
  const accentColor = CATEGORY_COLORS[rec.category] ?? '#6b5d4f'

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top: position.top,
        right: position.right,
        zIndex: 500,
        background: '#faf8f4',
        borderRadius: '12px',
        border: '1px solid rgba(0,0,0,0.1)',
        boxShadow: '0 8px 32px rgba(58,42,26,0.28)',
        width: '224px',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ padding: '10px 14px 9px', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
        <p className="font-body" style={{ fontSize: '10px', color: '#a09278', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '2px' }}>
          Add to Collection
        </p>
        <p className="font-display" style={{ fontSize: '12px', color: accentColor, fontWeight: 600 }}>
          {CATEGORY_LABELS[rec.category]}
        </p>
      </div>

      {/* Collection list */}
      <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
        {filtered.length === 0 ? (
          <p className="font-body" style={{ padding: '12px 14px', fontSize: '13px', color: '#a09278', fontStyle: 'italic' }}>
            No {CATEGORY_LABELS[rec.category].toLowerCase()} collections yet
          </p>
        ) : (
          filtered.map(col => {
            const inCollection = membership.has(col.id)
            return (
              <button
                key={col.id}
                onClick={() => onToggle(col.id)}
                className="font-body"
                style={{
                  width: '100%', textAlign: 'left',
                  padding: '8px 14px',
                  background: 'none', border: 'none',
                  cursor: 'pointer', display: 'flex',
                  alignItems: 'center', gap: '10px',
                  fontSize: '13px', color: '#33261a',
                }}
              >
                {/* Checkbox */}
                <span style={{
                  width: '16px', height: '16px', borderRadius: '4px', flexShrink: 0,
                  border: `1.5px solid ${inCollection ? accentColor : 'rgba(0,0,0,0.2)'}`,
                  background: inCollection ? accentColor : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                }}>
                  {inCollection && (
                    <svg viewBox="0 0 12 12" fill="none" width="10" height="10">
                      <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {col.name}
                </span>
                {col.is_private && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    width="12" height="12" style={{ color: '#a09278', flexShrink: 0 }}>
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                )}
              </button>
            )
          })
        )}
      </div>

      {/* New Collection */}
      <div style={{ borderTop: '1px solid rgba(0,0,0,0.07)', padding: '5px' }}>
        <button
          onClick={onNewCollection}
          className="font-body"
          style={{
            width: '100%', background: 'none', border: 'none', cursor: 'pointer',
            padding: '8px 9px', borderRadius: '8px',
            display: 'flex', alignItems: 'center', gap: '8px',
            fontSize: '13px', color: accentColor, fontWeight: 500,
          }}
        >
          <span style={{ fontSize: '17px', lineHeight: 1, marginTop: '-1px' }}>+</span>
          New {CATEGORY_LABELS[rec.category]} Collection
        </button>
      </div>
    </div>
  )
}
