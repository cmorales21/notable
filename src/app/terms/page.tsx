import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service – Notable',
}

export default function TermsPage() {
  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', padding: '48px 24px 80px', fontFamily: 'var(--font-dm-sans, sans-serif)' }}>
      <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#6b5d4f', fontSize: '14px', textDecoration: 'none', marginBottom: '32px' }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
          <path d="M19 12H5M12 5l-7 7 7 7" />
        </svg>
        Back
      </Link>

      <h1 style={{ fontSize: '2rem', fontWeight: 700, color: '#33261a', letterSpacing: '-0.03em', marginBottom: '8px', fontFamily: 'var(--font-playfair, serif)' }}>
        Terms of Service
      </h1>
      <p style={{ color: '#6b5d4f', fontSize: '14px', marginBottom: '40px' }}>Last updated: May 2025</p>

      <div style={{ color: '#33261a', fontSize: '15px', lineHeight: 1.75 }}>
        <Section title="1. Acceptance">
          <p>By using Notable you agree to these Terms. If you do not agree, please do not use the service.</p>
        </Section>

        <Section title="2. Your account">
          <p>You are responsible for maintaining the security of your account and all activity that occurs under it. You must be at least 13 years old to use Notable.</p>
        </Section>

        <Section title="3. Your content">
          <p>You retain ownership of the recommendations and other content you post. By posting, you grant Notable a non-exclusive license to display that content to other users as part of the service.</p>
          <p>You agree not to post content that is illegal, harmful, harassing, or that infringes third-party intellectual property rights.</p>
        </Section>

        <Section title="4. Acceptable use">
          <p>You may not use Notable to spam, scrape data automatically, attempt to gain unauthorized access to any part of the service, or otherwise interfere with its operation.</p>
        </Section>

        <Section title="5. Termination">
          <p>We reserve the right to suspend or terminate accounts that violate these Terms. You may delete your account at any time.</p>
        </Section>

        <Section title="6. Disclaimer">
          <p>Notable is provided &ldquo;as is&rdquo; without warranties of any kind. We are not responsible for content posted by users.</p>
        </Section>

        <Section title="7. Changes">
          <p>We may update these Terms from time to time. Continued use of Notable after changes constitutes acceptance of the new Terms.</p>
        </Section>

        <Section title="8. Contact">
          <p>Questions about these Terms? Email <a href="mailto:hello@notable.app" style={{ color: '#5271FF' }}>hello@notable.app</a>.</p>
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
