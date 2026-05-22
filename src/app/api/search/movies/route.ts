import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q) return NextResponse.json({ items: [] })

  const apiKey = process.env.TMDB_API_KEY
  if (!apiKey) return NextResponse.json({ items: [] }, { status: 500 })

  const headers = { Authorization: `Bearer ${apiKey}` }

  try {
    const [movieRes, tvRes] = await Promise.all([
      fetch(`https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(q)}&page=1`, { headers }),
      fetch(`https://api.themoviedb.org/3/search/tv?query=${encodeURIComponent(q)}&page=1`, { headers }),
    ])

    const [movieData, tvData] = await Promise.all([
      movieRes.ok ? movieRes.json() as Promise<{ results?: Record<string, unknown>[] }> : Promise.resolve({ results: [] }),
      tvRes.ok   ? tvRes.json()   as Promise<{ results?: Record<string, unknown>[] }> : Promise.resolve({ results: [] }),
    ])

    const movies = (movieData.results ?? [])
      .filter(m => m.poster_path)
      .map(m => ({
        id: `movie-${m.id}`,
        title: (m.title as string) ?? 'Unknown Film',
        subtitle: `Film${m.release_date ? ` · ${String(m.release_date).slice(0, 4)}` : ''}`,
        image: `https://image.tmdb.org/t/p/w500${m.poster_path}`,
        external_url: `https://www.themoviedb.org/movie/${m.id}`,
      }))

    const shows = (tvData.results ?? [])
      .filter(t => t.poster_path)
      .map(t => ({
        id: `tv-${t.id}`,
        title: (t.name as string) ?? 'Unknown Series',
        subtitle: `Series${t.first_air_date ? ` · ${String(t.first_air_date).slice(0, 4)}` : ''}`,
        image: `https://image.tmdb.org/t/p/w500${t.poster_path}`,
        external_url: `https://www.themoviedb.org/tv/${t.id}`,
      }))

    // Interleave movies and TV results
    const interleaved: typeof movies = []
    const len = Math.max(movies.length, shows.length)
    for (let i = 0; i < len && interleaved.length < 8; i++) {
      if (i < movies.length && interleaved.length < 8) interleaved.push(movies[i])
      if (i < shows.length  && interleaved.length < 8) interleaved.push(shows[i])
    }

    return NextResponse.json({ items: interleaved }, {
      headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=600' },
    })
  } catch {
    return NextResponse.json({ items: [] }, { status: 502 })
  }
}
