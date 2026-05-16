import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { theme } from '@/app/lib/theme'

// ─── Local constants (avoid importing client modules) ─────────────────────────

const CAT: Record<string, { label: string; color: string; href: string; iconPad: string }> = {
  books:       { label: 'Books',       color: '#5271FF', href: '/books',       iconPad: '12px' },
  movies:      { label: 'Movies & TV', color: '#dc4f5c', href: '/movies',      iconPad: '16px' },
  music:       { label: 'Music',       color: '#4aad4e', href: '/music',       iconPad: '14px' },
  restaurants: { label: 'Restaurants', color: '#9055d0', href: '/restaurants', iconPad: '12px' },
  podcasts:    { label: 'Podcasts',    color: '#d4920a', href: '/podcasts',    iconPad: '12px' },
}

function relativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diffMs / 60000)
  const hrs = Math.floor(mins / 60)
  const days = Math.floor(hrs / 24)
  if (days > 0) return `${days}d ago`
  if (hrs > 0) return `${hrs}h ago`
  if (mins > 0) return `${mins}m ago`
  return 'just now'
}

function externalLinkLabel(url: string): string {
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'Watch on YouTube →'
  if (url.includes('spotify.com')) return 'Listen on Spotify →'
  if (url.includes('apple.com')) return 'Open on Apple →'
  if (url.includes('imdb.com')) return 'View on IMDb →'
  if (url.includes('themoviedb.org')) return 'View on TMDB →'
  if (url.includes('openlibrary.org')) return 'Open on Open Library →'
  if (url.includes('goodreads.com')) return 'View on Goodreads →'
  if (url.includes('maps.google.com') || url.includes('google.com/maps')) return 'Open in Google Maps →'
  if (url.includes('yelp.com')) return 'View on Yelp →'
  try { return `View on ${new URL(url).hostname.replace(/^www\./, '')} →` }
  catch { return 'View source →' }
}

// ─── Data helpers ─────────────────────────────────────────────────────────────

async function fetchRec(id: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('recommendations')
    .select('id, user_id, category, title, description, image_url, external_url, created_at, profiles(name, handle, avatar_url)')
    .eq('id', id)
    .maybeSingle()
  return data
}

// ─── generateMetadata ─────────────────────────────────────────────────────────

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params
  const rec = await fetchRec(id)
  if (!rec) return { title: 'Notable' }

  const profile = Array.isArray(rec.profiles) ? rec.profiles[0] : rec.profiles
  const title = `${rec.title} — Notable`
  const description = rec.description
    ? rec.description.slice(0, 150)
    : `Recommended by ${profile?.name ?? 'someone'} on Notable`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      ...(rec.image_url ? { images: [rec.image_url] } : {}),
      type: 'article',
      siteName: 'Notable',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(rec.image_url ? { images: [rec.image_url] } : {}),
    },
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function RecPage(
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: rec } = await supabase
    .from('recommendations')
    .select('id, user_id, category, title, description, image_url, external_url, created_at, profiles(name, handle, avatar_url)')
    .eq('id', id)
    .maybeSingle()

  if (!rec) {
    return (
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
        <p className="font-display" style={{ fontSize: '22px', fontWeight: 600, color: theme.colors.textPrimary, marginBottom: '12px' }}>
          Recommendation not found
        </p>
        <p className="font-body" style={{ color: theme.colors.textMuted, fontSize: '15px', marginBottom: '28px' }}>
          This recommendation may have been removed or the link is invalid.
        </p>
        <Link
          href="/lobby"
          className="font-body"
          style={{
            display: 'inline-block', padding: '10px 24px',
            background: theme.colors.textPrimary, color: '#f5f0e8',
            borderRadius: '999px', fontSize: '14px', fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          Go to lobby
        </Link>
      </div>
    )
  }

  const profile = Array.isArray(rec.profiles) ? rec.profiles[0] : rec.profiles
  const cat = CAT[rec.category] ?? { label: rec.category, color: theme.colors.textMuted, href: '/lobby', iconPad: '12px' }

  const [
    { count: likeCount },
    { count: bookmarkCount },
    { data: commentsRaw },
  ] = await Promise.all([
    supabase.from('likes').select('*', { count: 'exact', head: true }).eq('recommendation_id', id),
    supabase.from('bookmarks').select('*', { count: 'exact', head: true }).eq('recommendation_id', id),
    supabase
      .from('comments')
      .select('id, user_id, text, created_at, profiles(name, handle, avatar_url), comment_likes(id)')
      .eq('recommendation_id', id)
      .order('created_at', { ascending: true }),
  ])

  const comments = commentsRaw ?? []
  const commentCount = comments.length

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '0 24px 80px' }}>

      {/* ── Back link ─────────────────────────────────────────────────── */}
      <div style={{ paddingTop: '20px', marginBottom: '24px' }}>
        <Link
          href={cat.href}
          className="font-body"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            color: theme.colors.textMuted, fontSize: '14px', textDecoration: 'none',
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          Back to {cat.label}
        </Link>
      </div>

      {/* ── Cover image ───────────────────────────────────────────────── */}
      {rec.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={rec.image_url}
          alt={rec.title}
          style={{
            width: '100%', maxHeight: '400px', objectFit: 'cover',
            borderRadius: '14px', display: 'block', marginBottom: '24px',
            background: theme.colors.input,
          }}
        />
      )}

      {/* ── Category badge ────────────────────────────────────────────── */}
      <div style={{ marginBottom: '14px' }}>
        <Link
          href={cat.href}
          className="font-body"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            background: cat.color, color: '#ffffff',
            borderRadius: '999px', padding: '4px 12px 4px 8px',
            fontSize: '12px', fontWeight: 600, textDecoration: 'none',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/icons/${rec.category}-small.svg`}
            alt=""
            style={{ width: 14, height: 14, filter: 'brightness(0) invert(1)', opacity: 0.9 }}
          />
          {cat.label}
        </Link>
      </div>

      {/* ── Title ─────────────────────────────────────────────────────── */}
      <h1
        className="font-display"
        style={{
          fontSize: 'clamp(1.6rem, 4vw, 2rem)', fontWeight: 700,
          color: theme.colors.textPrimary, letterSpacing: '-0.025em',
          lineHeight: 1.2, marginBottom: '16px',
        }}
      >
        {rec.title}
      </h1>

      {/* ── Recommender row ───────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
        {profile?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatar_url}
            alt={profile.name ?? ''}
            style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
          />
        ) : (
          <div style={{
            width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
            background: theme.colors.avatarFallback, border: '1px solid rgba(0,0,0,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, color: theme.colors.textPrimary, fontWeight: 500,
          }}>
            {profile?.name ? profile.name.charAt(0).toUpperCase() : '?'}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          {profile?.handle ? (
            <Link
              href={`/profile/${profile.handle}`}
              className="font-body"
              style={{ color: theme.colors.textPrimary, fontSize: '15px', fontWeight: 500, textDecoration: 'none' }}
            >
              {profile.name ?? profile.handle}
            </Link>
          ) : (
            <span className="font-body" style={{ color: theme.colors.textPrimary, fontSize: '15px', fontWeight: 500 }}>
              {profile?.name ?? 'Unknown'}
            </span>
          )}
          <span className="font-body" style={{ color: theme.colors.textMuted, fontSize: '13px' }}>
            {profile?.handle ? `  ·  @${profile.handle}` : ''}
            {`  ·  ${relativeTime(rec.created_at)}`}
          </span>
        </div>
      </div>

      {/* ── Description ───────────────────────────────────────────────── */}
      {rec.description && (
        <p
          className="font-body"
          style={{
            fontSize: '16px', color: theme.colors.textPrimary,
            lineHeight: '1.7', marginBottom: '20px',
            whiteSpace: 'pre-wrap',
          }}
        >
          {rec.description}
        </p>
      )}

      {/* ── External link ─────────────────────────────────────────────── */}
      {rec.external_url && (
        <div style={{ marginBottom: '24px' }}>
          <a
            href={rec.external_url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-body"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              color: cat.color, fontSize: '14px', fontWeight: 500,
              textDecoration: 'none', padding: '8px 16px',
              background: `${cat.color}14`, borderRadius: '999px',
              border: `1px solid ${cat.color}30`,
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            {externalLinkLabel(rec.external_url)}
          </a>
        </div>
      )}

      {/* ── Stats bar ─────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex', gap: '20px', alignItems: 'center',
          padding: '14px 0',
          borderTop: `1px solid ${theme.colors.border}`,
          borderBottom: `1px solid ${theme.colors.border}`,
          marginBottom: '32px',
        }}
      >
        {/* Likes */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke={theme.colors.textMuted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
          </svg>
          <span className="font-body" style={{ fontSize: '14px', color: theme.colors.textMuted }}>
            {(likeCount ?? 0) > 0 ? `${likeCount} ${likeCount === 1 ? 'like' : 'likes'}` : 'No likes yet'}
          </span>
        </div>

        {/* Bookmarks */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke={theme.colors.textMuted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 3h14a1 1 0 011 1v17l-8-4-8 4V4a1 1 0 011-1z" />
          </svg>
          <span className="font-body" style={{ fontSize: '14px', color: theme.colors.textMuted }}>
            {(bookmarkCount ?? 0) > 0 ? `${bookmarkCount} saved` : 'No saves yet'}
          </span>
        </div>

        {/* Comments */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke={theme.colors.textMuted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          <span className="font-body" style={{ fontSize: '14px', color: theme.colors.textMuted }}>
            {commentCount > 0 ? `${commentCount} ${commentCount === 1 ? 'comment' : 'comments'}` : 'No comments yet'}
          </span>
        </div>
      </div>

      {/* ── Comments ──────────────────────────────────────────────────── */}
      {comments.length > 0 && (
        <div>
          <h2
            className="font-display"
            style={{
              fontSize: '16px', fontWeight: 600, color: theme.colors.textPrimary,
              letterSpacing: '-0.01em', marginBottom: '20px',
            }}
          >
            {commentCount === 1 ? '1 comment' : `${commentCount} comments`}
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {comments.map((comment) => {
              const cp = Array.isArray(comment.profiles) ? comment.profiles[0] : comment.profiles
              const likeCount = Array.isArray(comment.comment_likes) ? comment.comment_likes.length : 0
              return (
                <div key={comment.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  {/* Avatar */}
                  {cp?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={cp.avatar_url}
                      alt={cp.name ?? ''}
                      style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, marginTop: '1px' }}
                    />
                  ) : (
                    <div style={{
                      width: 30, height: 30, borderRadius: '50%', flexShrink: 0, marginTop: '1px',
                      background: theme.colors.avatarFallback,
                      border: '1px solid rgba(0,0,0,0.08)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, color: theme.colors.textPrimary, fontWeight: 500,
                    }}>
                      {cp?.name ? cp.name.charAt(0).toUpperCase() : '?'}
                    </div>
                  )}

                  {/* Comment body */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '3px', flexWrap: 'wrap' }}>
                      {cp?.handle ? (
                        <Link
                          href={`/profile/${cp.handle}`}
                          className="font-body"
                          style={{ color: theme.colors.textPrimary, fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}
                        >
                          {cp.name ?? cp.handle}
                        </Link>
                      ) : (
                        <span className="font-body" style={{ color: theme.colors.textPrimary, fontSize: '13px', fontWeight: 600 }}>
                          {cp?.name ?? 'Unknown'}
                        </span>
                      )}
                      {cp?.handle && (
                        <span className="font-body" style={{ color: theme.colors.textMuted, fontSize: '12px' }}>
                          @{cp.handle}
                        </span>
                      )}
                      <span className="font-body" style={{ color: theme.colors.textMuted, fontSize: '12px' }}>
                        · {relativeTime(comment.created_at)}
                      </span>
                      {likeCount > 0 && (
                        <span className="font-body" style={{ color: theme.colors.textMuted, fontSize: '12px', marginLeft: 'auto' }}>
                          ❤️ {likeCount}
                        </span>
                      )}
                    </div>
                    <p className="font-body" style={{ color: theme.colors.textPrimary, fontSize: '14px', lineHeight: '1.55', margin: 0 }}>
                      {comment.text}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
