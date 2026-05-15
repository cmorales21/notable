'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function WelcomeOverlay({ userId }: { userId: string }) {
  const [opacity, setOpacity] = useState(0)
  const [gone, setGone] = useState(false)
  const router = useRouter()

  // Fade in on mount — double rAF ensures the transition fires after first paint
  useEffect(() => {
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => setOpacity(1))
    )
    return () => cancelAnimationFrame(id)
  }, [])

  async function dismiss() {
    setOpacity(0)

    const supabase = createClient()
    await supabase
      .from('profiles')
      .update({ is_onboarded: true })
      .eq('id', userId)

    router.refresh()

    setTimeout(() => setGone(true), 380)
  }

  if (gone) return null

  const visible = opacity === 1

  return (
    <div
      onClick={dismiss}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background: 'rgba(245, 240, 232, 0.6)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        opacity,
        transition: 'opacity 0.35s ease',
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          background: '#faf8f4',
          borderRadius: '20px',
          padding: 'clamp(32px, 5vw, 52px) clamp(28px, 5vw, 48px)',
          maxWidth: '500px',
          width: '100%',
          boxShadow: '0 24px 60px rgba(58, 42, 26, 0.14), 0 0 0 1px rgba(58,42,26,0.06)',
          textAlign: 'center',
          transform: visible ? 'translateY(0)' : 'translateY(10px)',
          transition: 'transform 0.35s ease',
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-playfair)',
            fontSize: 'clamp(1.8rem, 4vw, 2.4rem)',
            fontWeight: 700,
            color: '#33261a',
            letterSpacing: '-0.025em',
            lineHeight: 1.15,
            marginBottom: '16px',
          }}
        >
          Welcome to Notable.
        </h1>

        <p
          className="font-body"
          style={{
            fontSize: 'clamp(0.95rem, 1.5vw, 1.05rem)',
            color: '#33261a',
            lineHeight: 1.65,
            marginBottom: '32px',
          }}
        >
          Thanks for signing up! Start exploring recommendations from people
          with great taste across books, movies, music, restaurants and podcasts.
        </p>

        <p
          className="font-body"
          style={{
            fontSize: '0.78rem',
            color: '#6b5d4f',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          tap anywhere to continue
        </p>
      </div>
    </div>
  )
}
