import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 })

  try {
    const oembedUrl = `https://music.apple.com/oembed?url=${encodeURIComponent(url)}&format=json`
    const res = await fetch(oembedUrl, { cache: 'no-store' })

    if (!res.ok) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Notable] apple-music oEmbed non-ok', res.status, res.statusText)
      }
      return NextResponse.json({ error: 'oembed failed' }, { status: 502 })
    }

    const data = await res.json() as { html?: string; height?: number; type?: string }

    const srcMatch = data.html?.match(/src="([^"]+)"/)
    if (!srcMatch) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Notable] apple-music oEmbed: no src found in html field')
      }
      return NextResponse.json({ error: 'no src in oembed html' }, { status: 502 })
    }

    // Apple Music returns height as a top-level number in the oEmbed response
    const height = data.height ?? (url.includes('/album/') ? 450 : 175)
    return NextResponse.json({ embedUrl: srcMatch[1], height })
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[Notable] apple-music oEmbed fetch threw', err)
    }
    return NextResponse.json({ error: 'fetch failed' }, { status: 502 })
  }
}
