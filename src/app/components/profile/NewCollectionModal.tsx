'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { type Collection, type CollectionCategory, CATEGORY_COLORS, CATEGORY_LABELS, COLLECTION_CATEGORIES } from './types'

export function NewCollectionModal({
  currentUserId,
  onClose,
  onCreate,
  prefilledCategory,
}: {
  currentUserId: string
  onClose: () => void
  onCreate: (collection: Collection) => void
  prefilledCategory?: CollectionCategory | null
}) {
  const supabase = useRef(createClient())
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<CollectionCategory | null>(prefilledCategory ?? null)
  const [isPrivate, setIsPrivate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const accentColor = category ? CATEGORY_COLORS[category] : '#33261a'
  const canCreate = !!name.trim() && !!category && !saving

  async function handleCreate() {
    if (!canCreate || !category) return
    setSaving(true)
    setError(null)
    const { data, error: insertErr } = await supabase.current
      .from('collections')
      .insert({
        user_id: currentUserId,
        name: name.trim(),
        description: description.trim() || null,
        category,
        is_private: isPrivate,
        position: 0,
      })
      .select('*, collection_items(recommendation_id, recommendations(image_url))')
      .single()
    if (insertErr) {
      setError(insertErr.message)
      setSaving(false)
      return
    }
    onCreate(data as unknown as Collection)
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
          background: '#faf8f4', borderRadius: '16px',
          border: `1px solid ${category ? `${accentColor}30` : 'rgba(0,0,0,0.08)'}`,
          overflow: 'hidden',
          boxShadow: '0 32px 80px rgba(58,42,26,0.5)',
          transition: 'border-color 0.2s',
        }}
      >
        {/* Accent header strip */}
        <div style={{
          height: '4px',
          background: category ? accentColor : 'rgba(0,0,0,0.08)',
          transition: 'background 0.25s',
        }} />

        <div style={{ padding: '22px 24px 24px' }}>
          {/* Title row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h2 className="font-display" style={{ fontSize: '1.1rem', fontWeight: 600, color: '#33261a' }}>
              New Collection
            </h2>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b5d4f', display: 'flex', padding: '4px' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
                strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Category picker / locked badge */}
          <div style={{ marginBottom: '16px' }}>
            <label className="font-body" style={{ display: 'block', color: '#6b5d4f', fontSize: '11px', marginBottom: '8px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Category
            </label>
            {prefilledCategory ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="font-body" style={{
                  padding: '5px 13px', borderRadius: '20px',
                  background: CATEGORY_COLORS[prefilledCategory],
                  color: '#ffffff', fontSize: '12px', fontWeight: 600,
                }}>
                  {CATEGORY_LABELS[prefilledCategory]}
                </span>
                <span className="font-body" style={{ fontSize: '12px', color: '#a09278' }}>locked</span>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap' }}>
                {COLLECTION_CATEGORIES.map(cat => {
                  const color = CATEGORY_COLORS[cat]
                  const selected = category === cat
                  return (
                    <button
                      key={cat}
                      onClick={() => setCategory(cat)}
                      className="font-body"
                      style={{
                        padding: '5px 12px',
                        borderRadius: '20px',
                        border: `1.5px solid ${selected ? color : 'rgba(0,0,0,0.1)'}`,
                        background: selected ? color : 'transparent',
                        color: selected ? '#ffffff' : '#6b5d4f',
                        fontSize: '12px', fontWeight: selected ? 600 : 400,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >
                      {CATEGORY_LABELS[cat]}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Name */}
          <div style={{ marginBottom: '14px' }}>
            <label className="font-body" style={{ display: 'block', color: '#6b5d4f', fontSize: '11px', marginBottom: '5px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Name
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={80}
              placeholder="My collection"
              autoFocus
              className="font-body"
              style={{
                width: '100%', boxSizing: 'border-box',
                background: '#f5f0e8', border: '1px solid rgba(0,0,0,0.1)',
                borderRadius: '10px', padding: '9px 13px',
                color: '#33261a', fontSize: '14px', outline: 'none',
              }}
            />
          </div>

          {/* Description */}
          <div style={{ marginBottom: '18px' }}>
            <label className="font-body" style={{ display: 'block', color: '#6b5d4f', fontSize: '11px', marginBottom: '5px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Description <span style={{ color: '#a09278', textTransform: 'none' }}>(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value.slice(0, 300))}
              rows={2}
              placeholder="What's this collection about?"
              className="font-body"
              style={{
                width: '100%', boxSizing: 'border-box',
                background: '#f5f0e8', border: '1px solid rgba(0,0,0,0.1)',
                borderRadius: '10px', padding: '9px 13px',
                color: '#33261a', fontSize: '14px', outline: 'none',
                resize: 'none', lineHeight: 1.6,
              }}
            />
          </div>

          {/* Private toggle */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: '22px', padding: '12px 14px',
            background: '#f5f0e8', borderRadius: '10px',
          }}>
            <div>
              <p className="font-body" style={{ color: '#33261a', fontSize: '13px', fontWeight: 500, marginBottom: '2px' }}>Private</p>
              <p className="font-body" style={{ color: '#6b5d4f', fontSize: '12px' }}>Only visible to you</p>
            </div>
            <button
              onClick={() => setIsPrivate(p => !p)}
              style={{
                width: '42px', height: '24px', borderRadius: '12px', border: 'none',
                cursor: 'pointer', position: 'relative', flexShrink: 0,
                background: isPrivate ? (category ? accentColor : '#33261a') : 'rgba(0,0,0,0.15)',
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

          {error && (
            <p className="font-body" style={{ color: '#e05555', fontSize: '13px', marginBottom: '12px' }}>{error}</p>
          )}

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button
              onClick={onClose}
              className="font-body"
              style={{
                background: 'transparent', border: '1px solid rgba(0,0,0,0.1)',
                borderRadius: '20px', padding: '7px 18px',
                color: '#6b5d4f', fontSize: '13px', cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!canCreate}
              className="font-body"
              style={{
                background: canCreate ? accentColor : '#e8e0d4',
                border: 'none', borderRadius: '20px', padding: '7px 18px',
                color: canCreate ? '#ffffff' : '#a09278',
                fontSize: '13px', fontWeight: 600,
                cursor: canCreate ? 'pointer' : 'default',
                transition: 'background 0.2s',
              }}
            >
              {saving ? 'Creating…' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
