import type { Metadata } from 'next'
import { cache, type CSSProperties } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { RecommendationImage } from '@/app/components/RecommendationImage'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { theme, CATEGORY_COLORS, CATEGORY_LABELS } from '@/app/lib/theme'
import { ShareButton } from './ShareButton'
import { safeExternalHref } from '@/lib/url'
import { formatRelativeTime } from '@/lib/relativeTime'

// ─── Category config ──────────────────────────────────────────────────────────

const CAT: Record<string, { label: string; color: string; href: string }> = {
  books:       { label: CATEGORY_LABELS.books,       color: CATEGORY_COLORS.books,       href: '/books'       },
  movies:      { label: CATEGORY_LABELS.movies,      color: CATEGORY_COLORS.movies,      href: '/movies'      },
  music:       { label: CATEGORY_LABELS.music,       color: CATEGORY_COLORS.music,       href: '/music'       },
  restaurants: { label: CATEGORY_LABELS.restaurants, color: CATEGORY_COLORS.restaurants, href: '/restaurants' },
  podcasts:    { label: CATEGORY_LABELS.podcasts,    color: CATEGORY_COLORS.podcasts,    href: '/podcasts'    },
}

function externalLinkLabel(url: string): string {
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'Watch on YouTube →'
  if (url.includes('spotify.com'))                              return 'Listen on Spotify →'
  if (url.includes('apple.com'))                               return 'Open on Apple →'
  if (url.includes('imdb.com'))                                return 'View on IMDb →'
  if (url.includes('themoviedb.org'))                          return 'View on TMDB →'
  if (url.includes('openlibrary.org'))                         return 'Open on Open Library →'
  if (url.includes('goodreads.com'))                           return 'View on Goodreads →'
  if (url.includes('maps.google.com') || url.includes('google.com/maps')) return 'Open in Google Maps →'
  if (url.includes('yelp.com'))                                return 'View on Yelp →'
  try { return `View on ${new URL(url).hostname.replace(/^www\./, '')} →` }
  catch { return 'View source →' }
}

// ─── Data helpers ─────────────────────────────────────────────────────────────

const fetchRec = cache(async (id: string) => {
  const db = createAdminClient() ?? await createClient()
  const { data: rec } = await db
    .from('recommendations')
    .select('id, user_id, category, title, description, image_url, external_url, created_at')
    .eq('id', id)
    .maybeSingle()
  if (!rec) return null
  const { data: profile } = await db
    .from('profiles')
    .select('name, handle, avatar_url, profile_private')
    .eq('id', rec.user_id)
    .maybeSingle()
  return { ...rec, profiles: profile }
})

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
      title, description,
      type: 'article',
      siteName: 'Notable',
    },
    twitter: {
      card: 'summary_large_image',
      title, description,
    },
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function RecPage(
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = createAdminClient() ?? await createClient()

  const recData = await fetchRec(id)

  if (!recData) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
        <div style={{ textAlign: 'center', maxWidth: '360px' }}>
          <p className="font-display" style={{ fontSize: '22px', fontWeight: 600, color: theme.colors.textPrimary, marginBottom: '10px' }}>
            Recommendation not found
          </p>
          <p className="font-body" style={{ color: theme.colors.textMuted, fontSize: '15px', marginBottom: '28px', lineHeight: '1.55' }}>
            This recommendation may have been removed or the link is invalid.
          </p>
          <Link
            href="/lobby"
            className="font-body"
            style={{
              display: 'inline-block', padding: '10px 24px',
              background: theme.colors.textPrimary, color: '#f5f0e8',
              borderRadius: theme.radii.pill, fontSize: '14px', fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Go to lobby
          </Link>
        </div>
      </div>
    )
  }

  const recRow = recData
  const recProfile = Array.isArray(recData.profiles) ? recData.profiles[0] : recData.profiles

  // Privacy gate: if the recommender's profile is private, only followers may view
  if (recProfile?.profile_private) {
    const serverClient = await createClient()
    const { data: { user } } = await serverClient.auth.getUser()

    if (!user) {
      return (
        <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
          <div style={{ textAlign: 'center', maxWidth: '360px' }}>
            <p className="font-display" style={{ fontSize: '22px', fontWeight: 600, color: theme.colors.textPrimary, marginBottom: '10px' }}>
              Private profile
            </p>
            <p className="font-body" style={{ color: theme.colors.textMuted, fontSize: '15px', marginBottom: '28px', lineHeight: '1.55' }}>
              This recommendation is from a private profile. Sign in and follow this person to view it.
            </p>
            <Link
              href="/login"
              className="font-body"
              style={{
                display: 'inline-block', padding: '10px 24px',
                background: theme.colors.textPrimary, color: '#f5f0e8',
                borderRadius: theme.radii.pill, fontSize: '14px', fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Sign in
            </Link>
          </div>
        </div>
      )
    }

    const { data: followRow } = await db
      .from('follows')
      .select('id')
      .eq('follower_id', user.id)
      .eq('following_id', recRow.user_id)
      .eq('status', 'accepted')
      .maybeSingle()

    if (!followRow) {
      return (
        <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
          <div style={{ textAlign: 'center', maxWidth: '360px' }}>
            <p className="font-display" style={{ fontSize: '22px', fontWeight: 600, color: theme.colors.textPrimary, marginBottom: '10px' }}>
              Private profile
            </p>
            <p className="font-body" style={{ color: theme.colors.textMuted, fontSize: '15px', lineHeight: '1.55' }}>
              This recommendation is from a private profile. Follow this person to view their recommendations.
            </p>
          </div>
        </div>
      )
    }
  }

  const [
    { count: likeCount },
    { count: bookmarkCount },
    { data: commentsRaw },
  ] = await Promise.all([
    db.from('likes').select('*', { count: 'exact', head: true }).eq('recommendation_id', id),
    db.from('bookmarks').select('*', { count: 'exact', head: true }).eq('recommendation_id', id),
    db
      .from('comments')
      .select('id, user_id, text, created_at, comment_likes(id)')
      .eq('recommendation_id', id)
      .order('created_at', { ascending: true }),
  ])

  const rec     = recData
  const profile = recProfile
  const cat     = CAT[rec.category] ?? { label: rec.category, color: theme.colors.textMuted, href: '/lobby' }

  // Fetch comment author profiles (no FK join available between recommendations and profiles)
  const commentUserIds = [...new Set((commentsRaw ?? []).map((c: { user_id: string }) => c.user_id))]
  const { data: commentProfilesRaw } = commentUserIds.length > 0
    ? await db.from('profiles').select('id, name, handle, avatar_url').in('id', commentUserIds)
    : { data: [] }
  const commentProfileMap: Record<string, { name: string | null; handle: string | null; avatar_url: string | null }> = {}
  for (const p of commentProfilesRaw ?? []) {
    commentProfileMap[p.id] = { name: p.name, handle: p.handle, avatar_url: p.avatar_url }
  }

  const comments     = commentsRaw ?? []
  const commentCount = comments.length
  const lc           = likeCount ?? 0
  const bc           = bookmarkCount ?? 0

  return (
    <div style={{ padding: '24px 20px 80px' }}>
      <div style={{ maxWidth: '680px', margin: '0 auto' }}>

        {/* ── Back link ──────────────────────────────────────────────── */}
        <div style={{ marginBottom: '16px' }}>
          <Link
            href={cat.href}
            className="font-body"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              color: theme.colors.textMuted, fontSize: '14px', textDecoration: 'none',
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
              strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            Back to {cat.label}
          </Link>
        </div>

        {/* ── Card ───────────────────────────────────────────────────── */}
        <div style={{
          background: theme.colors.surface,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: theme.radii.card,
          boxShadow: theme.shadows.card,
          overflow: 'hidden',
        }}>

          {/* Cover image or category-colored placeholder */}
          <div style={{ position: 'relative', width: '100%', height: rec.image_url ? '380px' : '200px' }}>
            <RecommendationImage fill src={rec.image_url} category={rec.category} alt={rec.title} sizes="(max-width: 768px) 100vw, 680px" style={{ objectFit: 'cover' }} />
          </div>

          {/* Card body */}
          <div style={{ padding: '20px 24px 28px' }}>

            {/* ── Category badge ─────────────────────────────────────── */}
            <div style={{ marginBottom: '14px' }}>
              <Link
                href={cat.href}
                className="font-body"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                  background: cat.color, color: '#ffffff',
                  borderRadius: theme.radii.pill, padding: '4px 10px 4px 8px',
                  fontSize: '12px', fontWeight: 600, textDecoration: 'none',
                }}
              >
                <Image
                  src={`/icons/${rec.category}-small.svg`}
                  alt=""
                  width={13}
                  height={13}
                  style={{ filter: 'brightness(0) invert(1)', opacity: 0.9 }}
                />
                {cat.label}
              </Link>
            </div>

            {/* ── Title ──────────────────────────────────────────────── */}
            <h1
              className="font-display"
              style={{
                fontSize: 'clamp(1.5rem, 4vw, 1.85rem)', fontWeight: 600,
                color: theme.colors.textPrimary, letterSpacing: '-0.02em',
                lineHeight: 1.25, marginBottom: '16px',
              }}
            >
              {rec.title}
            </h1>

            {/* ── Recommender row + share button ─────────────────────── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
              {profile?.avatar_url ? (
                <Image
                  src={profile.avatar_url}
                  alt={profile.name ?? ''}
                  width={36}
                  height={36}
                  style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                />
              ) : (
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                  background: theme.colors.avatarFallback,
                  border: `1px solid ${theme.colors.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, color: theme.colors.textPrimary, fontWeight: 500,
                  fontFamily: theme.fonts.body,
                }}>
                  {profile?.name ? profile.name.charAt(0).toUpperCase() : '?'}
                </div>
              )}

              <div style={{ flex: 1, minWidth: 0 }}>
                {profile?.handle ? (
                  <Link
                    href={`/profile/${profile.handle}`}
                    className="font-body"
                    style={{ color: theme.colors.textPrimary, fontSize: '15px', fontWeight: 500, textDecoration: 'none', display: 'block' }}
                  >
                    {profile.name ?? profile.handle}
                  </Link>
                ) : (
                  <span className="font-body" style={{ color: theme.colors.textPrimary, fontSize: '15px', fontWeight: 500, display: 'block' }}>
                    {profile?.name ?? 'Unknown'}
                  </span>
                )}
                <span className="font-body" style={{ color: theme.colors.textMuted, fontSize: '13px' }}>
                  {profile?.handle ? `@${profile.handle} · ` : ''}{formatRelativeTime(rec.created_at)}
                </span>
              </div>

              <ShareButton recId={id} />
            </div>

            {/* ── Description ────────────────────────────────────────── */}
            {rec.description && (
              <p
                className="font-body"
                style={{
                  fontSize: '15px', color: theme.colors.textPrimary,
                  lineHeight: '1.65', marginBottom: '20px',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {rec.description}
              </p>
            )}

            {/* ── External link ───────────────────────────────────────── */}
            {rec.external_url && (() => {
              const safeHref = safeExternalHref(rec.external_url)
              const pillStyle: CSSProperties = {
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                color: cat.color, fontSize: '13px', fontWeight: 500,
                textDecoration: 'none', padding: '7px 14px',
                background: `${cat.color}14`, borderRadius: theme.radii.pill,
                border: `1px solid ${cat.color}28`,
              }
              const pillBody = (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
                    strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                  {externalLinkLabel(rec.external_url!)}
                </>
              )
              return (
                <div style={{ marginBottom: '20px' }}>
                  {safeHref ? (
                    <a href={safeHref} target="_blank" rel="noopener noreferrer" className="font-body" style={pillStyle}>
                      {pillBody}
                    </a>
                  ) : (
                    <span className="font-body" style={pillStyle}>{pillBody}</span>
                  )}
                </div>
              )
            })()}

            {/* ── Action/stats row ────────────────────────────────────── */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: commentCount > 0 ? '28px' : '0' }}>
              <div
                className="font-body"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '8px 14px', borderRadius: theme.radii.pill,
                  background: theme.colors.input,
                  fontSize: '14px', fontWeight: 500, color: theme.colors.textMuted,
                }}
              >
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                </svg>
                {lc > 0 ? `${lc} ${lc === 1 ? 'like' : 'likes'}` : 'Like'}
              </div>

              <div
                className="font-body"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '8px 14px', borderRadius: theme.radii.pill,
                  background: theme.colors.input,
                  fontSize: '14px', fontWeight: 500, color: theme.colors.textMuted,
                }}
              >
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 3h14a1 1 0 011 1v17l-8-4-8 4V4a1 1 0 011-1z" />
                </svg>
                {bc > 0 ? `${bc} saved` : 'Save'}
              </div>

              <div
                className="font-body"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '8px 14px', borderRadius: theme.radii.pill,
                  background: theme.colors.input,
                  fontSize: '14px', fontWeight: 500, color: theme.colors.textMuted,
                }}
              >
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
                {commentCount > 0 ? commentCount : 'Comment'}
              </div>
            </div>

            {/* ── Comments ────────────────────────────────────────────── */}
            {comments.length > 0 && (
              <div>
                <div style={{ height: '1px', background: theme.colors.border, marginBottom: '24px' }} />

                <p
                  className="font-display"
                  style={{
                    fontSize: '15px', fontWeight: 600, color: theme.colors.textPrimary,
                    letterSpacing: '-0.01em', marginBottom: '20px',
                  }}
                >
                  {commentCount === 1 ? '1 comment' : `${commentCount} comments`}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  {comments.map((comment) => {
                    const cp     = commentProfileMap[comment.user_id] ?? null
                    const clikes = Array.isArray(comment.comment_likes) ? comment.comment_likes.length : 0
                    return (
                      <div key={comment.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>

                        {/* Avatar */}
                        {cp?.avatar_url ? (
                          <Image
                            src={cp.avatar_url}
                            alt={cp.name ?? ''}
                            width={28}
                            height={28}
                            style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0, marginTop: '1px' }}
                          />
                        ) : (
                          <div style={{
                            width: 28, height: 28, borderRadius: '50%', flexShrink: 0, marginTop: '1px',
                            background: theme.colors.avatarFallback,
                            border: `1px solid ${theme.colors.border}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 10, color: theme.colors.textPrimary, fontWeight: 500,
                            fontFamily: theme.fonts.body,
                          }}>
                            {cp?.name ? cp.name.charAt(0).toUpperCase() : '?'}
                          </div>
                        )}

                        {/* Body */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px', minWidth: 0, overflow: 'hidden' }}>
                              {cp?.handle ? (
                                <Link
                                  href={`/profile/${cp.handle}`}
                                  className="font-body"
                                  style={{ color: theme.colors.textPrimary, fontSize: '13px', fontWeight: 500, textDecoration: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                                >
                                  {cp.name ?? cp.handle}
                                </Link>
                              ) : (
                                <span className="font-body" style={{ color: theme.colors.textPrimary, fontSize: '13px', fontWeight: 500 }}>
                                  {cp?.name ?? 'Unknown'}
                                </span>
                              )}
                              {cp?.handle && (
                                <span className="font-body" style={{ color: theme.colors.textMuted, fontSize: '12px', whiteSpace: 'nowrap' }}>
                                  @{cp.handle}
                                </span>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                              {clikes > 0 && (
                                <span className="font-body" style={{ fontSize: '11px', color: theme.colors.textMuted }}>
                                  ❤️ {clikes}
                                </span>
                              )}
                              <span className="font-body" style={{ color: theme.colors.textMuted, fontSize: '12px' }}>
                                {formatRelativeTime(comment.created_at)}
                              </span>
                            </div>
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
        </div>
      </div>
    </div>
  )
}
