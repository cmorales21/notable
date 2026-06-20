'use client'

import { useState, useEffect, useRef } from 'react'

export type EmbedContext = 'feed' | 'profile'

type Platform = 'spotify' | 'youtube' | 'apple-music' | 'maps' | 'vimeo' | 'soundcloud' | 'bandcamp'
type AsyncPlatform = 'apple-music' | 'soundcloud' | 'bandcamp'


// ── Platform detection ─────────────────────────────────────────────────────

// Parse hostname once; reject anything that isn't a valid http/https URL.
function parseHostname(url: string): string | null {
  try {
    const { protocol, hostname } = new URL(url)
    return protocol === 'http:' || protocol === 'https:' ? hostname : null
  } catch {
    return null
  }
}

function detectPlatform(url: string, category: string): Platform | null {
  const host = parseHostname(url)
  if (!host) return null
  if (host === 'open.spotify.com' && category === 'music') return 'spotify'
  if ((host === 'www.youtube.com' || host === 'youtube.com' || host === 'youtu.be') &&
    (category === 'movies' || category === 'music')) return 'youtube'
  if (host === 'music.apple.com' && category === 'music') return 'apple-music'
  if ((host === 'www.google.com' || host === 'maps.google.com' ||
    host === 'maps.app.goo.gl') && category === 'restaurants') return 'maps'
  if ((host === 'vimeo.com' || host === 'www.vimeo.com') &&
    (category === 'movies' || category === 'music')) return 'vimeo'
  if ((host === 'soundcloud.com' || host === 'www.soundcloud.com' ||
    host === 'w.soundcloud.com') && category === 'music') return 'soundcloud'
  if (host.endsWith('.bandcamp.com') && category === 'music') return 'bandcamp'
  return null
}

/** Returns true when this url+category combination will render an embed (not a static image). */
export function willEmbed(
  url: string | null | undefined,
  category: string,
  context: EmbedContext,
): boolean {
  if (context === 'profile' || !url) return false
  const platform = detectPlatform(url, category)
  if (!platform) return false
  if (platform === 'maps' && !process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) return false
  return true
}

// ── URL builders ───────────────────────────────────────────────────────────

function buildSpotifyEmbedUrl(url: string): string | null {
  const withoutQuery = url.split('?')[0]
  const match = withoutQuery.match(/open\.spotify\.com\/(playlist|album|track|artist|episode|show)\/([^/?]+)/)
  if (!match) return null
  return `https://open.spotify.com/embed/${match[1]}/${match[2]}?utm_source=generator`
}

function buildYouTubeEmbedUrl(url: string): string | null {
  try {
    if (url.includes('youtu.be/')) {
      const id = url.split('youtu.be/')[1]?.split(/[?#]/)[0]
      return id ? `https://www.youtube.com/embed/${id}` : null
    }
    const u = new URL(url)
    const id = u.searchParams.get('v')
    return id ? `https://www.youtube.com/embed/${id}` : null
  } catch { return null }
}

function buildVimeoEmbedUrl(url: string): string | null {
  const match = url.match(/vimeo\.com\/(\d+)/)
  return match ? `https://player.vimeo.com/video/${match[1]}` : null
}

// ── Shared iframe base style ───────────────────────────────────────────────

const BASE: React.CSSProperties = {
  display: 'block',
  border: 'none',
  borderRadius: '12px',
  marginTop: '12px',
  marginBottom: '4px',
  width: '100%',
}

// ── Async embed component (Apple Music / SoundCloud / Bandcamp) ────────────

function AsyncEmbed({ url, platform, onFail }: { url: string; platform: AsyncPlatform; onFail?: () => void }) {
  const [embedUrl, setEmbedUrl] = useState<string | null>(null)
  const [height, setHeight] = useState(200)
  // Keep a stable ref so the effect never needs onFail in its dependency array
  const onFailRef = useRef(onFail)
  onFailRef.current = onFail

  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/embed/${platform}?url=${encodeURIComponent(url)}`, { signal: controller.signal })
      .then(r => r.json())
      .then((data: { embedUrl?: string; height?: number }) => {
        if (data.embedUrl) {
          setEmbedUrl(data.embedUrl)
          if (data.height) setHeight(data.height)
        } else {
          onFailRef.current?.()
        }
      })
      .catch((err: Error) => {
        if (err.name !== 'AbortError') onFailRef.current?.()
      })
    return () => controller.abort()
  }, [url, platform])

  if (!embedUrl) return null

  if (platform === 'apple-music') {
    return (
      <iframe
        src={embedUrl}
        style={{ ...BASE, height, overflow: 'hidden', background: 'transparent' }}
        allow="autoplay *; encrypted-media *; fullscreen *"
        sandbox="allow-scripts allow-same-origin allow-popups"
        loading="lazy"
      />
    )
  }
  if (platform === 'soundcloud') {
    return (
      <iframe
        src={embedUrl}
        style={{ ...BASE, height }}
        allow="autoplay"
        sandbox="allow-scripts allow-same-origin allow-popups"
        loading="lazy"
      />
    )
  }
  // bandcamp
  return (
    <iframe
      src={embedUrl}
      style={{ ...BASE, height }}
      sandbox="allow-scripts allow-same-origin allow-popups"
      loading="lazy"
    />
  )
}

// ── RichMediaEmbed ─────────────────────────────────────────────────────────

export function RichMediaEmbed({
  external_url,
  category,
  context,
  title,
  onEmbedFail,
}: {
  external_url: string
  category: string
  context: EmbedContext
  title?: string
  onEmbedFail?: () => void
}) {
  const platform = context === 'profile' ? null : detectPlatform(external_url, category)

  // Build sync embed URLs up front so we can signal failure to the parent if
  // the URL doesn't match the expected pattern (e.g. a Spotify path verb we
  // don't recognize). Without this, the iframe silently renders nothing and
  // the parent's image_url fallback stays suppressed.
  const spotifyUrl = platform === 'spotify' ? buildSpotifyEmbedUrl(external_url) : null
  const youtubeUrl = platform === 'youtube' ? buildYouTubeEmbedUrl(external_url) : null
  const vimeoUrl = platform === 'vimeo' ? buildVimeoEmbedUrl(external_url) : null

  const syncBuildFailed =
    (platform === 'spotify' && !spotifyUrl) ||
    (platform === 'youtube' && !youtubeUrl) ||
    (platform === 'vimeo' && !vimeoUrl)

  const onFailRef = useRef(onEmbedFail)
  onFailRef.current = onEmbedFail
  useEffect(() => {
    if (syncBuildFailed) onFailRef.current?.()
  }, [syncBuildFailed])

  if (context === 'profile' || !platform) return null

  if (platform === 'spotify') {
    if (!spotifyUrl) return null
    const height = external_url.includes('/track/') ? 152 : 352
    return (
      <iframe
        src={spotifyUrl}
        style={{ ...BASE, height }}
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
      />
    )
  }

  if (platform === 'youtube') {
    if (!youtubeUrl) return null
    return (
      <iframe
        src={youtubeUrl}
        style={{ ...BASE, height: 280 }}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        sandbox="allow-scripts allow-same-origin allow-popups"
        allowFullScreen
        loading="lazy"
      />
    )
  }

  if (platform === 'vimeo') {
    if (!vimeoUrl) return null
    return (
      <iframe
        src={vimeoUrl}
        style={{ ...BASE, height: 280 }}
        allow="autoplay; fullscreen; picture-in-picture"
        sandbox="allow-scripts allow-same-origin allow-popups"
        allowFullScreen
        loading="lazy"
      />
    )
  }

  if (platform === 'maps') {
    const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!mapsKey) return null
    // Use the recommendation title as the place query — more reliable than parsing raw coordinates
    const query = encodeURIComponent(title ?? external_url)
    return (
      <iframe
        src={`https://www.google.com/maps/embed/v1/place?key=${mapsKey}&q=${query}`}
        style={{ ...BASE, height: 300, border: '0' }}
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    )
  }

  // w.soundcloud.com player URLs can be rendered directly — no oEmbed call needed
  if (platform === 'soundcloud' && parseHostname(external_url) === 'w.soundcloud.com') {
    const scHeight = external_url.includes('playlists') ? 350 : 166
    return (
      <iframe
        src={external_url}
        style={{ ...BASE, height: scHeight }}
        allow="autoplay"
        sandbox="allow-scripts allow-same-origin allow-popups"
        loading="lazy"
      />
    )
  }

  return <AsyncEmbed url={external_url} platform={platform as AsyncPlatform} onFail={onEmbedFail} />
}
