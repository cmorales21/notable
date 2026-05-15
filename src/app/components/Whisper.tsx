'use client'

import { useState, useEffect, useRef } from 'react'
import { useWhispers } from '@/app/hooks/useWhispers'

interface WhisperProps {
  id: string
  message: string
}

export default function Whisper({ id, message }: WhisperProps) {
  const { shouldShow, dismiss, loading } = useWhispers()
  const [opacity, setOpacity] = useState(0)
  const [gone, setGone] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const show = shouldShow(id)

  useEffect(() => {
    if (!show || loading) return
    const frameId = requestAnimationFrame(() =>
      requestAnimationFrame(() => setOpacity(1))
    )
    return () => cancelAnimationFrame(frameId)
  }, [show, loading])

  useEffect(() => {
    if (!show || loading) return
    timerRef.current = setTimeout(() => handleDismiss(), 6000)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, loading])

  async function handleDismiss() {
    if (timerRef.current) clearTimeout(timerRef.current)
    setOpacity(0)
    await dismiss(id)
    setTimeout(() => setGone(true), 300)
  }

  if (gone || loading || !show) return null

  return (
    <div
      onClick={handleDismiss}
      style={{
        opacity,
        transition: 'opacity 0.3s ease',
        cursor: 'pointer',
        display: 'inline-block',
      }}
    >
      <div
        className="font-body"
        style={{
          background: '#33261a',
          color: '#f5f0e8',
          borderRadius: '10px',
          padding: '9px 14px',
          fontSize: '0.8rem',
          lineHeight: 1.5,
          boxShadow: '0 8px 24px rgba(58,42,26,0.2)',
          userSelect: 'none',
        }}
      >
        {message}
      </div>
    </div>
  )
}
