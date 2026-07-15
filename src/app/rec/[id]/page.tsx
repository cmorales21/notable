import type { Metadata } from 'next'
import { cache } from 'react'
import Link from 'next/link'
import ClientProviders from '@/app/components/ClientProviders'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { theme, CATEGORY_COLORS, CATEGORY_LABELS } from '@/app/lib/theme'
import { PublicHeader } from './PublicHeader'
import { EndCTACard } from './EndCTACard'
import { PrivateRecGate } from './PrivateRecGate'
import { RecCardExpanded } from '@/app/components/feed/RecCardExpanded'
import AuthedPermalinkClient from './AuthedPermalinkClient'
import type { RecComment, Recommendation } from '@/app/lib/types'

// ─── Category config ──────────────────────────────────────────────────────────

const CAT: Record<string, { label: string; color: string; href: string }> = {
  books:       { label: CATEGORY_LABELS.books,       color: CATEGORY_COLORS.books,       href: '/books'       },
  movies:      { label: CATEGORY_LABELS.movies,      color: CATEGORY_COLORS.movies,      href: '/movies'      },
  music:       { label: CATEGORY_LABELS.music,       color: CATEGORY_COLORS.music,       href: '/music'       },
  restaurants: { label: CATEGORY_LABELS.restaurants, color: CATEGORY_COLORS.restaurants, href: '/restaurants' },
  podcasts:    { label: CATEGORY_LABELS.podcasts,    color: CATEGORY_COLORS.podcasts,    href: '/podcasts'    },
}

// ─── Data helpers ─────────────────────────────────────────────────────────────

// Split into two fetches so the private-rec gate never touches rec content.
// The gate only needs owner identity (name, handle, avatar_url) — same fields
// /search already exposes for private profiles in People results. Content
// (title, description, image_url, external_url, category) is fetched only
// once we've confirmed the viewer is allowed to see it.

type OwnerIdentity = {
  name: string | null
  handle: string | null
  avatar_url: string | null
  profile_private: boolean
}

const fetchRecOwner = cache(async (id: string): Promise<{
  user_id: string
  owner: OwnerIdentity
} | null> => {
  const db = createAdminClient() ?? await createClient()
  const { data: rec, error: recErr } = await db
    .from('recommendations')
    .select('user_id')
    .eq('id', id)
    .maybeSingle()
  if (recErr) {
    // 22P02 = malformed UUID in the URL — treat as not-found, not a server error
    if (recErr.code === '22P02') return null
    throw new Error(`Failed to load recommendation: ${recErr.message}`)
  }
  if (!rec) return null
  const { data: profile, error: profErr } = await db
    .from('profiles')
    .select('name, handle, avatar_url, profile_private')
    .eq('id', rec.user_id)
    .maybeSingle()
  if (profErr) throw new Error(`Failed to load recommender profile: ${profErr.message}`)
  return {
    user_id: rec.user_id,
    owner: {
      name: profile?.name ?? null,
      handle: profile?.handle ?? null,
      avatar_url: profile?.avatar_url ?? null,
      profile_private: profile?.profile_private ?? false,
    },
  }
})

const fetchRecContent = cache(async (id: string) => {
  const db = createAdminClient() ?? await createClient()
  const { data: rec, error } = await db
    .from('recommendations')
    .select('id, user_id, category, title, description, image_url, external_url, item_id, created_at')
    .eq('id', id)
    .maybeSingle()
  if (error) {
    if (error.code === '22P02') return null
    throw new Error(`Failed to load recommendation content: ${error.message}`)
  }
  return rec
})

// ─── generateMetadata ─────────────────────────────────────────────────────────

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params

  // Privacy check runs first, off owner identity only, so we never even
  // fetch rec content for a private-owner rec.
  const ownerData = await fetchRecOwner(id)
  if (!ownerData) return { title: 'Notable' }

  // Crawlers (Twitter, Slack, iMessage) have no session, so we can't check
  // follower status. For any private-profile rec, fall back to a generic
  // Notable preview — matches the page body's privacy gate below.
  if (ownerData.owner.profile_private) {
    return {
      title: 'Notable',
      description: 'A social recommendation platform for books, movies, music, restaurants, and podcasts.',
      openGraph: {
        title: 'Notable',
        description: 'A social recommendation platform for books, movies, music, restaurants, and podcasts.',
        type: 'website',
        siteName: 'Notable',
      },
      twitter: {
        card: 'summary_large_image',
        title: 'Notable',
        description: 'A social recommendation platform for books, movies, music, restaurants, and podcasts.',
      },
    }
  }

  const rec = await fetchRecContent(id)
  if (!rec) return { title: 'Notable' }

  const title = `${rec.title} — Notable`
  const description = rec.description
    ? rec.description.slice(0, 150)
    : `Recommended by ${ownerData.owner.name ?? 'someone'} on Notable`

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
  const nextUrl = `/rec/${id}`

  // ── Step 1: owner identity + privacy ────────────────────────────────
  // Only fields exposed: user_id (rec owner), and profile { name, handle,
  // avatar_url, profile_private }. Never touches rec content.
  const ownerData = await fetchRecOwner(id)

  if (!ownerData) {
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

  const serverClientForViewer = await createClient()
  const { data: { user: viewer } } = await serverClientForViewer.auth.getUser()

  // ── Step 2: private-rec gate ────────────────────────────────────────
  // If the owner is private, resolve viewer access without ever fetching
  // rec content. Only the owner's name, handle, and avatar_url (plus their
  // user_id, used server-side for the follow lookup + row insert) are passed
  // to the gate.
  if (ownerData.owner.profile_private) {
    let followStatus: 'none' | 'pending' | 'accepted' = 'none'
    if (viewer) {
      const db = createAdminClient() ?? await createClient()
      const { data: followRow } = await db
        .from('follows')
        .select('status')
        .eq('follower_id', viewer.id)
        .eq('following_id', ownerData.user_id)
        .maybeSingle()
      if (followRow?.status === 'accepted') followStatus = 'accepted'
      else if (followRow?.status === 'pending') followStatus = 'pending'
    }

    if (followStatus !== 'accepted') {
      return (
        <PrivateRecGate
          viewer={viewer ? { loggedIn: true, userId: viewer.id } : { loggedIn: false }}
          initialFollowState={followStatus}
          recipientUserId={ownerData.user_id}
          ownerName={ownerData.owner.name}
          ownerHandle={ownerData.owner.handle}
          ownerAvatarUrl={ownerData.owner.avatar_url}
          nextUrl={nextUrl}
        />
      )
    }
  }

  // ── Step 3: viewer is allowed to see the rec — load content ─────────
  const rec = await fetchRecContent(id)
  if (!rec) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
        <div style={{ textAlign: 'center', maxWidth: '360px' }}>
          <p className="font-display" style={{ fontSize: '22px', fontWeight: 600, color: theme.colors.textPrimary, marginBottom: '10px' }}>
            Recommendation not found
          </p>
        </div>
      </div>
    )
  }

  const db = createAdminClient() ?? await createClient()

  // Base parallel fetches (needed for both authed and public branches).
  const [
    { count: likeCount },
    { data: commentsRaw },
    viewerLikeQuery,
    viewerBookmarkQuery,
  ] = await Promise.all([
    db.from('likes').select('*', { count: 'exact', head: true }).eq('recommendation_id', id),
    db
      .from('comments')
      .select('id, user_id, text, created_at, comment_likes(id, user_id)')
      .eq('recommendation_id', id)
      .order('created_at', { ascending: true }),
    viewer
      ? db.from('likes').select('user_id').eq('recommendation_id', id).eq('user_id', viewer.id).maybeSingle()
      : Promise.resolve({ data: null }),
    viewer
      ? db.from('bookmarks').select('user_id').eq('recommendation_id', id).eq('user_id', viewer.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const commentsRawArr = (commentsRaw ?? []) as Array<{
    id: string
    user_id: string
    text: string
    created_at: string
    comment_likes: Array<{ id: string; user_id: string }> | null
  }>

  // Fetch author profiles for the comments (no FK join available)
  const commentUserIds = [...new Set(commentsRawArr.map(c => c.user_id))]
  const { data: commentProfilesRaw } = commentUserIds.length > 0
    ? await db.from('profiles').select('id, name, handle, avatar_url').in('id', commentUserIds)
    : { data: [] }
  const commentProfileMap: Record<string, { name: string | null; handle: string | null; avatar_url: string | null }> = {}
  for (const p of commentProfilesRaw ?? []) {
    commentProfileMap[p.id] = { name: p.name, handle: p.handle, avatar_url: p.avatar_url }
  }

  const comments: RecComment[] = commentsRawArr.map(c => ({
    id: c.id,
    user_id: c.user_id,
    recommendation_id: id,
    text: c.text,
    created_at: c.created_at,
    profiles: commentProfileMap[c.user_id] ?? null,
    comment_likes: c.comment_likes ?? [],
  }))

  const commentCount = comments.length
  const lc = likeCount ?? 0
  const cat = CAT[rec.category] ?? { label: rec.category, color: theme.colors.textMuted, href: '/lobby' }
  const profile = ownerData.owner

  const recForCard: Recommendation = {
    id: rec.id,
    user_id: rec.user_id,
    category: rec.category,
    title: rec.title,
    description: rec.description,
    image_url: rec.image_url,
    external_url: rec.external_url,
    item_id: rec.item_id ?? null,
    created_at: rec.created_at,
    profiles: {
      name: profile.name,
      handle: profile.handle,
      avatar_url: profile.avatar_url,
    },
  }

  // ── Signed-in branch: inside AppShell chrome ─────────────────────────
  if (viewer) {
    const initialLiked = !!viewerLikeQuery.data
    const initialBookmarked = !!viewerBookmarkQuery.data

    // Viewer profile for AppShell — same three fields (app)/layout.tsx pulls.
    const { data: viewerProfile } = await db
      .from('profiles')
      .select('name, handle, avatar_url')
      .eq('id', viewer.id)
      .maybeSingle()

    return (
      <AuthedPermalinkClient
        rec={recForCard}
        viewerProfile={viewerProfile ?? null}
        viewerUserId={viewer.id}
        initialLiked={initialLiked}
        initialBookmarked={initialBookmarked}
        initialLikeCount={lc}
        initialCommentCount={commentCount}
        initialComments={comments}
        accentColor={cat.color}
        backHref={cat.href}
        backLabel={cat.label}
      />
    )
  }

  // ── Logged-out branch: PublicHeader + card + EndCTACard ─────────────
  return (
    <ClientProviders>
      <PublicHeader nextUrl={nextUrl} />
      <div style={{ padding: '24px 20px 80px' }}>
        <div style={{ maxWidth: '560px', margin: '0 auto' }}>

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

          <div style={{
            background: theme.colors.surface,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radii.card,
            boxShadow: theme.shadows.card,
            overflow: 'hidden',
          }}>
            <RecCardExpanded
              layout="public-page"
              rec={recForCard}
              accentColor={cat.color}
              liked={false}
              bookmarked={false}
              likeCount={lc}
              commentCount={commentCount}
              comments={comments}
              loadingComments={false}
              nextUrl={nextUrl}
            />
          </div>

          <EndCTACard nextUrl={nextUrl} />
        </div>
      </div>
    </ClientProviders>
  )
}
