import Link from 'next/link'

// ─── Tile config ──────────────────────────────────────────────────────────────

const TILES = [
  { name: 'Books',       href: '/books',       color: '#5271FF', iconSrc: '/icons/books-large.svg',       iconWidth: '80%' },
  { name: 'Movies',      href: '/movies',      color: '#dc4f5c', iconSrc: '/icons/movies-large.svg',      iconWidth: '44%' },
  { name: 'Music',       href: '/music',       color: '#4aad4e', iconSrc: '/icons/music-large.svg',       iconWidth: '44%' },
  { name: 'Restaurants', href: '/restaurants', color: '#9055d0', iconSrc: '/icons/restaurants-ramen.svg',  iconWidth: '52%' },
  { name: 'Podcasts',    href: '/podcasts',    color: '#d4920a', iconSrc: '/icons/podcasts-large.svg',    iconWidth: '44%' },
]

// ─── Shared tile inner layout ─────────────────────────────────────────────────

function TileInner({ name, color, iconSrc, iconWidth }: { name: string; color: string; iconSrc: string; iconWidth: string }) {
  return (
    <div
      className="lobby-tile w-full flex flex-col items-center rounded-xl h-[130px] min-[400px]:h-[140px] md:h-[212px]"
      style={{ background: color, overflow: 'hidden' }}
    >
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: '1rem',
        width: '100%',
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={iconSrc}
          alt={name}
          className="lobby-tile-icon"
          style={{ maxWidth: iconWidth, width: 'auto', height: 'auto', display: 'block', margin: '0 auto', filter: 'brightness(0) invert(1)', opacity: 0.95 }}
        />
      </div>
      <span
        className="font-body"
        style={{
          color: '#f0ead8',
          fontSize: '0.9rem',
          fontWeight: 400,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          paddingBottom: '0.875rem',
        }}
      >
        {name}
      </span>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LobbyPage() {
  return (
    <div
      className="min-h-screen px-5 md:px-8 lg:px-12"
      style={{
        background: '#f5f0e8',
        paddingTop: '1rem',
        paddingBottom: '3rem',
      }}
    >

      {/* ── Tile grid ─────────────────────────────────────────────── */}
      {/*
        Mobile: single column
        Desktop (md+): 6-column grid, all tiles col-span-2 (equal thirds)
          Row 1 — Books (cols 1-2), Movies (cols 3-4), Music (cols 5-6)
          Row 2 — Restaurants (cols 2-3), Podcasts (cols 4-5) → centered
      */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-x-4 gap-y-3 md:gap-x-6 md:gap-y-3 max-w-5xl mx-auto">

        {TILES.slice(0, 3).map(({ name, href, color, iconSrc, iconWidth }) => (
          <Link
            key={href}
            href={href}
            className="col-span-1 md:col-span-2 select-none"
            style={{ textDecoration: 'none' }}
          >
            <TileInner name={name} color={color} iconSrc={iconSrc} iconWidth={iconWidth} />
          </Link>
        ))}

        {/* Restaurants and Podcasts: col-span-2 each, col-start-2 on Restaurants to center the pair */}
        {TILES.slice(3).map(({ name, href, color, iconSrc, iconWidth }, i) => (
          <Link
            key={href}
            href={href}
            className={`col-span-1 md:col-span-2${i === 0 ? ' md:col-start-2' : ''} select-none`}
            style={{ textDecoration: 'none' }}
          >
            <TileInner name={name} color={color} iconSrc={iconSrc} iconWidth={iconWidth} />
          </Link>
        ))}

      </div>
    </div>
  )
}
