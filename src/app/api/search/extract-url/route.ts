import { NextRequest, NextResponse } from 'next/server'

// ── In-memory rate limiter: 20 requests / IP / hour ──────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 20
const WINDOW_MS = 60 * 60 * 1000

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  for (const [key, entry] of rateLimitMap) {
    if (entry.resetAt < now) rateLimitMap.delete(key)
  }
  const entry = rateLimitMap.get(ip)
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count++
  return true
}

function isPrivateHost(hostname: string): boolean {
  if (hostname === 'localhost' || hostname.endsWith('.local')) return true
  // Only block raw IP addresses — no DNS resolution
  const ipv4 = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (ipv4) {
    const [, a, b] = ipv4.map(Number)
    if (a === 127) return true                            // 127.0.0.0/8
    if (a === 10) return true                             // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true     // 172.16.0.0/12
    if (a === 192 && b === 168) return true               // 192.168.0.0/16
    if (a === 169 && b === 254) return true               // 169.254.0.0/16 (link-local)
    if (a === 0) return true                              // 0.0.0.0/8
  }
  return false
}

function validateUrl(raw: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return null
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
  if (isPrivateHost(parsed.hostname)) return null
  return raw
}

function getMeta(html: string, property: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']*?)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*?)["'][^>]+(?:property|name)=["']${property}["']`, 'i'),
  ]
  for (const pat of patterns) {
    const m = html.match(pat)
    if (m?.[1]) return m[1].trim()
  }
  return null
}

// ── YouTube oEmbed handler ────────────────────────────────────────────────────
// YouTube blocks server-side HTML scraping, so OG tags are unreliable.
// oEmbed is public, unauthenticated, and always returns the correct title +
// thumbnail for any public video.

const YOUTUBE_RE = /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/watch[?&]v=|youtu\.be\/)/i

async function handleYoutube(url: string): Promise<NextResponse | null> {
  if (!YOUTUBE_RE.test(url)) return null

  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 5000)
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
      { signal: ctrl.signal, cache: 'no-store' }
    )
    clearTimeout(t)
    if (!res.ok) return null

    type OEmbed = { title?: string; thumbnail_url?: string; author_name?: string }
    const data = await res.json() as OEmbed
    if (!data.title) return null

    // Prefer maxresdefault over hqdefault — verify it exists first
    let image_url: string | null = data.thumbnail_url ?? null
    if (image_url?.includes('hqdefault')) {
      const maxRes = image_url.replace('hqdefault', 'maxresdefault')
      try {
        const headCtrl = new AbortController()
        const ht = setTimeout(() => headCtrl.abort(), 3000)
        const head = await fetch(maxRes, { method: 'HEAD', signal: headCtrl.signal, cache: 'no-store' })
        clearTimeout(ht)
        if (head.ok) image_url = maxRes
      } catch { /* keep hqdefault */ }
    }

    return NextResponse.json({ title: data.title, description: data.author_name ?? '', image_url, url })
  } catch {
    return null
  }
}

const IMDB_RE = /imdb\.com\/title\/(tt\d{7,8})/i

async function handleImdb(url: string): Promise<NextResponse | null> {
  const match = url.match(IMDB_RE)
  if (!match) return null

  const imdbId = match[1]
  const apiKey = process.env.TMDB_API_KEY
  if (!apiKey) return null

  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/find/${imdbId}?external_source=imdb_id`,
      { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' }
    )
    if (!res.ok) return null

    type TmdbResult = { title?: string; name?: string; poster_path?: string | null }
    const data = await res.json() as { movie_results?: TmdbResult[]; tv_results?: TmdbResult[] }
    const item = data.movie_results?.[0] ?? data.tv_results?.[0]
    if (!item) return null

    const title = item.title ?? item.name ?? ''
    const image_url = item.poster_path
      ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
      : null

    return NextResponse.json({ title, description: '', image_url, url })
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    )
  }

  let url: string
  try {
    const body = await req.json()
    url = body.url
    if (!url || typeof url !== 'string') throw new Error()
  } catch {
    return NextResponse.json({ error: 'URL required' }, { status: 400 })
  }

  if (!validateUrl(url)) {
    return NextResponse.json({ error: 'Invalid or blocked URL' }, { status: 400 })
  }

  const youtubeResult = await handleYoutube(url)
  if (youtubeResult) return youtubeResult

  const imdbResult = await handleImdb(url)
  if (imdbResult) return imdbResult

  try {
    const ctrl = new AbortController()
    const timeout = setTimeout(() => ctrl.abort(), 5000)

    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NotableBot/1.0)' },
    })
    clearTimeout(timeout)

    const html = await res.text()

    const title =
      getMeta(html, 'og:title') ??
      html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ??
      ''
    const description = getMeta(html, 'og:description') ?? ''
    const image_url = getMeta(html, 'og:image') ?? null

    return NextResponse.json({ title, description, image_url, url })
  } catch {
    return NextResponse.json({ title: '', description: '', image_url: null, url })
  }
}
