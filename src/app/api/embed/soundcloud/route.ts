import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { hostMatchesDomain } from '@/lib/url'

const PROVIDER_DOMAIN = 'soundcloud.com'
const EMBED_DOMAIN    = 'soundcloud.com'  // covers w.soundcloud.com via subdomain match

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
    const res = await fetch(
      `https://soundcloud.com/oembed?url=${encodeURIComponent(url)}&format=json`,
      { redirect: 'manual' },
    )

    if ((res.status >= 300 && res.status < 400) || res.type === 'opaqueredirect') {
      return NextResponse.json({ error: 'oembed failed' }, { status: 502 })
    }
    if (!res.ok) return NextResponse.json({ error: 'oembed failed' }, { status: 502 })

    const data = await res.json() as { html?: string }
    const srcMatch = data.html?.match(/src="([^"]+)"/)
    if (!srcMatch) return NextResponse.json({ error: 'no src in oembed html' }, { status: 502 })

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

    // /sets/ paths are playlists/albums; everything else is a single track
    const height = url.includes('/sets/') ? 350 : 166
    return NextResponse.json({ embedUrl: srcMatch[1], height }, {
      headers: { 'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600' },
    })
  } catch {
    return NextResponse.json({ error: 'fetch failed' }, { status: 502 })
  }
}
