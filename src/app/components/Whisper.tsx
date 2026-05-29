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
    timerRef.current = setTimeout(() => handleDismiss(), 5000)
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
      style={{
        opacity,
        transition: 'opacity 0.3s ease',
        display: 'block',
        width: 'fit-content',
        maxWidth: '320px',
        margin: '0 auto',
        zIndex: 10,
      }}
    >
      <div
        className="font-body"
        style={{
          background: 'rgba(250, 248, 244, 0.95)',
          border: '1px solid rgba(0,0,0,0.06)',
          borderRadius: '10px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          padding: '12px 18px',
          fontSize: '14px',
          color: '#33261a',
          lineHeight: 1.5,
          userSelect: 'none',
        }}
      >
        {message}
      </div>
    </div>
  )
}
