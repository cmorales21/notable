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

function isPrivateIPv4Octets(octets: [number, number, number, number]): boolean {
  const [a, b] = octets
  if (a === 127) return true
  if (a === 10) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 169 && b === 254) return true
  if (a === 0) return true
  return false
}

// Parse a hostname that may encode an IPv4 address in decimal (2130706433),
// hex (0x7f000001), octal (0177.0.0.1), or mixed dotted notation. Returns the
// four octets if the hostname is recognizable as a numeric IPv4, else null.
function parseNumericIPv4(hostname: string): [number, number, number, number] | null {
  if (/^\d+$/.test(hostname)) {
    const n = Number(hostname)
    if (!Number.isFinite(n) || n < 0 || n > 0xffffffff) return null
    return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]
  }
  if (/^0[xX][0-9a-fA-F]+$/.test(hostname)) {
    const n = parseInt(hostname, 16)
    if (!Number.isFinite(n) || n < 0 || n > 0xffffffff) return null
    return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]
  }
  const parts = hostname.split('.')
  if (parts.length === 4) {
    const octets: number[] = []
    for (const p of parts) {
      let n: number
      if (/^0[xX][0-9a-fA-F]+$/.test(p)) n = parseInt(p, 16)
      else if (/^0[0-7]+$/.test(p)) n = parseInt(p, 8)
      else if (/^\d+$/.test(p)) n = parseInt(p, 10)
      else return null
      if (!Number.isFinite(n) || n < 0 || n > 255) return null
      octets.push(n)
    }
    return octets as [number, number, number, number]
  }
  return null
}

function isPrivateHost(hostname: string): boolean {
  // URL.hostname returns IPv6 literals wrapped in brackets ("[::1]") — strip them.
  let h = hostname
  if (h.startsWith('[') && h.endsWith(']')) h = h.slice(1, -1)
  const lower = h.toLowerCase()

  if (lower === 'localhost' || lower.endsWith('.local')) return true
  // Cloud metadata hostnames — block by name regardless of how the IP is encoded.
  if (lower === 'metadata.google.internal' || lower === 'metadata' || lower === 'metadata.goog') return true

  if (lower.includes(':')) {
    if (lower === '::' || lower === '::1') return true
    // IPv4-mapped IPv6: ::ffff:127.0.0.1
    const mappedDotted = lower.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/)
    if (mappedDotted) {
      const octets = parseNumericIPv4(mappedDotted[1])
      if (octets && (isPrivateIPv4Octets(octets) || (octets[0] === 169 && octets[1] === 254))) return true
    }
    // IPv4-mapped IPv6 in hex form: ::ffff:7f00:0001
    const mappedHex = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/)
    if (mappedHex) {
      const hi = parseInt(mappedHex[1], 16)
      const lo = parseInt(mappedHex[2], 16)
      const octets: [number, number, number, number] = [
        (hi >> 8) & 0xff, hi & 0xff, (lo >> 8) & 0xff, lo & 0xff,
      ]
      if (isPrivateIPv4Octets(octets) || (octets[0] === 169 && octets[1] === 254)) return true
    }
    // Unique-local fc00::/7 — first byte fc or fd (canonical 4-hex-digit first group).
    if (/^f[cd][0-9a-f]{2}:/.test(lower)) return true
    // Link-local fe80::/10 — first 10 bits 1111111010 → first group fe80–febf.
    if (/^fe[89ab][0-9a-f]:/.test(lower)) return true
    return false
  }

  const octets = parseNumericIPv4(h)
  if (octets) {
    if (isPrivateIPv4Octets(octets)) return true
    // Entire 169.254.0.0/16 link-local range covers 169.254.169.254 metadata IP
    // in every encoding once normalized to octets.
    if (octets[0] === 169 && octets[1] === 254) return true
    return false
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

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'max-age=0',
  'Connection': 'keep-alive',
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

function normalizeImageUrl(url: string | null): string | null {
  if (!url) return null
  if (url.startsWith('//')) return `https:${url}`
  return url
}

// ── YouTube oEmbed handler ────────────────────────────────────────────────────
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

// ── Spotify oEmbed handler ───────────────────────────────────────────────────
// Spotify serves a JS-rendered shell with no OG tags to server-side fetches,
// so the generic scraper can only recover "<title>Spotify – Web Player</title>".
// Their public oEmbed endpoint returns the real title + cover art for tracks,
// albums, playlists, artists, episodes, and shows — no auth required.
const SPOTIFY_RE = /^https?:\/\/open\.spotify\.com\/(?:track|album|playlist|artist|episode|show)\/[A-Za-z0-9]+/i

async function handleSpotify(url: string): Promise<NextResponse | null> {
  if (!SPOTIFY_RE.test(url)) return null

  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 5000)
    const res = await fetch(
      `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`,
      { signal: ctrl.signal, cache: 'no-store' }
    )
    clearTimeout(t)
    if (!res.ok) return null

    type OEmbed = { title?: string; thumbnail_url?: string }
    const data = await res.json() as OEmbed
    if (!data.title) return null

    return NextResponse.json({
      title: data.title,
      description: '',
      image_url: data.thumbnail_url ?? null,
      url,
    })
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

// ── Site-specific fallback extractors ─────────────────────────────────────────

const AMAZON_JUNK_CATEGORIES = new Set([
  'books', 'kindle store', 'kindle edition', 'audible audiobook', 'music',
  'movies & tv', 'electronics', 'home & kitchen', 'clothing', 'toys & games',
  'sports & outdoors', 'tools & home improvement', 'health & personal care',
  'grocery & gourmet food', 'beauty', 'automotive', 'office products',
  'garden & outdoor', 'pet supplies', 'baby', 'video games', 'software',
  'cds & vinyl', 'movies', 'tv', 'dvd', 'blu-ray',
])

function isJunkSegment(seg: string): boolean {
  const s = seg.trim()
  // ISBN: 10 or 13 digits (with or without hyphens)
  if (/^\d{10}(\d{3})?$/.test(s.replace(/-/g, ''))) return true
  // Known Amazon category
  if (AMAZON_JUNK_CATEGORIES.has(s.toLowerCase())) return true
  // Author "Lastname, Firstname" or "Lastname, F. Middlename"
  if (/^[A-ZÀ-ÖØ-öø-ÿ][^,]+,\s+[A-ZÀ-ÖØ-öø-ÿ]/.test(s)) return true
  // Author "Firstname Lastname" — 2–3 capitalized words, letters only (e.g. "Ray Bradbury")
  if (/^[A-ZÀ-ÖØ-öø-ÿ][a-zA-ZÀ-ÖØ-öø-ÿ.]+(?:\s+[A-ZÀ-ÖØ-öø-ÿ][a-zA-ZÀ-ÖØ-öø-ÿ.]+){1,2}$/.test(s) && !/\d/.test(s)) return true
  // Edition segment: "Spanish Edition", "2nd Edition", "Kindle Edition" (short, no colon)
  if (/\bEdition\b/i.test(s) && s.split(/\s+/).length <= 4) return true
  return false
}

function cleanAmazonTitle(raw: string): string | null {
  // Strip leading "Amazon.com: " or "Amazon.co.uk: " etc.
  const withoutPrefix = raw.replace(/^Amazon(?:\.[a-z]{2,6})+:\s*/i, '')

  // Split on ": " and walk from the end removing junk segments
  const segments = withoutPrefix.split(': ')
  while (segments.length > 1 && isJunkSegment(segments[segments.length - 1])) {
    segments.pop()
  }

  // Strip edition parentheticals embedded inside the title: "(Spanish Edition)", "(Revised Edition)"
  const title = segments.join(': ')
    .replace(/\s*\([^)]*\bEdition\b[^)]*\)/gi, '')
    .trim()
    .replace(/[:\s]+$/, '')
  return title || null
}

function extractAmazon(html: string, url: string): { title: string; image_url: string | null } | null {
  // Amazon has <meta name="title"> even when og:title is absent
  const rawTitle =
    getMeta(html, 'title') ??
    html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ??
    ''
  if (!rawTitle) return null

  const title = cleanAmazonTitle(rawTitle)
  if (!title) return null

  // Prefer ASIN-based cover image (reliable, no HTML scraping needed).
  // Amazon product URLs always contain a 10-char alphanumeric ASIN in the path.
  let image_url: string | null = null
  const asinMatch = url.match(/\/(?:dp|gp\/product|product|ASIN|a)\/([A-Z0-9]{10})/i)
  if (asinMatch?.[1]) {
    image_url = `https://images-na.ssl-images-amazon.com/images/P/${asinMatch[1]}.jpg`
  }

  // Fall back to extracting a product image from the HTML.
  // Amazon product images in /images/I/ end with a size code like "L.jpg".
  if (!image_url) {
    const imgMatch = html.match(
      /https:\/\/m\.media-amazon\.com\/images\/I\/[A-Za-z0-9%+\-]+L\.(jpg|jpeg|png)/i
    )
    image_url = imgMatch?.[0] ?? null
  }

  return { title, image_url }
}

function extractImdbFallback(html: string): { title: string } | null {
  const rawTitle = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? ''
  if (!rawTitle) return null
  const title = rawTitle.replace(/\s*[-–|]?\s*IMDb\s*$/i, '').trim()
  return { title }
}

// Strip a known site suffix from the <title> tag when og:title is absent.
function stripTitleSuffix(html: string, suffix: RegExp): string | null {
  const rawTitle = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? ''
  if (!rawTitle) return null
  const title = rawTitle.replace(suffix, '').trim()
  return title || null
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

  const spotifyResult = await handleSpotify(url)
  if (spotifyResult) return spotifyResult

  const imdbResult = await handleImdb(url)
  if (imdbResult) return imdbResult

  const hostname = new URL(url).hostname

  try {
    const ctrl = new AbortController()
    const timeout = setTimeout(() => ctrl.abort(), 5000)

    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: BROWSER_HEADERS,
      // Don't follow redirects — validation only ran on the original URL, so a
      // 302 to an internal address (e.g. 169.254.169.254) would bypass it.
      redirect: 'manual',
    })
    clearTimeout(timeout)

    if ((res.status >= 300 && res.status < 400) || res.type === 'opaqueredirect') {
      return NextResponse.json({ title: '', description: '', image_url: null, url })
    }

    const html = await res.text()

    const ogTitle = getMeta(html, 'og:title')
    const ogDescription = getMeta(html, 'og:description')
    const ogImage = normalizeImageUrl(getMeta(html, 'og:image'))

    // Site-specific fallbacks — only applied when OG tags are missing
    const isAmazon = /\bamazon\.[a-z.]{2,6}$/.test(hostname)
    const isImdb = hostname.includes('imdb.com')
    const isGoodreads = hostname.includes('goodreads.com')
    const isYelp = hostname.includes('yelp.com')
    const isTripAdvisor = hostname.includes('tripadvisor.')

    if (isAmazon && !ogTitle) {
      const extracted = extractAmazon(html, url)
      if (extracted) {
        return NextResponse.json({
          title: extracted.title,
          description: ogDescription ?? '',
          image_url: extracted.image_url,
          url,
        })
      }
    }

    if (isImdb && !ogTitle) {
      const extracted = extractImdbFallback(html)
      if (extracted) {
        return NextResponse.json({
          title: extracted.title,
          description: ogDescription ?? '',
          image_url: ogImage,
          url,
        })
      }
    }

    if (isGoodreads && !ogTitle) {
      const title = stripTitleSuffix(html, /\s*[|]\s*Goodreads\s*$/i)
      if (title) {
        return NextResponse.json({ title, description: ogDescription ?? '', image_url: ogImage, url })
      }
    }

    if (isYelp && !ogTitle) {
      const title = stripTitleSuffix(html, /\s*[-–]\s*Yelp\s*$/i)
      if (title) {
        return NextResponse.json({ title, description: ogDescription ?? '', image_url: ogImage, url })
      }
    }

    if (isTripAdvisor && !ogTitle) {
      const title = stripTitleSuffix(html, /\s*[-–]\s*Tripadvisor\s*$/i)
      if (title) {
        return NextResponse.json({ title, description: ogDescription ?? '', image_url: ogImage, url })
      }
    }

    const title =
      ogTitle ??
      html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ??
      ''

    return NextResponse.json({ title, description: ogDescription ?? '', image_url: ogImage, url })
  } catch {
    return NextResponse.json({ title: '', description: '', image_url: null, url })
  }
}
