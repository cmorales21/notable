import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = req.nextUrl.searchParams.get('url')
  if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 })

  try {
    const res = await fetch(
      `https://soundcloud.com/oembed?url=${encodeURIComponent(url)}&format=json`,
    )
    if (!res.ok) return NextResponse.json({ error: 'oembed failed' }, { status: 502 })

    const data = await res.json() as { html?: string }
    const srcMatch = data.html?.match(/src="([^"]+)"/)
    if (!srcMatch) return NextResponse.json({ error: 'no src in oembed html' }, { status: 502 })

    // /sets/ paths are playlists/albums; everything else is a single track
    const height = url.includes('/sets/') ? 350 : 166
    return NextResponse.json({ embedUrl: srcMatch[1], height }, {
      headers: { 'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600' },
    })
  } catch {
    return NextResponse.json({ error: 'fetch failed' }, { status: 502 })
  }
}
