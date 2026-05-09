import Link from 'next/link'
import Navbar from './components/Navbar'

/* ─── Category data ────────────────────────────────────────────────────────── */
const categories = [
  {
    name: 'Books',
    slug: 'books',
    color: '#5271FF',
    description: 'The ones that stayed with you',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 48, height: 48 }}>
        <path d="M24 42V12" />
        <path d="M6 10c0-2.2 1.8-4 4-4h10a4 4 0 014 4v30c0-2.2-1.8-4-4-4H10a4 4 0 01-4-4V10z" />
        <path d="M42 10c0-2.2-1.8-4-4-4H28a4 4 0 00-4 4v30c0-2.2 1.8-4 4-4h10a4 4 0 004-4V10z" />
        <line x1="10" y1="18" x2="20" y2="18" />
        <line x1="10" y1="24" x2="20" y2="24" />
        <line x1="38" y1="18" x2="28" y2="18" />
        <line x1="38" y1="24" x2="28" y2="24" />
      </svg>
    ),
  },
  {
    name: 'Movies',
    slug: 'movies',
    color: '#dc4f5c',
    description: 'Worth the two hours',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 48, height: 48 }}>
        <rect x="4" y="14" width="40" height="28" rx="3" />
        <line x1="4" y1="22" x2="44" y2="22" />
        <line x1="16" y1="14" x2="16" y2="8" />
        <line x1="32" y1="14" x2="32" y2="8" />
        <line x1="10" y1="8" x2="16" y2="14" />
        <line x1="26" y1="8" x2="32" y2="14" />
        <line x1="4" y1="8" x2="10" y2="14" />
        <circle cx="14" cy="32" r="2" />
        <circle cx="24" cy="32" r="2" />
        <circle cx="34" cy="32" r="2" />
      </svg>
    ),
  },
  {
    name: 'Music',
    slug: 'music',
    color: '#4aad4e',
    description: 'Albums on repeat',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 48, height: 48 }}>
        <path d="M8 26c0-8.8 7.2-16 16-16s16 7.2 16 16" />
        <path d="M4 38V26a4 4 0 018 0v12a4 4 0 01-8 0z" />
        <path d="M36 38V26a4 4 0 018 0v12a4 4 0 01-8 0z" />
        <path d="M8 38a4 4 0 008 0M36 38a4 4 0 008 0" />
      </svg>
    ),
  },
  {
    name: 'Restaurants',
    slug: 'restaurants',
    color: '#9055d0',
    description: 'Tell everyone or keep it secret',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 48, height: 48 }}>
        <circle cx="24" cy="24" r="14" />
        <line x1="24" y1="10" x2="24" y2="38" />
        <line x1="10" y1="24" x2="38" y2="24" />
        <line x1="38" y1="8" x2="38" y2="18" />
        <line x1="38" y1="8" x2="34" y2="12" />
        <line x1="38" y1="8" x2="42" y2="12" />
        <line x1="38" y1="18" x2="38" y2="40" />
      </svg>
    ),
  },
  {
    name: 'Podcasts',
    slug: 'podcasts',
    color: '#d4920a',
    description: 'Ears-first discoveries',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 48, height: 48 }}>
        <rect x="18" y="4" width="12" height="24" rx="6" />
        <path d="M10 22c0 7.7 6.3 14 14 14s14-6.3 14-14" />
        <line x1="24" y1="36" x2="24" y2="44" />
        <line x1="16" y1="44" x2="32" y2="44" />
      </svg>
    ),
  },
]

/* ─── Page ─────────────────────────────────────────────────────────────────── */
export default function LandingPage() {
  return (
    <>
      <Navbar />

      <main className="flex-1">
        {/* ── HERO ──────────────────────────────────────────────────────────── */}
        <section className="relative flex flex-col items-center justify-center text-center min-h-screen px-6 pb-24 pt-32">
          {/* Notable logo in Climate Crisis font */}
          <p
            style={{
              fontFamily: 'var(--font-crisis)',
              fontSize: 'clamp(3.5rem, 10vw, 8rem)',
              color: 'var(--color-text)',
              lineHeight: 1,
              letterSpacing: '-0.01em',
              marginBottom: '20px',
            }}
          >
            Notable
          </p>

          {/* Tagline in Playfair */}
          <h1
            className="font-display font-bold text-text"
            style={{
              fontSize: 'clamp(1.2rem, 2.5vw, 1.8rem)',
              maxWidth: '32ch',
              letterSpacing: '-0.01em',
              lineHeight: 1.4,
              marginBottom: '40px',
              color: 'var(--color-muted)',
              fontStyle: 'italic',
            }}
          >
            Get in, get inspired, go live your life.
          </h1>

          {/* CTA */}
          <Link
            href="/signup"
            className="font-body font-semibold text-base px-8 py-4 rounded-full inline-block transition-all duration-200"
            style={{
              background: '#5271FF',
              color: '#fff',
              boxShadow: '0 0 32px rgba(82,113,255,0.3)',
            }}
          >
            Join Free
          </Link>
        </section>

        {/* ── CATEGORIES ────────────────────────────────────────────────────── */}
        <section className="px-6 py-24" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
          <div className="max-w-6xl mx-auto">
            <h2
              className="font-display font-bold text-text text-center"
              style={{
                fontSize: 'clamp(1.6rem, 3.5vw, 2.4rem)',
                letterSpacing: '-0.02em',
                marginBottom: '48px',
              }}
            >
              Five lanes.{' '}
              <span style={{ color: '#5271FF', fontStyle: 'italic' }}>You choose.</span>
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {categories.map((cat) => (
                <Link
                  key={cat.name}
                  href={`/${cat.slug}`}
                  className="flex flex-col items-center justify-center text-center rounded-2xl px-4 py-10 gap-4 transition-opacity duration-200 hover:opacity-90"
                  style={{
                    background: cat.color,
                    minHeight: '200px',
                    textDecoration: 'none',
                  }}
                >
                  <div style={{ opacity: 0.9 }}>{cat.icon}</div>
                  <div>
                    <p className="font-body font-bold text-white" style={{ fontSize: '1rem', marginBottom: '4px' }}>
                      {cat.name}
                    </p>
                    <p className="font-body" style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.75rem', lineHeight: 1.3 }}>
                      {cat.description}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* ── FOOTER ──────────────────────────────────────────────────────────── */}
      <footer className="px-6 py-10" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p
            className="font-body font-semibold text-text"
            style={{ fontSize: '1rem', fontFamily: 'var(--font-crisis)', letterSpacing: '-0.01em' }}
          >
            Notable
          </p>

          <nav className="flex items-center gap-6">
            {[['About', '/about'], ['Privacy', '/privacy'], ['Terms', '/terms'], ['Contact', '/contact']].map(([label, href]) => (
              <a
                key={label}
                href={href}
                className="font-body text-sm text-muted hover:text-text transition-colors duration-200"
              >
                {label}
              </a>
            ))}
          </nav>

          <p className="font-body text-sm" style={{ color: 'var(--color-muted)' }}>
            © 2026 Notable
          </p>
        </div>
      </footer>
    </>
  )
}
