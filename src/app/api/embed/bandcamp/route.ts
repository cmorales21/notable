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
      `https://bandcamp.com/oembed?url=${encodeURIComponent(url)}&format=json`,
    )
    if (!res.ok) return NextResponse.json({ error: 'oembed failed' }, { status: 502 })

    const data = await res.json() as { html?: string; type?: string }
    const srcMatch = data.html?.match(/src="([^"]+)"/)
    if (!srcMatch) return NextResponse.json({ error: 'no src in oembed html' }, { status: 502 })

    // Extract height from iframe html if present; fall back by content type
    const heightMatch = data.html?.match(/height[=:]["'\s]*(\d+)/)
    const height = heightMatch ? parseInt(heightMatch[1], 10) : (data.type === 'rich' ? 350 : 120)
    return NextResponse.json({ embedUrl: srcMatch[1], height }, {
      headers: { 'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600' },
    })
  } catch {
    return NextResponse.json({ error: 'fetch failed' }, { status: 502 })
  }
}
