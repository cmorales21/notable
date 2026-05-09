import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q) return NextResponse.json({ items: [] })

  const type = req.nextUrl.searchParams.get('type') === 'episode' ? 'episode' : 'show'
  const entity = type === 'episode' ? 'podcastEpisode' : 'podcast'

  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=podcast&entity=${entity}&limit=8`
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return NextResponse.json({ items: [] }, { status: 502 })

    const data = await res.json() as { results?: Record<string, unknown>[] }
    const items = (data.results ?? []).map(r => {
      if (type === 'episode') {
        return {
          id: String(r.trackId ?? r.collectionId),
          title: (r.trackName as string) ?? (r.collectionName as string) ?? 'Unknown Episode',
          subtitle: (r.collectionName as string) ?? undefined,
          image: ((r.artworkUrl600 as string) ?? (r.artworkUrl160 as string) ?? (r.artworkUrl100 as string) ?? '') || null,
          year: r.releaseDate ? String(r.releaseDate).slice(0, 4) : undefined,
          external_url: (r.trackViewUrl as string) ?? null,
        }
      }
      return {
        id: String(r.collectionId),
        title: (r.collectionName as string) ?? 'Unknown Show',
        subtitle: (r.artistName as string) ?? undefined,
        image: ((r.artworkUrl600 as string) ?? (r.artworkUrl160 as string) ?? (r.artworkUrl100 as string) ?? '') || null,
        year: undefined,
        external_url: (r.collectionViewUrl as string) ?? null,
      }
    })

    return NextResponse.json({ items })
  } catch {
    return NextResponse.json({ items: [] }, { status: 502 })
  }
}
