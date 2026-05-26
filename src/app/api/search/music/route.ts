import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q) return NextResponse.json({ items: [] })

  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=10&country=US&lang=en`
    const res = await fetch(url)
    if (!res.ok) return NextResponse.json({ items: [] }, { status: 502 })

    const data = await res.json()
    const items = ((data.results ?? []) as Record<string, unknown>[]).map(r => ({
      id: String(r.trackId),
      title: (r.trackName as string) ?? 'Unknown Song',
      subtitle: (r.artistName as string) ?? undefined,
      image: ((r.artworkUrl100 as string) ?? '').replace('100x100', '600x600') || null,
      year: r.releaseDate ? String(r.releaseDate).slice(0, 4) : undefined,
      external_url: (r.trackViewUrl as string) ?? null,
    }))

    return NextResponse.json({ items }, {
      headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=600' },
    })
  } catch {
    return NextResponse.json({ items: [] }, { status: 502 })
  }
}
