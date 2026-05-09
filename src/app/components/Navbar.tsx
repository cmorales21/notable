'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-500"
      style={{
        background: scrolled ? 'rgba(245,240,232,0.92)' : 'transparent',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(12px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(0,0,0,0.06)' : '1px solid transparent',
      }}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link
          href="/"
          className="font-bold text-text tracking-tight"
          style={{ fontSize: '1.5rem', letterSpacing: '-0.01em', fontFamily: 'var(--font-climate-crisis)' }}
        >
          Notable
        </Link>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="font-body text-sm font-medium text-text px-5 py-2 rounded-full transition-all duration-200"
            style={{
              border: '1px solid rgba(0,0,0,0.15)',
              color: 'var(--color-text)',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(0,0,0,0.3)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(0,0,0,0.15)'
            }}
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="font-body text-sm font-semibold px-5 py-2 rounded-full transition-all duration-200"
            style={{
              background: 'var(--color-books)',
              color: 'var(--color-background)',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLAnchorElement).style.opacity = '0.88'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLAnchorElement).style.opacity = '1'
            }}
          >
            Join Free
          </Link>
        </div>
      </div>
    </nav>
  )
}
