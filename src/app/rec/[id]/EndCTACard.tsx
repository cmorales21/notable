import Link from 'next/link'
import { theme } from '@/app/lib/theme'

// End-of-content CTA. Placed after the recommendation and all comments —
// never above or between them. Gently distinct from the main card.
export function EndCTACard({ nextUrl }: { nextUrl: string }) {
  const encoded = encodeURIComponent(nextUrl)
  return (
    <div
      style={{
        marginTop: '28px',
        padding: '28px 24px 26px',
        background: theme.colors.surface,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: theme.radii.card,
        textAlign: 'center',
      }}
    >
      <p
        className="font-display"
        style={{
          fontSize: 'clamp(1.15rem, 3.4vw, 1.4rem)',
          fontWeight: 600,
          color: theme.colors.textPrimary,
          letterSpacing: '-0.01em',
          lineHeight: 1.35,
          marginBottom: '18px',
        }}
      >
        Someone with great taste sent you this. See what else they love.
      </p>

      <Link
        href={`/signup?next=${encoded}`}
        className="font-body"
        style={{
          display: 'inline-block',
          padding: '11px 26px',
          borderRadius: theme.radii.pill,
          background: theme.categoryColors.books,
          color: '#ffffff',
          fontSize: '14px',
          fontWeight: 600,
          textDecoration: 'none',
        }}
      >
        Join Notable
      </Link>

      <div style={{ marginTop: '14px' }}>
        <Link
          href={`/login?next=${encoded}`}
          className="font-body"
          style={{
            fontSize: '13px',
            color: theme.colors.textMuted,
            textDecoration: 'none',
          }}
        >
          Already a member? <span style={{ color: theme.categoryColors.books, fontWeight: 500 }}>Sign in</span>
        </Link>
      </div>
    </div>
  )
}
