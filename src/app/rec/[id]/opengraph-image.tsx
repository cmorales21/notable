import { ImageResponse } from 'next/og'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createAnonClient } from '@supabase/supabase-js'
import { CATEGORY_COLORS, CATEGORY_LABELS, CATEGORY_ORDER } from '@/app/lib/theme'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const CATEGORY: Record<string, { label: string; color: string }> = Object.fromEntries(
  CATEGORY_ORDER.map((c) => [c, { label: CATEGORY_LABELS[c], color: CATEGORY_COLORS[c] }])
)

const LINEN   = '#f5f0e8'
const PANEL   = '#fffcf8'
const MUTED   = '#6b5d4f'
const PRIMARY = '#33261a'

function truncate(str: string, max: number): string {
  return str.length <= max ? str : str.slice(0, max - 1).trimEnd() + '…'
}

export default async function Image({ params }: { params: { id: string } }) {
  const { id } = params

  // ── Fetch rec data ─────────────────────────────────────────────────────────
  const db = createAdminClient() ?? createAnonClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { data: rec } = await db
    .from('recommendations')
    .select('id, category, title, description, image_url, user_id')
    .eq('id', id)
    .maybeSingle()

  const profile = rec
    ? await db.from('profiles').select('name, handle').eq('id', rec.user_id).maybeSingle().then(r => r.data)
    : null

  // ── Load Playfair Display Bold ─────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fonts: any[] = []
  try {
    const cssRes = await fetch(
      'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&display=swap',
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; bot)' } }
    )
    if (cssRes.ok) {
      const css = await cssRes.text()
      const fontUrl = css.match(/src:\s*url\(([^)]+)\)/)?.[1]
      if (fontUrl) {
        const fontData = await fetch(fontUrl).then(r => r.arrayBuffer())
        fonts.push({ name: 'Playfair Display', data: fontData, style: 'normal', weight: 700 })
      }
    }
  } catch { /* font load failure — fall back to system serif */ }

  const hasPlayfair = fonts.length > 0
  const displayFont = hasPlayfair ? '"Playfair Display", serif' : 'serif'

  // ── Fallback card (rec not found) ──────────────────────────────────────────
  if (!rec) {
    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex', width: 1200, height: 630,
            backgroundColor: LINEN,
            alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: 16,
          }}
        >
          <div style={{
            fontSize: 64, fontFamily: displayFont, fontWeight: 700,
            color: PRIMARY, letterSpacing: '-0.02em',
          }}>
            Notable
          </div>
          <div style={{ fontSize: 22, fontFamily: 'sans-serif', color: MUTED }}>
            Recommendations worth sharing
          </div>
        </div>
      ),
      { ...size, fonts },
    )
  }

  // ── Data prep ──────────────────────────────────────────────────────────────
  const cat = CATEGORY[rec.category] ?? { label: rec.category, color: '#6b5d4f' }
  const title = truncate(rec.title, 60)
  const recommenderName = profile?.name ?? profile?.handle ?? 'Someone on Notable'
  const description = rec.description ? truncate(rec.description, 100) : null

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex', width: 1200, height: 630,
          backgroundColor: LINEN,
          fontFamily: 'sans-serif',
        }}
      >
        {/* ── Left: cover image panel ── */}
        <div
          style={{
            width: 500, height: 630, flexShrink: 0,
            backgroundColor: `${cat.color}22`,
            overflow: 'hidden', position: 'relative',
            display: 'flex',
          }}
        >
          {rec.image_url ? (
            <img
              src={rec.image_url}
              width={500}
              height={630}
              style={{ objectFit: 'cover', width: '100%', height: '100%' }}
              alt=""
            />
          ) : (
            /* Colour block with initial letter when no image */
            <div
              style={{
                display: 'flex', width: '100%', height: '100%',
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: cat.color,
              }}
            >
              <div
                style={{
                  fontSize: 180, fontFamily: displayFont, fontWeight: 700,
                  color: 'rgba(255,255,255,0.18)', lineHeight: 1,
                  userSelect: 'none',
                }}
              >
                {rec.title.charAt(0).toUpperCase()}
              </div>
            </div>
          )}

        </div>

        {/* ── Right: content panel ── */}
        <div
          style={{
            flex: 1,
            display: 'flex', flexDirection: 'column',
            backgroundColor: PANEL,
            padding: '52px 56px 44px 44px',
          }}
        >
          {/* Category badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: 28,
            }}
          >
            <div
              style={{
                display: 'flex',
                backgroundColor: `${cat.color}18`,
                borderRadius: 100,
                paddingTop: 6, paddingBottom: 6, paddingLeft: 16, paddingRight: 16,
              }}
            >
              <span
                style={{
                  fontSize: 15, fontWeight: 700, fontFamily: 'sans-serif',
                  color: cat.color, letterSpacing: '0.04em', textTransform: 'uppercase',
                }}
              >
                {cat.label}
              </span>
            </div>
          </div>

          {/* Title */}
          <div
            style={{
              fontSize: title.length > 40 ? 42 : 52,
              fontFamily: displayFont,
              fontWeight: 700,
              color: PRIMARY,
              lineHeight: 1.2,
              letterSpacing: '-0.02em',
              marginBottom: 24,
              display: 'flex',
            }}
          >
            {title}
          </div>

          {/* Description */}
          {description && (
            <div
              style={{
                fontSize: 20,
                fontFamily: 'sans-serif',
                fontStyle: 'italic',
                color: MUTED,
                lineHeight: 1.55,
                marginBottom: 20,
                display: 'flex',
              }}
            >
              &quot;{description}&quot;
            </div>
          )}

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Recommender line */}
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28,
            }}
          >
            <div
              style={{
                width: 4, height: 20, borderRadius: 2,
                backgroundColor: cat.color,
                display: 'flex',
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 18, fontFamily: 'sans-serif', color: MUTED }}>
              Recommended by{' '}
              <span style={{ color: PRIMARY, fontWeight: 600 }}>{recommenderName}</span>
            </span>
          </div>

          {/* Notable wordmark */}
          <div
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              borderTop: `1px solid rgba(51,38,26,0.1)`,
              paddingTop: 20,
            }}
          >
            <div
              style={{
                fontSize: 28, fontFamily: displayFont, fontWeight: 700,
                color: PRIMARY, letterSpacing: '-0.01em',
                display: 'flex',
              }}
            >
              Notable
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  )
}
