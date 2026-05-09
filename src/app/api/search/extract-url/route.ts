import { NextRequest, NextResponse } from 'next/server'

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
  let url: string
  try {
    const body = await req.json()
    url = body.url
    if (!url || typeof url !== 'string') throw new Error()
  } catch {
    return NextResponse.json({ error: 'URL required' }, { status: 400 })
  }

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
