import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'About – Notable',
}

export default function AboutPage() {
  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', padding: '48px 24px 80px', fontFamily: 'var(--font-dm-sans, sans-serif)' }}>
      <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#6b5d4f', fontSize: '14px', textDecoration: 'none', marginBottom: '32px' }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
          <path d="M19 12H5M12 5l-7 7 7 7" />
        </svg>
        Back
      </Link>

      <h1 style={{ fontSize: '2rem', fontWeight: 700, color: '#33261a', letterSpacing: '-0.03em', marginBottom: '32px', fontFamily: 'var(--font-playfair, serif)' }}>
        About Notable
      </h1>

      <div style={{ color: '#33261a', fontSize: '15px', lineHeight: 1.75, display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <p>
          Notable is where people share what&rsquo;s genuinely worth their time. Not algorithmic suggestions, not sponsored content — just real recommendations from people you trust.
        </p>

        <p>
          We cover five categories: <strong>Books</strong> that stayed with you long after the last page, <strong>Movies</strong> worth two hours of your evening, <strong>Music</strong> you&rsquo;ve had on repeat, <strong>Restaurants</strong> you&rsquo;d send a friend to without hesitation, and <strong>Podcasts</strong> that made a long drive feel short. Each one curated by hand, by humans.
        </p>

        <p>
          The idea is simple: the best things to read, watch, eat, and listen to don&rsquo;t need an algorithm. They need a friend who pays attention. Notable is that friend, scaled.
        </p>

        <p style={{ color: '#6b5d4f' }}>
          Built with care in 2026.
        </p>
      </div>
    </div>
  )
}
