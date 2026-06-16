import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { hostMatchesDomain } from '@/lib/url'

const PROVIDER_DOMAIN = 'music.apple.com'
const EMBED_DOMAIN    = 'music.apple.com'  // covers embed.music.apple.com via subdomain match

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = req.nextUrl.searchParams.get('url')
  if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 })

  let parsed: URL
  try { parsed = new URL(url) } catch {
    return NextResponse.json({ error: 'invalid url' }, { status: 400 })
  }
  if (!hostMatchesDomain(parsed.hostname, PROVIDER_DOMAIN)) {
    return NextResponse.json({ error: 'invalid url' }, { status: 400 })
  }

  try {
    const oembedUrl = `https://music.apple.com/oembed?url=${encodeURIComponent(url)}&format=json`
    const res = await fetch(oembedUrl, { redirect: 'manual' })

    if ((res.status >= 300 && res.status < 400) || res.type === 'opaqueredirect') {
      return NextResponse.json({ error: 'oembed failed' }, { status: 502 })
    }
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

    // Re-validate the host the provider chose. If it isn't on the expected embed
    // domain, treat it as a "no embed" failure rather than handing the client an
    // unexpected URL.
    let embedParsed: URL
    try { embedParsed = new URL(srcMatch[1]) } catch {
      return NextResponse.json({ error: 'no src in oembed html' }, { status: 502 })
    }
    if (!hostMatchesDomain(embedParsed.hostname, EMBED_DOMAIN)) {
      return NextResponse.json({ error: 'no src in oembed html' }, { status: 502 })
    }

    // Apple Music returns height as a top-level number in the oEmbed response
    const height = data.height ?? (url.includes('/album/') ? 450 : 175)
    return NextResponse.json({ embedUrl: srcMatch[1], height }, {
      headers: { 'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600' },
    })
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[Notable] apple-music oEmbed fetch threw', err)
    }
    return NextResponse.json({ error: 'fetch failed' }, { status: 502 })
  }
}
