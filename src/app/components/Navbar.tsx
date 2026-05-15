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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo — clamp keeps 1.85rem on desktop, shrinks to 1.25rem on small mobile */}
        <Link
          href="/"
          className="select-none"
          style={{
            fontFamily: 'var(--font-climate-crisis)',
            fontSize: 'clamp(1.25rem, 5vw, 1.85rem)',
            fontWeight: 400,
            letterSpacing: '0.04em',
            color: '#33261a',
            textTransform: 'uppercase',
            textDecoration: 'none',
            lineHeight: 1,
          }}
        >
          NOTABLE
        </Link>

        {/* Actions */}
        <div className="flex items-center gap-2 sm:gap-4">
          <Link
            href="/login"
            className="font-body text-xs sm:text-sm font-medium transition-opacity duration-200 hover:opacity-70"
            style={{ color: 'var(--color-text)', textDecoration: 'none' }}
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="font-body text-xs sm:text-sm font-semibold px-3 py-1.5 sm:px-5 sm:py-2 rounded-full transition-opacity duration-200"
            style={{ background: 'var(--color-books)', color: '#fff', textDecoration: 'none' }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '0.88' }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '1' }}
          >
            Join Notable
          </Link>
        </div>
      </div>
    </nav>
  )
}
