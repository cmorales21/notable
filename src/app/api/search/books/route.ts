import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q) return NextResponse.json({ items: [] })

  try {
    const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=8&fields=key,title,author_name,cover_i`
    const res = await fetch(url)
    if (!res.ok) return NextResponse.json({ items: [] }, { status: 502 })

    const data = await res.json() as { docs?: Record<string, unknown>[] }
    const items = (data.docs ?? [])
      .filter(doc => doc.cover_i != null)
      .slice(0, 8)
      .map(doc => ({
        id: String(doc.key),
        title: (doc.title as string) ?? 'Unknown Title',
        subtitle: ((doc.author_name as string[]) ?? [])[0] ?? undefined,
        image: `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`,
        external_url: `https://openlibrary.org${doc.key}`,
      }))

    return NextResponse.json({ items }, {
      headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=600' },
    })
  } catch {
    return NextResponse.json({ items: [] }, { status: 502 })
  }
}
