import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy – Notable',
}

export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', padding: '48px 24px 80px', fontFamily: 'var(--font-dm-sans, sans-serif)' }}>
      <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#6b5d4f', fontSize: '14px', textDecoration: 'none', marginBottom: '32px' }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
          <path d="M19 12H5M12 5l-7 7 7 7" />
        </svg>
        Back
      </Link>

      <h1 style={{ fontSize: '2rem', fontWeight: 700, color: '#33261a', letterSpacing: '-0.03em', marginBottom: '8px', fontFamily: 'var(--font-playfair, serif)' }}>
        Privacy Policy
      </h1>
      <p style={{ color: '#6b5d4f', fontSize: '14px', marginBottom: '40px' }}>Last updated: May 2025</p>

      <div style={{ color: '#33261a', fontSize: '15px', lineHeight: 1.75 }}>
        <Section title="1. Information we collect">
          <p>When you create an account we collect your email address, name, and profile handle. If you sign in with Google, we receive your name, email, and profile photo from Google.</p>
          <p>We also collect the content you post — recommendations, comments, and any photos you upload — as well as interaction data such as likes, bookmarks, and follows.</p>
        </Section>

        <Section title="2. How we use your information">
          <p>We use your information solely to operate and improve Notable. This includes displaying your public profile, showing your recommendations in feeds, and sending you in-app notifications about activity on your posts.</p>
          <p>We do not sell your personal information to third parties, and we do not use it for advertising.</p>
        </Section>

        <Section title="3. Data storage">
          <p>Your data is stored on Supabase infrastructure hosted in the United States. Uploaded images are stored on Supabase Storage.</p>
        </Section>

        <Section title="4. Third-party services">
          <p>Notable uses the following third-party services:</p>
          <ul style={{ paddingLeft: '20px', marginTop: '8px' }}>
            <li style={{ marginBottom: '4px' }}>Supabase — database and authentication</li>
            <li style={{ marginBottom: '4px' }}>Google OAuth — optional sign-in</li>
            <li>External metadata APIs (Open Library, iTunes, etc.) — for search results. These are read-only lookups; your data is not sent to them.</li>
          </ul>
        </Section>

        <Section title="5. Your rights">
          <p>You may delete your account and all associated data at any time from your profile settings. If you have questions about your data, contact us at the address below.</p>
        </Section>

        <Section title="6. Contact">
          <p>For any privacy-related questions, email us at <a href="mailto:hello@notable.app" style={{ color: '#5271FF' }}>hello@notable.app</a>.</p>
        </Section>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '32px' }}>
      <h2 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#33261a', marginBottom: '10px', fontFamily: 'var(--font-playfair, serif)' }}>
        {title}
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>{children}</div>
    </div>
  )
}
