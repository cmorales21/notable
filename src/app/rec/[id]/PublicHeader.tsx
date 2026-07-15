import Link from 'next/link'
import { theme } from '@/app/lib/theme'

// Header shown only to logged-out viewers on /rec/[id]. Always visible,
// never intrusive. Notable philosophy: signup invitations appear passively
// in the header, at the end of content, or at the exact moment of intent —
// never as timed popups, blurs, or metering.
export function PublicHeader({ nextUrl }: { nextUrl: string }) {
  const encoded = encodeURIComponent(nextUrl)
  return (
    <header
      style={{
        height: '56px',
        borderBottom: '1px solid rgba(0,0,0,0.08)',
        background: theme.colors.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        gap: '12px',
      }}
    >
      <Link
        href="/"
        className="select-none"
        style={{
          fontFamily: 'var(--font-climate-crisis)',
          fontSize: '1.85rem',
          fontWeight: 400,
          letterSpacing: '0.04em',
          color: theme.colors.textPrimary,
          textTransform: 'uppercase',
          textDecoration: 'none',
          lineHeight: 1,
        }}
      >
        NOTABLE
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Link
          href={`/login?next=${encoded}`}
          className="font-body"
          style={{
            fontSize: '13px',
            fontWeight: 500,
            color: theme.colors.textPrimary,
            textDecoration: 'none',
            padding: '6px 10px',
          }}
        >
          Sign in
        </Link>
        <Link
          href={`/signup?next=${encoded}`}
          className="font-body"
          style={{
            fontSize: '13px',
            fontWeight: 600,
            padding: '7px 14px',
            borderRadius: theme.radii.pill,
            background: theme.categoryColors.books,
            color: '#ffffff',
            textDecoration: 'none',
          }}
        >
          Join Notable
        </Link>
      </div>
    </header>
  )
}
