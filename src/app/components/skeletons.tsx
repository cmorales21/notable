import type { CSSProperties } from 'react'

/**
 * Notable skeleton component system — Phase 21
 *
 * Every component uses .skeleton-shimmer (globals.css) which runs a
 * left-to-right highlight sweep via a ::after pseudo-element, so the
 * base background colour can be set freely per-element without fighting
 * the animation class.
 *
 * Base colour:      rgba(0,0,0,0.06)  on #f5f0e8 → warm-cream block
 * Shimmer colour:   rgba(255,255,255,0.25) highlight sweeping left→right
 * Duration:         1.5s ease-in-out infinite
 */

// ── SkeletonPulse ─────────────────────────────────────────────────────────────
// Base building block. className is for Tailwind sizing utilities;
// style is for inline dimensions when composing larger skeletons.

export function SkeletonPulse({
  className,
  style,
}: {
  className?: string
  style?: CSSProperties
}) {
  return (
    <div
      className={`skeleton-shimmer${className ? ` ${className}` : ''}`}
      style={{ background: 'rgba(0,0,0,0.06)', ...style }}
    />
  )
}

// ── FeedCardSkeleton ──────────────────────────────────────────────────────────
// Mirrors the exact structure of RecommendationCard / GroupedCard:
//   recommender row → teaser text → image → title → action buttons

function FeedCardSkeleton() {
  return (
    <div
      style={{
        background: '#faf8f4',
        borderRadius: 16,
        border: '1px solid rgba(0,0,0,0.08)',
        overflow: 'hidden',
      }}
    >
      {/* Recommender row — padding matches card's 8px 16px 0 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 16px 0',
        }}
      >
        <SkeletonPulse style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {/* Name */}
          <SkeletonPulse style={{ height: 12, width: 96, borderRadius: 5 }} />
          {/* @handle */}
          <SkeletonPulse style={{ height: 10, width: 64, borderRadius: 5 }} />
        </div>
      </div>

      {/* Teaser — two lines mirroring the 2-line clamp in TeaserText */}
      <div style={{ padding: '8px 16px 0', display: 'flex', flexDirection: 'column', gap: 5 }}>
        <SkeletonPulse style={{ height: 13, borderRadius: 5 }} />
        <SkeletonPulse style={{ height: 13, width: '60%', borderRadius: 5 }} />
      </div>

      {/* Image area — 280px fixed height, same as the real card */}
      <SkeletonPulse style={{ height: 280, marginTop: 8 }} />

      {/* Title + action buttons — padding matches card's 8px 16px 10px */}
      <div style={{ padding: '8px 16px 10px' }}>
        <SkeletonPulse
          style={{ height: 20, width: '72%', borderRadius: 6, marginBottom: 10 }}
        />
        {/* Three icon circles, space-between to match the real action row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: 4, paddingRight: 4 }}>
          <SkeletonPulse style={{ width: 28, height: 28, borderRadius: '50%' }} />
          <SkeletonPulse style={{ width: 28, height: 28, borderRadius: '50%' }} />
          <SkeletonPulse style={{ width: 28, height: 28, borderRadius: '50%' }} />
        </div>
      </div>
    </div>
  )
}

// ── ProfileHeaderSkeleton ─────────────────────────────────────────────────────
// Mirrors the profile header: large avatar + name / handle / bio / follow counts

function ProfileHeaderSkeleton() {
  return (
    <div
      style={{
        display: 'flex',
        gap: 16,
        alignItems: 'flex-start',
        marginBottom: 14,
      }}
    >
      {/* Avatar — 96px as specified */}
      <SkeletonPulse
        style={{ width: 96, height: 96, borderRadius: '50%', flexShrink: 0 }}
      />

      {/* Text columns */}
      <div
        style={{
          flex: 1,
          paddingTop: 4,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {/* Name */}
        <SkeletonPulse style={{ height: 22, width: '48%', borderRadius: 8 }} />
        {/* @handle */}
        <SkeletonPulse style={{ height: 13, width: '28%', borderRadius: 6 }} />
        {/* Bio */}
        <SkeletonPulse style={{ height: 13, width: '70%', borderRadius: 6 }} />
        {/* Follower / following counts */}
        <div style={{ display: 'flex', gap: 8 }}>
          <SkeletonPulse style={{ height: 12, width: 80, borderRadius: 6 }} />
          <SkeletonPulse style={{ height: 12, width: 80, borderRadius: 6 }} />
        </div>
      </div>
    </div>
  )
}

// ── ProfileGridSkeleton ───────────────────────────────────────────────────────
// 6-tile grid matching the profile page's repeat(3, 1fr) / aspectRatio 3/4 layout

export function ProfileGridSkeleton() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 10,
      }}
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <SkeletonPulse style={{ aspectRatio: '3 / 4', borderRadius: 10 }} />
          {/* Short title bar beneath each tile */}
          <SkeletonPulse style={{ height: 11, width: '68%', borderRadius: 4 }} />
        </div>
      ))}
    </div>
  )
}

// ── SearchResultSkeleton ──────────────────────────────────────────────────────
// type="rec"    — 80px square image + two text lines (title + attribution)
// type="person" — 56px circle avatar + two text lines (name + handle)

function SearchResultSkeleton({
  type = 'rec',
}: {
  type?: 'rec' | 'person'
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '14px 0',
        borderBottom: '1px solid rgba(0,0,0,0.04)',
      }}
    >
      {type === 'rec' ? (
        <SkeletonPulse
          style={{ width: 80, height: 80, borderRadius: 10, flexShrink: 0 }}
        />
      ) : (
        <SkeletonPulse
          style={{ width: 56, height: 56, borderRadius: '50%', flexShrink: 0 }}
        />
      )}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <SkeletonPulse style={{ height: 15, width: '65%', borderRadius: 5 }} />
        <SkeletonPulse style={{ height: 11, width: '40%', borderRadius: 5 }} />
      </div>
    </div>
  )
}

// ── FeedSkeleton ──────────────────────────────────────────────────────────────
// 4 FeedCardSkeletons stacked with the same vertical gap as the real feed

export function FeedSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <FeedCardSkeleton key={i} />
      ))}
    </div>
  )
}

// ── ProfileSkeleton ───────────────────────────────────────────────────────────
// Full profile loading state: header + tab bar placeholder + grid

export function ProfileSkeleton() {
  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '14px 20px 48px' }}>
      <ProfileHeaderSkeleton />

      {/* Tab bar placeholder — three pill bars mimicking Posted / Liked / Bookmarked */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          borderBottom: '1px solid rgba(0,0,0,0.08)',
          marginBottom: 14,
        }}
      >
        {[60, 52, 72].map((w, i) => (
          <SkeletonPulse
            key={i}
            style={{ height: 13, width: w, borderRadius: 6, margin: '10px 8px' }}
          />
        ))}
      </div>

      <ProfileGridSkeleton />
    </div>
  )
}

// ── LobbySkeleton ─────────────────────────────────────────────────────────────
// 5 tile placeholders matching the lobby's 6-column grid:
//   Row 1: 3 tiles (col-span-2)
//   Row 2: 2 tiles (col-span-2, centered via col-start-2)

export function LobbySkeleton() {
  return (
    <div
      className="min-h-screen px-5 md:px-8 lg:px-12"
      style={{ background: '#f5f0e8', paddingTop: '1rem', paddingBottom: '3rem' }}
    >
      <div className="grid grid-cols-1 md:grid-cols-6 gap-x-4 gap-y-3 md:gap-x-6 md:gap-y-3 max-w-5xl mx-auto">
        {[0, 1, 2].map(i => (
          <div key={i} className="col-span-1 md:col-span-2">
            <SkeletonPulse className="w-full rounded-xl h-[130px] min-[400px]:h-[140px] md:h-[212px]" />
          </div>
        ))}
        <div className="col-span-1 md:col-span-2 md:col-start-2">
          <SkeletonPulse className="w-full rounded-xl h-[130px] min-[400px]:h-[140px] md:h-[212px]" />
        </div>
        <div className="col-span-1 md:col-span-2">
          <SkeletonPulse className="w-full rounded-xl h-[130px] min-[400px]:h-[140px] md:h-[212px]" />
        </div>
      </div>
    </div>
  )
}

// ── SearchSkeleton ────────────────────────────────────────────────────────────
// 3 rec results followed by 3 people results, mirroring the two-section layout

export function SearchSkeleton() {
  return (
    <div>
      {/* Recommendation results */}
      {Array.from({ length: 3 }).map((_, i) => (
        <SearchResultSkeleton key={`rec-${i}`} type="rec" />
      ))}

      {/* People results — section label + rows */}
      <div style={{ marginTop: 28 }}>
        {/* Section label bar */}
        <SkeletonPulse
          style={{ height: 10, width: 48, borderRadius: 4, marginBottom: 12 }}
        />
        {Array.from({ length: 3 }).map((_, i) => (
          <SearchResultSkeleton key={`person-${i}`} type="person" />
        ))}
      </div>
    </div>
  )
}
