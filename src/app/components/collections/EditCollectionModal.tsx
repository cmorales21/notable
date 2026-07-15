'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { friendlyError } from '@/lib/friendlyError'
import { theme, getCategoryColor } from '@/app/lib/theme'
import { type CollectionData } from './types'

export function EditCollectionModal({
  collection, onClose, onSave,
}: {
  collection: CollectionData
  onClose: () => void
  onSave: (updates: Pick<CollectionData, 'name' | 'description' | 'is_private'>) => void
}) {
  const supabase = useRef(createClient())
  const [name, setName] = useState(collection.name)
  const [description, setDescription] = useState(collection.description ?? '')
  const [isPrivate, setIsPrivate] = useState(collection.is_private)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const accentColor = getCategoryColor(collection.category)

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    const { error: updateErr } = await supabase.current
      .from('collections')
      .update({
        name: name.trim(),
        description: description.trim() || null,
        is_private: isPrivate,
        updated_at: new Date().toISOString(),
      })
      .eq('id', collection.id)
    if (updateErr) { setError(friendlyError(updateErr)); setSaving(false); return }
    onSave({ name: name.trim(), description: description.trim() || null, is_private: isPrivate })
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 400,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '440px',
          background: theme.colors.surface, borderRadius: '16px',
          border: `1px solid ${accentColor}30`,
          overflow: 'hidden',
          boxShadow: '0 32px 80px rgba(58,42,26,0.5)',
        }}
      >
        <div style={{ height: '4px', background: accentColor }} />
        <div style={{ padding: '22px 24px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h2 className="font-display" style={{ fontSize: '1.1rem', fontWeight: 600, color: theme.colors.textPrimary }}>
              Edit Collection
            </h2>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.colors.textMuted, display: 'flex', padding: '4px' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label className="font-body" style={{ display: 'block', color: theme.colors.textMuted, fontSize: '11px', marginBottom: '5px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Name
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={80}
              autoFocus
              className="font-body"
              style={{
                width: '100%', boxSizing: 'border-box',
                background: theme.colors.input, border: '1px solid rgba(0,0,0,0.1)',
                borderRadius: '10px', padding: '9px 13px',
                color: theme.colors.textPrimary, fontSize: '14px', outline: 'none',
              }}
            />
          </div>

          <div style={{ marginBottom: '18px' }}>
            <label className="font-body" style={{ display: 'block', color: theme.colors.textMuted, fontSize: '11px', marginBottom: '5px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Description <span style={{ color: '#a09278', textTransform: 'none' }}>(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value.slice(0, 300))}
              rows={2}
              className="font-body"
              style={{
                width: '100%', boxSizing: 'border-box',
                background: theme.colors.input, border: '1px solid rgba(0,0,0,0.1)',
                borderRadius: '10px', padding: '9px 13px',
                color: theme.colors.textPrimary, fontSize: '14px', outline: 'none',
                resize: 'none', lineHeight: 1.6,
              }}
            />
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: '22px', padding: '12px 14px',
            background: theme.colors.input, borderRadius: '10px',
          }}>
            <div>
              <p className="font-body" style={{ color: theme.colors.textPrimary, fontSize: '13px', fontWeight: 500, marginBottom: '2px' }}>Private</p>
              <p className="font-body" style={{ color: theme.colors.textMuted, fontSize: '12px' }}>Only visible to you</p>
            </div>
            <button
              onClick={() => setIsPrivate(p => !p)}
              style={{
                width: '42px', height: '24px', borderRadius: '12px', border: 'none',
                cursor: 'pointer', position: 'relative', flexShrink: 0,
                background: isPrivate ? accentColor : 'rgba(0,0,0,0.15)',
                transition: 'background 0.2s',
              }}
            >
              <div style={{
                position: 'absolute', top: '3px',
                left: isPrivate ? '21px' : '3px',
                width: '18px', height: '18px', borderRadius: '50%',
                background: '#ffffff', transition: 'left 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </button>
          </div>

          {error && <p className="font-body" style={{ color: theme.colors.error, fontSize: '13px', marginBottom: '12px' }}>{error}</p>}

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button onClick={onClose} className="font-body" style={{ background: 'transparent', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '20px', padding: '7px 18px', color: theme.colors.textMuted, fontSize: '13px', cursor: 'pointer' }}>
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="font-body"
              style={{
                background: saving || !name.trim() ? '#e8e0d4' : accentColor,
                border: 'none', borderRadius: '20px', padding: '7px 18px',
                color: saving || !name.trim() ? '#a09278' : '#ffffff',
                fontSize: '13px', fontWeight: 600,
                cursor: saving || !name.trim() ? 'default' : 'pointer',
                transition: 'background 0.15s',
              }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
