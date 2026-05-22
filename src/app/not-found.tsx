import Link from 'next/link'

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f5f0e8',
        color: '#33261a',
        fontFamily: 'var(--font-body, "DM Sans", sans-serif)',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <div style={{ maxWidth: '400px' }}>
        <div style={{ fontSize: '2rem', marginBottom: '1rem', opacity: 0.4 }}>✦</div>
        <h1
          className="font-display"
          style={{
            fontSize: '1.4rem',
            fontWeight: 600,
            marginBottom: '0.75rem',
            letterSpacing: '-0.02em',
          }}
        >
          Page not found
        </h1>
        <p
          style={{
            fontSize: '0.95rem',
            color: '#6b5d4f',
            lineHeight: 1.6,
            marginBottom: '2rem',
          }}
        >
          This page doesn&apos;t exist, but your next great recommendation is one tap away.
        </p>
        <Link
          href="/"
          style={{
            display: 'inline-block',
            background: '#5271FF',
            color: '#f5f0e8',
            borderRadius: '12px',
            padding: '0.75rem 1.75rem',
            fontSize: '0.95rem',
            fontWeight: 600,
            textDecoration: 'none',
            boxShadow: '0 0 24px rgba(82,113,255,0.3)',
          }}
        >
          Go home
        </Link>
      </div>
    </div>
  )
}
