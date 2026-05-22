'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

// ─── Context ──────────────────────────────────────────────────────────────────

type ToastFn = (message: string) => void

const ToastContext = createContext<ToastFn | null>(null)

export function useToast(): ToastFn {
  const fn = useContext(ToastContext)
  if (!fn) throw new Error('useToast must be used inside ToastProvider')
  return fn
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ToastEntry {
  id: string
  message: string
  exiting: boolean
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([])
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t))
    const exitTimer = setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 280)
    timersRef.current.set(`exit-${id}`, exitTimer)
  }, [])

  const toast = useCallback((message: string) => {
    const id = Math.random().toString(36).slice(2, 10)
    setToasts(prev => {
      const next = [...prev, { id, message, exiting: false }]
      return next.length > 3 ? next.slice(-3) : next
    })
    const timer = setTimeout(() => dismiss(id), 2500)
    timersRef.current.set(id, timer)
  }, [dismiss])

  useEffect(() => {
    const timers = timersRef.current
    return () => timers.forEach(t => clearTimeout(t))
  }, [])

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastPortal toasts={toasts} />
    </ToastContext.Provider>
  )
}

// ─── UI ───────────────────────────────────────────────────────────────────────

function ToastPortal({ toasts }: { toasts: ToastEntry[] }) {
  if (toasts.length === 0) return null
  return (
    <>
      <style>{`@media (min-width: 768px) { .notable-toast-wrap { bottom: 32px !important; } }`}</style>
      <div
        className="notable-toast-wrap"
        style={{
          position: 'fixed',
          bottom: '88px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          alignItems: 'center',
          pointerEvents: 'none',
        }}
      >
        {toasts.map(t => <ToastItem key={t.id} item={t} />)}
      </div>
    </>
  )
}

function ToastItem({ item }: { item: ToastEntry }) {
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => setEntered(true))
    })
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div
      className="font-body"
      style={{
        background: '#33261a',
        color: '#f5f0e8',
        padding: '10px 20px',
        borderRadius: '999px',
        fontSize: '14px',
        fontWeight: 500,
        letterSpacing: '0.01em',
        boxShadow: '0 4px 24px rgba(58,42,26,0.28)',
        opacity: entered && !item.exiting ? 1 : 0,
        transform: entered && !item.exiting ? 'translateY(0)' : 'translateY(10px)',
        transition: 'opacity 0.22s ease, transform 0.22s ease',
        whiteSpace: 'nowrap',
        userSelect: 'none',
      }}
    >
      {item.message}
    </div>
  )
}
