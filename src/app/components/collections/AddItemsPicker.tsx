'use client'

import { useState, useEffect } from 'react'
import { theme } from '@/app/lib/theme'
import { useToast } from '@/app/components/Toast'
import { checkedWrite } from '@/lib/writes'
import { type CollectionData, type CollectionItemRow, CATEGORY_LABELS } from './types'
import type { Recommendation } from '@/app/lib/types'

type AddItemsTab = 'posted' | 'bookmarked'

interface PickerRec {
  id: string
  user_id: string
  category: string
  title: string
  description: string | null
  image_url: string | null
  created_at: string
}

export function AddItemsPicker({
  collection, currentUserId, existingIds, accentColor, supabase, onClose, onAdded,
}: {
  collection: CollectionData
  currentUserId: string
  existingIds: Set<string>
  accentColor: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
  onClose: () => void
  onAdded: (newItems: CollectionItemRow[]) => void
}) {
  const [tab, setTab] = useState<AddItemsTab>('posted')
  const [recs, setRecs] = useState<PickerRec[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState(false)
  const [imgErrors, setImgErrors] = useState<Set<string>>(new Set())
  const toast = useToast()

  useEffect(() => {
    setLoading(true)
    setRecs([])
    setSelectedIds(new Set())

    async function load() {
      if (tab === 'posted') {
        const { data } = await supabase
          .from('recommendations').select('id, user_id, category, title, description, image_url, created_at')
          .eq('user_id', currentUserId).eq('category', collection.category)
          .order('created_at', { ascending: false })
        setRecs(data ?? [])
      } else {
        const { data: bmData } = await supabase
          .from('bookmarks').select('recommendation_id').eq('user_id', currentUserId)
        const ids = (bmData ?? []).map((b: { recommendation_id: string }) => b.recommendation_id)
        if (ids.length === 0) { setRecs([]); setLoading(false); return }
        const { data } = await supabase
          .from('recommendations').select('id, user_id, category, title, description, image_url, created_at')
          .in('id', ids).eq('category', collection.category)
          .order('created_at', { ascending: false })
        setRecs(data ?? [])
      }
      setLoading(false)
    }
    load()
  }, [tab, currentUserId, collection.category, supabase])

  function toggle(id: string) {
    if (existingIds.has(id)) return
    setSelectedIds(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }

  async function handleAdd() {
    if (adding || selectedIds.size === 0) return
    setAdding(true)
    const recIds = [...selectedIds]
    const rows = recIds.map(rid => ({ collection_id: collection.id, recommendation_id: rid }))
    const { data: inserted, error: insertErr } = await supabase
      .from('collection_items')
      .upsert(rows, { ignoreDuplicates: true })
      .select('id, recommendation_id, added_at')
    if (insertErr) {
      if (process.env.NODE_ENV !== 'production') console.error('[Notable] collection items add error:', insertErr.message)
      setAdding(false)
      toast('Couldn’t add these items. Please try again.')
      return
    }

    // Auto-set cover if collection has no cover
    if (!collection.cover_recommendation_id && recIds.length > 0) {
      await checkedWrite(supabase.from('collections').update({
        cover_recommendation_id: recIds[0], updated_at: new Date().toISOString(),
      }).eq('id', collection.id))
    }

    // Build CollectionItemRow objects from what we know locally
    const recMap: Record<string, PickerRec> = {}
    for (const r of recs) recMap[r.id] = r

    const newItems: CollectionItemRow[] = (inserted ?? []).map((row: { id: string; recommendation_id: string; added_at: string }) => {
      const r = recMap[row.recommendation_id]
      return {
        id: row.id,
        recommendation_id: row.recommendation_id,
        added_at: row.added_at,
        rec: {
          id: r.id,
          user_id: r.user_id,
          category: r.category,
          title: r.title,
          description: r.description ?? '',
          image_url: r.image_url ?? null,
          external_url: null,
          item_id: null,
          created_at: r.created_at,
          profiles: null,
        } as Recommendation,
      }
    })

    onAdded(newItems)
  }

  const categoryLabel = CATEGORY_LABELS[collection.category] ?? collection.category

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: theme.colors.surface,
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px',
        borderBottom: `1px solid ${theme.colors.border}`,
        flexShrink: 0,
      }}>
        <div>
          <h2 className="font-display" style={{ fontSize: '1rem', fontWeight: 600, color: theme.colors.textPrimary }}>
            Add Items
          </h2>
          <p className="font-body" style={{ fontSize: '12px', color: theme.colors.textMuted, marginTop: '1px' }}>
            {categoryLabel} only
          </p>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.colors.textMuted, display: 'flex', padding: '4px' }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${theme.colors.border}`, flexShrink: 0 }}>
        {(['posted', 'bookmarked'] as AddItemsTab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="font-body"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '10px 20px', fontSize: '13px',
              fontWeight: tab === t ? 600 : 400,
              color: tab === t ? theme.colors.textPrimary : theme.colors.textMuted,
              borderBottom: tab === t ? `2px solid ${accentColor}` : '2px solid transparent',
              marginBottom: '-1px', transition: 'color 0.15s',
            }}
          >
            {t === 'posted' ? 'Your Posts' : 'Your Bookmarks'}
          </button>
        ))}
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0 120px' }}>
        {loading ? (
          <div style={{ padding: '20px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div className="skeleton-pulse" style={{ width: 60, height: 60, borderRadius: '10px', background: '#efe9e0', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton-pulse" style={{ height: 14, width: '60%', borderRadius: 6, background: '#efe9e0', marginBottom: 6 }} />
                  <div className="skeleton-pulse" style={{ height: 12, width: '40%', borderRadius: 6, background: '#efe9e0' }} />
                </div>
              </div>
            ))}
          </div>
        ) : recs.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '60px', gap: '8px', textAlign: 'center', padding: '60px 20px 0' }}>
            <p className="font-display" style={{ fontSize: '1rem', fontWeight: 600, color: theme.colors.textPrimary }}>
              No {categoryLabel} {tab === 'posted' ? 'posts' : 'bookmarks'}
            </p>
            <p className="font-body" style={{ fontSize: '14px', color: theme.colors.textMuted, maxWidth: '240px', lineHeight: '1.55' }}>
              {tab === 'posted'
                ? `You haven't posted any ${categoryLabel.toLowerCase()} recommendations yet.`
                : `You haven't bookmarked any ${categoryLabel.toLowerCase()} recommendations yet.`}
            </p>
          </div>
        ) : (
          recs.map(rec => {
            const alreadyIn = existingIds.has(rec.id)
            const selected = selectedIds.has(rec.id)
            const hasImg = !!rec.image_url && !imgErrors.has(rec.id)
            return (
              <div
                key={rec.id}
                onClick={() => toggle(rec.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '10px 20px',
                  cursor: alreadyIn ? 'default' : 'pointer',
                  opacity: alreadyIn ? 0.45 : 1,
                  background: selected ? `${accentColor}0d` : 'transparent',
                  transition: 'background 0.12s',
                }}
              >
                {/* Thumbnail */}
                <div style={{
                  width: 60, height: 60, borderRadius: '10px', flexShrink: 0,
                  background: hasImg ? theme.colors.surface : `${accentColor}18`,
                  overflow: 'hidden', position: 'relative',
                }}>
                  {hasImg ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={rec.image_url!}
                      alt={rec.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={() => setImgErrors(prev => new Set([...prev, rec.id]))}
                    />
                  ) : (
                    <div style={{
                      width: '100%', height: '100%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: '6px',
                    }}>
                      <p className="font-display" style={{
                        fontSize: '10px', fontWeight: 600, color: accentColor,
                        textAlign: 'center', lineHeight: 1.3,
                        overflow: 'hidden', display: '-webkit-box',
                        WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
                      }}>
                        {rec.title}
                      </p>
                    </div>
                  )}
                </div>

                {/* Text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="font-display" style={{
                    fontSize: '14px', fontWeight: 600, color: theme.colors.textPrimary,
                    lineHeight: 1.3, marginBottom: '3px',
                    overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                  }}>
                    {rec.title}
                  </p>
                  {rec.description && (
                    <p className="font-body" style={{
                      fontSize: '12px', color: theme.colors.textMuted, lineHeight: 1.4,
                      overflow: 'hidden', display: '-webkit-box',
                      WebkitLineClamp: 1, WebkitBoxOrient: 'vertical',
                    }}>
                      {rec.description}
                    </p>
                  )}
                  {alreadyIn && (
                    <p className="font-body" style={{ fontSize: '11px', color: accentColor, marginTop: '2px' }}>
                      Already in collection
                    </p>
                  )}
                </div>

                {/* Circular checkbox */}
                {!alreadyIn && (
                  <div style={{
                    width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
                    border: `2px solid ${selected ? accentColor : 'rgba(0,0,0,0.2)'}`,
                    background: selected ? accentColor : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s',
                  }}>
                    {selected && (
                      <svg viewBox="0 0 12 12" fill="none" width="9" height="9">
                        <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                )}
                {alreadyIn && (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke={accentColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.6 }}>
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Floating bottom bar */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: theme.colors.surface,
        boxShadow: '0 -2px 20px rgba(58,42,26,0.12)',
        padding: '14px 20px max(20px, env(safe-area-inset-bottom))',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        zIndex: 10,
      }}>
        <span className="font-body" style={{ fontSize: '14px', color: theme.colors.textMuted }}>
          {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select items to add'}
        </span>
        <button
          onClick={handleAdd}
          disabled={selectedIds.size === 0 || adding}
          className="font-body"
          style={{
            background: selectedIds.size > 0 && !adding ? accentColor : '#e8e0d4',
            color: selectedIds.size > 0 && !adding ? '#ffffff' : '#a09278',
            border: 'none', borderRadius: '20px',
            padding: '9px 22px', fontSize: '13px', fontWeight: 600,
            cursor: selectedIds.size > 0 && !adding ? 'pointer' : 'default',
            transition: 'all 0.15s',
          }}
        >
          {adding ? 'Adding…' : `Add${selectedIds.size > 0 ? ` ${selectedIds.size}` : ''}`}
        </button>
      </div>
    </div>
  )
}
