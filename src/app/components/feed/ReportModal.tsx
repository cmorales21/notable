'use client'

import { useState } from 'react'

const REASONS = [
  'Spam',
  'Inappropriate content',
  'Harassment',
  'Impersonation',
  'Other',
]

export function ReportModal({
  title,
  onSubmit,
  onClose,
  zIndex = 400,
}: {
  title: string
  onSubmit: (reason: string, details: string) => Promise<boolean>
  onClose: () => void
  zIndex?: number
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const [details, setDetails] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!selected || submitting) return
    setSubmitting(true)
    setSubmitError(null)
    const ok = await onSubmit(selected, details.trim())
    if (ok) {
      setDone(true)
    } else {
      setSubmitError('Couldn’t send your report. Please try again.')
    }
    setSubmitting(false)
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '380px',
          background: '#faf8f4',
          borderRadius: '16px',
          border: '1px solid rgba(0,0,0,0.08)',
          padding: '24px',
          boxShadow: '0 32px 80px rgba(58,42,26,0.4)',
        }}
      >
        {done ? (
          <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
            <p className="font-display" style={{ fontSize: '1.05rem', fontWeight: 600, color: '#33261a', marginBottom: '8px' }}>
              Thanks for the heads up
            </p>
            <p className="font-body" style={{ fontSize: '14px', color: '#6b5d4f', lineHeight: 1.6, marginBottom: '20px' }}>
              We&apos;ll take a look and keep Notable a good place.
            </p>
            <button
              onClick={onClose}
              className="font-body"
              style={{
                background: '#33261a', color: '#faf8f4',
                border: 'none', borderRadius: '20px',
                padding: '8px 24px', fontSize: '14px', fontWeight: 500, cursor: 'pointer',
              }}
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <h2 className="font-display" style={{ fontSize: '1.1rem', fontWeight: 600, color: '#33261a', marginBottom: '4px' }}>
              {title}
            </h2>
            <p className="font-body" style={{ fontSize: '13px', color: '#6b5d4f', marginBottom: '16px' }}>
              What&apos;s going on?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginBottom: '16px' }}>
              {REASONS.map(reason => (
                <button
                  key={reason}
                  onClick={() => setSelected(reason)}
                  className="font-body"
                  style={{
                    textAlign: 'left', padding: '9px 14px',
                    borderRadius: '10px',
                    border: `1.5px solid ${selected === reason ? '#33261a' : 'rgba(0,0,0,0.1)'}`,
                    background: selected === reason ? 'rgba(51,38,26,0.06)' : 'transparent',
                    color: '#33261a', fontSize: '14px', cursor: 'pointer',
                    fontWeight: selected === reason ? 500 : 400,
                    transition: 'border-color 0.12s, background 0.12s',
                  }}
                >
                  {reason}
                </button>
              ))}
            </div>
            <textarea
              value={details}
              onChange={e => setDetails(e.target.value.slice(0, 280))}
              placeholder="Anything else you'd like us to know? (optional)"
              rows={2}
              className="font-body"
              style={{
                width: '100%', boxSizing: 'border-box',
                background: '#f5f0e8', border: '1px solid rgba(0,0,0,0.1)',
                borderRadius: '10px', padding: '9px 13px',
                color: '#33261a', fontSize: '13px', lineHeight: 1.55,
                resize: 'none', outline: 'none',
                fontFamily: 'var(--font-body, "DM Sans", sans-serif)',
                marginBottom: '16px',
                display: 'block',
              }}
            />
            {submitError && (
              <p className="font-body" style={{ color: '#e05555', fontSize: '13px', marginTop: '-6px', marginBottom: '14px' }}>
                {submitError}
              </p>
            )}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={onClose}
                className="font-body"
                style={{
                  background: 'transparent', border: '1px solid rgba(0,0,0,0.1)',
                  borderRadius: '20px', padding: '7px 16px',
                  color: '#6b5d4f', fontSize: '13px', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!selected || submitting}
                className="font-body"
                style={{
                  background: selected ? '#33261a' : 'rgba(0,0,0,0.1)',
                  border: 'none', borderRadius: '20px', padding: '7px 18px',
                  color: selected ? '#faf8f4' : '#6b5d4f',
                  fontSize: '13px', fontWeight: 600,
                  cursor: selected && !submitting ? 'pointer' : 'default',
                  transition: 'all 0.15s',
                }}
              >
                {submitting ? 'Sending…' : 'Submit'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
