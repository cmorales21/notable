import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Contact – Notable',
}

export default function ContactPage() {
  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', padding: '48px 24px 80px', fontFamily: 'var(--font-dm-sans, sans-serif)' }}>
      <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#6b5d4f', fontSize: '14px', textDecoration: 'none', marginBottom: '32px' }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
          <path d="M19 12H5M12 5l-7 7 7 7" />
        </svg>
        Back
      </Link>

      <h1 style={{ fontSize: '2rem', fontWeight: 700, color: '#33261a', letterSpacing: '-0.03em', marginBottom: '32px', fontFamily: 'var(--font-playfair, serif)' }}>
        Get in touch
      </h1>

      <div style={{ color: '#33261a', fontSize: '15px', lineHeight: 1.75, display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <p>
          Got a question, a bug report, or just want to say hello? We&rsquo;d love to hear from you.
        </p>

        <p>
          Email us at{' '}
          <a href="mailto:hello@notable.app" style={{ color: '#5271FF', textDecoration: 'none' }}>
            hello@notable.app
          </a>
          {' '}and we&rsquo;ll get back to you as soon as we can.
        </p>
      </div>
    </div>
  )
}
