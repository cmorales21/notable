import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import Navbar from './components/Navbar'
import FadeIn from './components/FadeIn'
import AuthCard from './components/AuthCard'

export const metadata: Metadata = {
  title: 'Notable — Get in, get inspired, go live your life',
  description: "A social recommendation platform for Books, Movies, Music, Restaurants and Podcasts. Discover what's genuinely worth your time through people whose taste you trust.",
  openGraph: {
    title: 'Notable — Get in, get inspired, go live your life',
    description: "A social recommendation platform for Books, Movies, Music, Restaurants and Podcasts. Discover what's genuinely worth your time through people whose taste you trust.",
    siteName: 'Notable',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Notable — Get in, get inspired, go live your life',
    description: "A social recommendation platform for Books, Movies, Music, Restaurants and Podcasts. Discover what's genuinely worth your time through people whose taste you trust.",
  },
}

/* ─── Tile data (matches lobby exactly) ─────────────────────────────────── */
const TILES = [
  { name: 'Books',       href: '/books',       color: '#5271FF', iconSrc: '/icons/books-large.svg',       iconWidth: '80%' },
  { name: 'Movies & TV', href: '/movies',      color: '#dc4f5c', iconSrc: '/icons/movies-large.svg',      iconWidth: '44%' },
  { name: 'Music',       href: '/music',       color: '#4aad4e', iconSrc: '/icons/music-large.svg',       iconWidth: '44%' },
  { name: 'Restaurants', href: '/restaurants', color: '#9055d0', iconSrc: '/icons/restaurants-ramen.svg',  iconWidth: '52%' },
  { name: 'Podcasts',    href: '/podcasts',    color: '#d4920a', iconSrc: '/icons/podcasts-large.svg',    iconWidth: '44%' },
]

/* ─── Mosaic image data — 75 images, all {cat}-{n}.jpg, interleaved 5×5 ─── */

type StripImage = { src: string; alt: string }

const CATS = ['movies', 'music', 'books', 'food', 'podcasts'] as const

function makeRow(start: number): StripImage[] {
  const row: StripImage[] = []
  for (let n = start; n < start + 5; n++) {
    for (const cat of CATS) {
      row.push({ src: `/mosaic/${cat}-${n}.jpg`, alt: `${cat} ${n}` })
    }
  }
  return row
}

const ROW1 = makeRow(1)   // images 1–5 from each category
const ROW2 = makeRow(6)   // images 6–10
const ROW3 = makeRow(11)  // images 11–15

/* ─── Scrolling strip row (CSS-animated, seamless) ───────────────────────── */
function StripRow({ images, offset = '0s' }: { images: StripImage[]; offset?: string }) {
  return (
    <div style={{ overflow: 'hidden' }}>
      <div
        className="strip-row"
        style={{
          display: 'flex',
          gap: '2px',
          width: 'max-content',
          /* scroll-right: translateX(-50%) → translateX(0), images move left-to-right */
          animation: `scroll-right 135s linear ${offset} infinite`,
        }}
      >
        {/* Original set + duplicate — translateX(-50%) loops back to start seamlessly */}
        {[...images, ...images].map((img, i) => (
          <div key={i} className="strip-box" style={{ position: 'relative' }}>
            <Image
              src={img.src}
              alt={img.alt}
              fill
              sizes="(max-width: 768px) 25vw, 15vw"
              style={{ objectFit: 'cover' }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}


/* ─── Lobby tile inner (matches lobby/page.tsx exactly) ─────────────────── */
function TileInner({ name, color, iconSrc, iconWidth }: {
  name: string
  color: string
  iconSrc: string
  iconWidth: string
}) {
  return (
    <div
      className="lobby-tile w-full flex flex-col items-center rounded-xl h-[130px] min-[400px]:h-[140px] md:h-[212px]"
      style={{ background: color, overflow: 'hidden' }}
    >
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: '1rem', width: '100%' }}>
        <Image
          src={iconSrc}
          alt={name}
          className="lobby-tile-icon"
          width={120}
          height={120}
          style={{ maxWidth: iconWidth, width: 'auto', height: 'auto', display: 'block', margin: '0 auto', filter: 'brightness(0) invert(1)', opacity: 0.95 }}
        />
      </div>
      <span
        className="font-body"
        style={{ color: '#f5f0e8', fontSize: '0.9rem', fontWeight: 400, letterSpacing: '0.1em', textTransform: 'uppercase', paddingBottom: '0.875rem' }}
      >
        {name}
      </span>
    </div>
  )
}

/* ─── Page ───────────────────────────────────────────────────────────────── */
export default function LandingPage() {
  return (
    <>
      <Navbar />
      <main>

        {/* ── 1 — HEADLINE ─────────────────────────────────────────────────── */}
        <section className="px-6 pt-24 md:pt-28 pb-5 md:pb-6 text-center overflow-hidden">
          <h1
            className="font-display font-bold fade-in-up md:whitespace-nowrap"
            style={{
              fontSize: 'clamp(1.4rem, 3.2vw, 3.2rem)',
              letterSpacing: '-0.02em',
              color: 'var(--color-text)',
              lineHeight: 1.1,
              margin: '0 auto',
            }}
          >
            Collect, share and discover your next favourite find.
          </h1>
        </section>

        {/* ── 2 — SCROLLING STRIP WITH AUTH FORM ───────────────────────────── */}
        {/*
          .strip-section: position:relative for the absolute card overlay.
          overflow-x:clip on the inner wrapper clips the 110vw strip rows
          without creating a stacking context, so the card can overflow
          vertically beyond the strip rows without being cut off.
          hover → pauses all .strip-row animations via CSS.
        */}
        <div
          className="strip-section"
          style={{ position: 'relative' }}
        >
          {/* overflow-x:clip clips the 110vw bleed without blocking the card vertically */}
          <div style={{ overflowX: 'clip' }}>
            <div
              style={{
                width: '110vw',
                marginLeft: '-5vw',
                paddingTop: '32px',
                paddingBottom: '32px',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <StripRow images={ROW1} />
                <StripRow images={ROW2} offset="-6s" />
                <StripRow images={ROW3} offset="-13s" />
              </div>
            </div>
          </div>

          {/* Desktop: auth card floats right, vertically centered, above the strip */}
          <div
            className="hidden md:block"
            style={{
              position: 'absolute',
              top: '50%',
              right: '4%',
              transform: 'translateY(-50%)',
              zIndex: 10,
              width: '320px',
            }}
          >
            <AuthCard />
          </div>

        </div>

        {/* Mobile: auth card sits below the strip as a full-width section */}
        <div className="md:hidden px-5 pt-5 pb-3">
          <AuthCard />
        </div>

        {/* ── 3 — SUBLINE ──────────────────────────────────────────────────── */}
        <FadeIn>
          <section
            className="px-6 py-6 md:py-8 text-center"
            style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}
          >
            <p
              className="font-display font-bold mx-auto"
              style={{
                fontSize: 'clamp(1.1rem, 2.5vw, 2.5rem)',
                letterSpacing: '-0.01em',
                color: 'var(--color-text)',
                lineHeight: 1.2,
              }}
            >
              Books, movies, music, restaurants and podcasts — all in one place.
            </p>
          </section>
        </FadeIn>

        {/* ── 4 — FIVE CATEGORY TILES ──────────────────────────────────────── */}
        <FadeIn delay={60}>
          <section
            className="px-5 md:px-8 lg:px-12 py-6 md:py-10"
            style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}
          >
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
          </section>
        </FadeIn>

        {/* ── 5 — PHILOSOPHY ───────────────────────────────────────────────── */}
        <FadeIn delay={60}>
          <section
            className="px-6 py-6 md:py-8 text-center"
            style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}
          >
            <p
              className="font-body mx-auto"
              style={{
                fontSize: 'clamp(1.25rem, 1.8vw, 1.35rem)',
                color: '#6b5d4f',
                maxWidth: '48ch',
                lineHeight: 1.75,
              }}
            >
              No algorithms. No endless scrolling. No AI. Just people sharing what they love.
            </p>
          </section>
        </FadeIn>

        {/* ── 6 — CLOSING CTA ──────────────────────────────────────────────── */}
        <FadeIn delay={60}>
          <section
            className="px-6 py-10 md:py-14 text-center"
            style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}
          >
            <h2
              className="font-display font-bold"
              style={{
                fontSize: 'clamp(1.8rem, 4vw, 2.8rem)',
                letterSpacing: '-0.02em',
                color: 'var(--color-text)',
                marginBottom: '24px',
                lineHeight: 1.2,
              }}
            >
              Start sharing what you love.
            </h2>
            <Link
              href="/signup"
              className="font-body font-semibold inline-block transition-opacity duration-200 hover:opacity-90"
              style={{
                background: 'var(--color-books)',
                color: '#fff',
                padding: '13px 36px',
                borderRadius: '100px',
                fontSize: '1rem',
                textDecoration: 'none',
              }}
            >
              Join Notable
            </Link>
          </section>
        </FadeIn>

      </main>

      {/* ── FOOTER ───────────────────────────────────────────────────────────── */}
      <footer className="px-6 py-8" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p style={{ fontFamily: 'var(--font-climate-crisis)', fontSize: '1rem', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--color-text)' }}>
            NOTABLE
          </p>
          <nav className="flex items-center gap-6">
            {[['About', '/about'], ['Privacy', '/privacy'], ['Terms', '/terms'], ['Contact', '/contact']].map(([label, href]) => (
              <a
                key={label}
                href={href}
                className="font-body text-sm transition-colors duration-200 hover:text-text"
                style={{ color: 'var(--color-muted)', textDecoration: 'none' }}
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
