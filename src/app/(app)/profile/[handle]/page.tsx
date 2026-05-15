'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Avatar, RecModal, Recommendation, RecComment, RecProfile, sortComments } from '@/app/components/CategoryFeed'
import Whisper from '@/app/components/Whisper'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FullProfile {
  id: string
  name: string | null
  handle: string | null
  bio: string | null
  avatar_url: string | null
  bookmarks_private?: boolean | null
  profile_private?: boolean | null
}

interface FollowUser {
  id: string
  name: string | null
  handle: string | null
  avatar_url: string | null
}

type TabId = 'posted' | 'liked' | 'bookmarked'
type CategoryFilter = 'all' | 'books' | 'movies' | 'music' | 'restaurants' | 'podcasts'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  books: '#5271FF',
  movies: '#dc4f5c',
  music: '#4aad4e',
  restaurants: '#9055d0',
  podcasts: '#d4920a',
}

const CATEGORY_LABELS: Record<string, string> = {
  books: 'Books',
  movies: 'Movies',
  music: 'Music',
  restaurants: 'Restaurants',
  podcasts: 'Podcasts',
}

const CATEGORIES: CategoryFilter[] = ['all', 'books', 'movies', 'music', 'restaurants', 'podcasts']

const TAB_LABELS: Record<TabId, string> = {
  posted: 'Posted',
  liked: 'Liked',
  bookmarked: 'Bookmarked',
}

// ─── Initials avatar (profile header only) ────────────────────────────────────

function InitialsAvatar({ name, size }: { name: string | null; size: number }) {
  const initial = name ? name.charAt(0).toUpperCase() : '?'
  const hue = name ? (name.charCodeAt(0) * 37) % 360 : 200
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `linear-gradient(135deg, hsl(${hue},40%,82%), hsl(${hue},30%,75%))`,
      border: '2px solid rgba(0,0,0,0.1)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 600, color: `hsl(${hue},45%,30%)`,
      fontFamily: 'var(--font-display, "Playfair Display", serif)',
    }}>
      {initial}
    </div>
  )
}

// ─── Grid tile ────────────────────────────────────────────────────────────────

function GridTile({ rec, onClick }: { rec: Recommendation; onClick: () => void }) {
  const [hovered, setHovered] = useState(false)
  const [imgError, setImgError] = useState(false)
  const color = CATEGORY_COLORS[rec.category] ?? '#6b5d4f'
  const showImage = !!rec.image_url && !imgError

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        aspectRatio: '3/4',
        borderRadius: '10px',
        overflow: 'hidden',
        cursor: 'pointer',
        background: '#faf8f4',
        transform: hovered ? 'scale(1.03)' : 'scale(1)',
        transition: 'transform 0.2s ease',
      }}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={rec.image_url!}
          alt={rec.title}
          onError={() => setImgError(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <div style={{
          width: '100%', height: '100%',
          background: `${color}26`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '16px',
          boxSizing: 'border-box',
        }}>
          <p className="font-display" style={{
            fontSize: '0.95rem', fontWeight: 600, color: '#33261a',
            textAlign: 'center', lineHeight: 1.35, letterSpacing: '-0.01em',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}>
            {rec.title}
          </p>
        </div>
      )}

      {/* Category dot */}
      <div style={{
        position: 'absolute', top: '8px', left: '8px',
        width: '7px', height: '7px', borderRadius: '50%',
        background: color,
        boxShadow: `0 0 6px ${color}88`,
      }} />

      {showImage && (
        <>
          {/* Dark gradient overlay — only over real images */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.1) 55%, transparent 100%)',
          }} />

          {/* Title over image */}
          <p className="font-display" style={{
            position: 'absolute', bottom: '10px', left: '10px', right: '10px',
            fontSize: '0.82rem', fontWeight: 600, color: '#33261a',
            lineHeight: 1.3,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            letterSpacing: '-0.01em',
          }}>
            {rec.title}
          </p>
        </>
      )}
    </div>
  )
}

// ─── Empty tab state ──────────────────────────────────────────────────────────

function EmptyTab({ tab }: { tab: TabId }) {
  const messages: Record<TabId, string> = {
    posted: 'Nothing posted yet.',
    liked: 'No likes yet — explore the feeds and give your first 👌',
    bookmarked: 'No bookmarks yet.',
  }
  return (
    <div style={{ paddingTop: '60px', textAlign: 'center' }}>
      <p className="font-body" style={{ color: '#6b5d4f', fontSize: '15px', lineHeight: 1.6 }}>
        {messages[tab]}
      </p>
    </div>
  )
}

// ─── Follow row button ────────────────────────────────────────────────────────

function FollowRowButton({
  following, pending, onToggle,
}: {
  following: boolean
  pending: boolean
  onToggle: () => void
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onToggle}
      disabled={pending}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="font-body"
      style={{
        background: following ? (hovered ? 'rgba(212,99,107,0.12)' : 'rgba(0,0,0,0.08)') : 'transparent',
        border: `1px solid ${following ? (hovered ? 'rgba(212,99,107,0.4)' : 'rgba(0,0,0,0.12)') : 'rgba(0,0,0,0.15)'}`,
        borderRadius: '20px', padding: '4px 12px',
        fontSize: '12px', fontWeight: 500,
        color: following ? (hovered ? '#d4636b' : '#33261a') : '#33261a',
        cursor: pending ? 'default' : 'pointer',
        transition: 'all 0.15s',
        flexShrink: 0, minWidth: '72px', textAlign: 'center',
      }}
    >
      {following ? (hovered ? 'Unfollow' : 'Following') : 'Follow'}
    </button>
  )
}

// ─── Followers / Following modal ──────────────────────────────────────────────

function FollowListModal({
  type, profileId, currentUserId, onClose,
}: {
  type: 'followers' | 'following'
  profileId: string
  currentUserId: string | null
  onClose: () => void
}) {
  const supabase = useRef(createClient())
  const [users, setUsers] = useState<FollowUser[]>([])
  const [loading, setLoading] = useState(true)
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set())
  const [pending, setPending] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function load() {
      let userIds: string[] = []

      if (type === 'followers') {
        const { data } = await supabase.current
          .from('follows').select('follower_id').eq('following_id', profileId)
        userIds = (data ?? []).map((f: { follower_id: string }) => f.follower_id)
      } else {
        const { data } = await supabase.current
          .from('follows').select('following_id').eq('follower_id', profileId)
        userIds = (data ?? []).map((f: { following_id: string }) => f.following_id)
      }

      if (userIds.length > 0) {
        const { data: profilesData } = await supabase.current
          .from('profiles').select('id, name, handle, avatar_url').in('id', userIds)
        setUsers(profilesData ?? [])

        if (currentUserId) {
          const { data: myFollows } = await supabase.current
            .from('follows').select('following_id')
            .eq('follower_id', currentUserId).in('following_id', userIds)
          setFollowedIds(new Set((myFollows ?? []).map((f: { following_id: string }) => f.following_id)))
        }
      }

      setLoading(false)
    }
    load()
  }, [type, profileId, currentUserId])

  async function toggleFollow(targetId: string) {
    if (!currentUserId || pending.has(targetId)) return
    setPending(prev => new Set([...prev, targetId]))
    if (followedIds.has(targetId)) {
      await supabase.current.from('follows').delete()
        .eq('follower_id', currentUserId).eq('following_id', targetId)
      setFollowedIds(prev => { const n = new Set(prev); n.delete(targetId); return n })
    } else {
      await supabase.current.from('follows').insert({ follower_id: currentUserId, following_id: targetId })
      setFollowedIds(prev => new Set([...prev, targetId]))
      supabase.current.from('notifications').insert({ user_id: targetId, actor_id: currentUserId, type: 'follow', read: false })
    }
    setPending(prev => { const n = new Set(prev); n.delete(targetId); return n })
  }

  const title = type === 'followers' ? 'Followers' : 'Following'
  const emptyMsg = type === 'followers' ? 'No followers yet' : 'Not following anyone yet'

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 350,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '400px',
          background: '#faf8f4',
          borderRadius: '16px',
          border: '1px solid rgba(0,0,0,0.08)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
          display: 'flex', flexDirection: 'column',
          maxHeight: '80vh', overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px',
          borderBottom: '1px solid rgba(0,0,0,0.08)',
          flexShrink: 0,
        }}>
          <h2 className="font-display" style={{ fontSize: '1.05rem', fontWeight: 600, color: '#33261a' }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#6b5d4f', display: 'flex', padding: '4px', borderRadius: '6px',
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
              strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* List */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ padding: '12px 20px' }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0' }}>
                  <div className="skeleton-pulse" style={{ width: 36, height: 36, borderRadius: '50%', background: '#efe9e0', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div className="skeleton-pulse" style={{ height: 13, width: '42%', borderRadius: 6, background: '#efe9e0', marginBottom: 6 }} />
                    <div className="skeleton-pulse" style={{ height: 11, width: '26%', borderRadius: 6, background: '#efe9e0' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : users.length === 0 ? (
            <div style={{ padding: '44px 20px', textAlign: 'center' }}>
              <p className="font-body" style={{ color: '#6b5d4f', fontSize: '14px' }}>{emptyMsg}</p>
            </div>
          ) : (
            <div style={{ padding: '6px 0 10px' }}>
              {users.map(user => (
                <div
                  key={user.id}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '9px 20px' }}
                >
                  {user.handle ? (
                    <Link href={`/profile/${user.handle}`} onClick={onClose} style={{ lineHeight: 0, flexShrink: 0 }}>
                      <Avatar url={user.avatar_url} name={user.name} size={36} />
                    </Link>
                  ) : (
                    <Avatar url={user.avatar_url} name={user.name} size={36} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {user.handle ? (
                      <Link
                        href={`/profile/${user.handle}`}
                        onClick={onClose}
                        className="font-body"
                        style={{
                          display: 'block', color: '#33261a', fontSize: '14px', fontWeight: 500,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          textDecoration: 'none',
                        }}
                      >
                        {user.name ?? user.handle}
                      </Link>
                    ) : (
                      <p className="font-body" style={{
                        color: '#33261a', fontSize: '14px', fontWeight: 500,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {user.name ?? user.handle}
                      </p>
                    )}
                    {user.handle && (
                      <Link
                        href={`/profile/${user.handle}`}
                        onClick={onClose}
                        className="font-body"
                        style={{ display: 'block', color: '#6b5d4f', fontSize: '12px', textDecoration: 'none' }}
                      >
                        @{user.handle}
                      </Link>
                    )}
                  </div>
                  {user.id !== currentUserId && currentUserId && (
                    <FollowRowButton
                      following={followedIds.has(user.id)}
                      pending={pending.has(user.id)}
                      onToggle={() => toggleFollow(user.id)}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Edit Profile Modal ───────────────────────────────────────────────────────

function EditProfileModal({
  profile, onClose, onSave,
}: {
  profile: FullProfile
  onClose: () => void
  onSave: (updates: { name: string; bio: string; avatar_url: string | null }) => void
}) {
  const supabase = useRef(createClient())
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(profile.name ?? '')
  const [bio, setBio] = useState(profile.bio ?? '')
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${profile.id}/avatar.${ext}`
      const { error: upErr } = await supabase.current.storage
        .from('avatars').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.current.storage.from('avatars').getPublicUrl(path)
      setAvatarUrl(publicUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const { error: updateErr } = await supabase.current
        .from('profiles')
        .update({ name: name.trim(), bio: bio.trim(), avatar_url: avatarUrl })
        .eq('id', profile.id)
      if (updateErr) throw updateErr
      onSave({ name: name.trim(), bio: bio.trim(), avatar_url: avatarUrl })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
      setSaving(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px',
    }}>
      <div style={{
        width: '100%', maxWidth: '440px',
        background: '#faf8f4',
        borderRadius: '16px',
        border: '1px solid rgba(0,0,0,0.08)',
        padding: '24px 24px 22px',
        boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
      }}>
        <h2 className="font-display" style={{ fontSize: '1.15rem', fontWeight: 600, color: '#33261a', marginBottom: '20px' }}>
          Edit Profile
        </h2>

        {/* Avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, position: 'relative', flexShrink: 0 }}
            title="Change photo"
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(0,0,0,0.1)', display: 'block' }} />
            ) : (
              <InitialsAvatar name={name} size={56} />
            )}
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: 'rgba(0,0,0,0.45)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: uploading ? 1 : 0, transition: 'opacity 0.15s',
            }}>
              {uploading && (
                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" width="16" height="16"
                  style={{ animation: 'spin 0.8s linear infinite' }}>
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
              )}
            </div>
          </button>
          <div>
            <p className="font-body" style={{ color: '#33261a', fontSize: '13px', fontWeight: 500, marginBottom: '2px' }}>Photo</p>
            <p className="font-body" style={{ color: '#6b5d4f', fontSize: '12px' }}>Click to change</p>
          </div>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp"
            onChange={handleAvatarChange} style={{ display: 'none' }} />
        </div>

        {/* Name */}
        <div style={{ marginBottom: '14px' }}>
          <label className="font-body" style={{ display: 'block', color: '#6b5d4f', fontSize: '11px', marginBottom: '5px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={60}
            className="font-body"
            style={{
              width: '100%', boxSizing: 'border-box',
              background: '#f5f0e8', border: '1px solid rgba(0,0,0,0.1)',
              borderRadius: '10px', padding: '9px 13px',
              color: '#33261a', fontSize: '14px', outline: 'none',
            }}
          />
        </div>

        {/* Bio */}
        <div style={{ marginBottom: '14px' }}>
          <label className="font-body" style={{ display: 'block', color: '#6b5d4f', fontSize: '11px', marginBottom: '5px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Bio <span style={{ color: '#3a3428' }}>({160 - bio.length} left)</span>
          </label>
          <textarea
            value={bio}
            onChange={e => setBio(e.target.value.slice(0, 160))}
            rows={2}
            className="font-body"
            style={{
              width: '100%', boxSizing: 'border-box',
              background: '#f5f0e8', border: '1px solid rgba(0,0,0,0.1)',
              borderRadius: '10px', padding: '9px 13px',
              color: '#33261a', fontSize: '14px', outline: 'none',
              resize: 'none', lineHeight: 1.6,
            }}
          />
        </div>

        {/* Handle — read-only */}
        <div style={{ marginBottom: '20px' }}>
          <label className="font-body" style={{ display: 'block', color: '#6b5d4f', fontSize: '11px', marginBottom: '5px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Handle</label>
          <p className="font-body" style={{ color: '#4a4438', fontSize: '14px', padding: '9px 0' }}>
            @{profile.handle}
          </p>
        </div>

        {error && (
          <p className="font-body" style={{ color: '#d4636b', fontSize: '13px', marginBottom: '12px' }}>{error}</p>
        )}

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            className="font-body"
            style={{
              background: 'transparent', border: '1px solid rgba(0,0,0,0.1)',
              borderRadius: '20px', padding: '7px 18px',
              color: '#6b5d4f', fontSize: '13px', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="font-body"
            style={{
              background: saving ? '#e8e0d4' : '#3a2a1a',
              border: 'none', borderRadius: '20px', padding: '7px 18px',
              color: '#f5f0e8', fontSize: '13px', fontWeight: 600,
              cursor: saving ? 'default' : 'pointer',
              transition: 'background 0.15s',
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { handle } = useParams<{ handle: string }>()
  const supabase = useRef(createClient())

  const [profile, setProfile] = useState<FullProfile | null>(null)
  const [notFound, setNotFound] = useState(false)

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserProfile, setCurrentUserProfile] = useState<RecProfile | null>(null)
  const [isOwnProfile, setIsOwnProfile] = useState(false)

  const [profileLoading, setProfileLoading] = useState(true)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [followLoading, setFollowLoading] = useState(false)
  const [followHovered, setFollowHovered] = useState(false)

  // Followers/following modal
  const [followListModal, setFollowListModal] = useState<'followers' | 'following' | null>(null)

  const [activeTab, setActiveTab] = useState<TabId>('posted')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')

  const [recs, setRecs] = useState<Recommendation[]>([])
  const [recsLoading, setRecsLoading] = useState(true)

  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarHovered, setAvatarHovered] = useState(false)

  const [editOpen, setEditOpen] = useState(false)

  const [selectedRec, setSelectedRec] = useState<Recommendation | null>(null)
  const [modalComments, setModalComments] = useState<RecComment[]>([])
  const [modalLoadingComments, setModalLoadingComments] = useState(false)
  const [modalCommentInput, setModalCommentInput] = useState('')
  const [modalSubmittingComment, setModalSubmittingComment] = useState(false)
  const [modalLiked, setModalLiked] = useState(false)
  const [modalBookmarked, setModalBookmarked] = useState(false)
  const [modalLikeCount, setModalLikeCount] = useState(0)
  const [modalCommentCount, setModalCommentCount] = useState(0)
  const commentInputRef = useRef<HTMLTextAreaElement>(null)

  // ── Load profile & current user ─────────────────────────────────────────────

  useEffect(() => {
    async function loadProfile() {
      try {
        const [{ data: profileData }, { data: { user } }] = await Promise.all([
          supabase.current.from('profiles')
            .select('id, name, handle, bio, avatar_url, bookmarks_private, profile_private')
            .eq('handle', handle).maybeSingle(),
          supabase.current.auth.getUser(),
        ])

        if (!profileData) { setNotFound(true); return }
        setProfile(profileData as FullProfile)

        const uid = user?.id ?? null
        setCurrentUserId(uid)
        setIsOwnProfile(uid === profileData.id)

        if (uid) {
          const [{ data: myProfile }, { data: followRow }, { data: followers }, { data: following }] = await Promise.all([
            supabase.current.from('profiles').select('name, handle, avatar_url').eq('id', uid).maybeSingle(),
            supabase.current.from('follows').select('id').eq('follower_id', uid).eq('following_id', profileData.id).maybeSingle(),
            supabase.current.from('follows').select('id').eq('following_id', profileData.id),
            supabase.current.from('follows').select('id').eq('follower_id', profileData.id),
          ])
          setCurrentUserProfile(myProfile as RecProfile)
          setIsFollowing(!!followRow)
          setFollowerCount(followers?.length ?? 0)
          setFollowingCount(following?.length ?? 0)
        } else {
          const [{ data: followers }, { data: following }] = await Promise.all([
            supabase.current.from('follows').select('id').eq('following_id', profileData.id),
            supabase.current.from('follows').select('id').eq('follower_id', profileData.id),
          ])
          setFollowerCount(followers?.length ?? 0)
          setFollowingCount(following?.length ?? 0)
        }
      } finally {
        setProfileLoading(false)
      }
    }
    loadProfile()
  }, [handle])

  // ── Load recs for active tab ────────────────────────────────────────────────

  const loadRecs = useCallback(async (tab: TabId, profileId: string) => {
    setRecsLoading(true)
    setRecs([])
    try {
      let recRows: Recommendation[] = []

      if (tab === 'posted') {
        const { data } = await supabase.current
          .from('recommendations').select('*')
          .eq('user_id', profileId).order('created_at', { ascending: false })
        recRows = data ?? []
      } else if (tab === 'liked') {
        const { data: likeData } = await supabase.current
          .from('likes').select('recommendation_id').eq('user_id', profileId)
        const ids = (likeData ?? []).map((l: { recommendation_id: string }) => l.recommendation_id)
        if (ids.length > 0) {
          const { data } = await supabase.current
            .from('recommendations').select('*').in('id', ids).order('created_at', { ascending: false })
          recRows = data ?? []
        }
      } else if (tab === 'bookmarked') {
        const { data: bmData } = await supabase.current
          .from('bookmarks').select('recommendation_id').eq('user_id', profileId)
        const ids = (bmData ?? []).map((b: { recommendation_id: string }) => b.recommendation_id)
        if (ids.length > 0) {
          const { data } = await supabase.current
            .from('recommendations').select('*').in('id', ids).order('created_at', { ascending: false })
          recRows = data ?? []
        }
      }

      if (recRows.length > 0) {
        const userIds = [...new Set(recRows.map(r => r.user_id))]
        const { data: profilesData } = await supabase.current
          .from('profiles').select('id, name, handle, avatar_url').in('id', userIds)
        const profileMap: Record<string, RecProfile> = {}
        for (const p of profilesData ?? []) profileMap[p.id] = p
        recRows = recRows.map(r => ({ ...r, profiles: profileMap[r.user_id] ?? null }))
      }

      setRecs(recRows)
    } finally {
      setRecsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!profile) return
    const gated = profile.profile_private === true && !isOwnProfile && !isFollowing
    if (gated) { setRecs([]); setRecsLoading(false); return }
    if (activeTab === 'liked' && !isOwnProfile) {
      setActiveTab('posted')
      return
    }
    if (activeTab === 'bookmarked' && !isOwnProfile && profile?.bookmarks_private) {
      setActiveTab('posted')
      return
    }
    loadRecs(activeTab, profile.id)
    setCategoryFilter('all')
  }, [activeTab, profile, isOwnProfile, isFollowing, loadRecs])

  // ── Follow / Unfollow ───────────────────────────────────────────────────────

  async function handleFollow() {
    if (!currentUserId || !profile || followLoading) return
    setFollowLoading(true)
    if (isFollowing) {
      await supabase.current.from('follows').delete().eq('follower_id', currentUserId).eq('following_id', profile.id)
      setIsFollowing(false)
      setFollowerCount(c => c - 1)
    } else {
      await supabase.current.from('follows').insert({ follower_id: currentUserId, following_id: profile.id })
      setIsFollowing(true)
      setFollowerCount(c => c + 1)
      supabase.current.from('notifications').insert({ user_id: profile.id, actor_id: currentUserId, type: 'follow', read: false })
    }
    setFollowLoading(false)
  }

  // ── Avatar upload ───────────────────────────────────────────────────────────

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !currentUserId) return
    setAvatarUploading(true)
    try {
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${currentUserId}/avatar.${ext}`
      const { error: upErr } = await supabase.current.storage.from('avatars').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.current.storage.from('avatars').getPublicUrl(path)
      await supabase.current.from('profiles').update({ avatar_url: publicUrl }).eq('id', currentUserId)
      setProfile(prev => prev ? { ...prev, avatar_url: publicUrl } : prev)
    } catch (err) {
      console.error('Avatar upload failed:', err)
    } finally {
      setAvatarUploading(false)
    }
  }

  // ── Open rec modal ──────────────────────────────────────────────────────────

  async function openRecModal(rec: Recommendation) {
    setSelectedRec(rec)
    setModalCommentInput('')
    setModalLoadingComments(true)

    const [commentsResRaw, likesRes, myLikeRes, myBmRes] = await Promise.all([
      supabase.current.from('comments').select('*, profiles(name, handle, avatar_url), comment_likes(id, user_id)')
        .eq('recommendation_id', rec.id).order('created_at', { ascending: true }),
      supabase.current.from('likes').select('id').eq('recommendation_id', rec.id),
      currentUserId
        ? supabase.current.from('likes').select('id').eq('user_id', currentUserId).eq('recommendation_id', rec.id).maybeSingle()
        : Promise.resolve({ data: null }),
      currentUserId
        ? supabase.current.from('bookmarks').select('id').eq('user_id', currentUserId).eq('recommendation_id', rec.id).maybeSingle()
        : Promise.resolve({ data: null }),
    ])

    // Fallback if comment_likes table doesn't exist yet
    let commentsData = commentsResRaw.data
    if (commentsResRaw.error) {
      const { data: fallback } = await supabase.current
        .from('comments').select('*, profiles(name, handle, avatar_url)')
        .eq('recommendation_id', rec.id).order('created_at', { ascending: true })
      commentsData = fallback
    }
    const sortedComments = sortComments(commentsData ?? [])
    setModalComments(sortedComments)
    setModalLikeCount(likesRes.data?.length ?? 0)
    setModalLiked(!!myLikeRes.data)
    setModalBookmarked(!!myBmRes.data)
    setModalCommentCount(sortedComments.length)
    setModalLoadingComments(false)
  }

  async function handleModalLike(e: React.MouseEvent) {
    e.stopPropagation()
    if (!currentUserId || !selectedRec) return
    if (modalLiked) {
      await supabase.current.from('likes').delete().eq('user_id', currentUserId).eq('recommendation_id', selectedRec.id)
      setModalLiked(false)
      setModalLikeCount(c => c - 1)
    } else {
      await supabase.current.from('likes').insert({ user_id: currentUserId, recommendation_id: selectedRec.id })
      setModalLiked(true)
      setModalLikeCount(c => c + 1)
      if (selectedRec.user_id !== currentUserId) {
        supabase.current.from('notifications').insert({ user_id: selectedRec.user_id, actor_id: currentUserId, type: 'like', rec_id: selectedRec.id, read: false })
      }
    }
  }

  async function handleModalBookmark(e: React.MouseEvent) {
    e.stopPropagation()
    if (!currentUserId || !selectedRec) return
    if (modalBookmarked) {
      await supabase.current.from('bookmarks').delete().eq('user_id', currentUserId).eq('recommendation_id', selectedRec.id)
      setModalBookmarked(false)
    } else {
      await supabase.current.from('bookmarks').insert({ user_id: currentUserId, recommendation_id: selectedRec.id })
      setModalBookmarked(true)
      if (selectedRec.user_id !== currentUserId) {
        supabase.current.from('notifications').insert({ user_id: selectedRec.user_id, actor_id: currentUserId, type: 'bookmark', rec_id: selectedRec.id, read: false })
      }
    }
  }

  async function handleModalComment(e: React.FormEvent) {
    e.preventDefault()
    if (!currentUserId || !selectedRec || !modalCommentInput.trim()) return
    setModalSubmittingComment(true)
    const text = modalCommentInput.trim()
    setModalCommentInput('')
    const { data: inserted, error } = await supabase.current
      .from('comments')
      .insert({ user_id: currentUserId, recommendation_id: selectedRec.id, text })
      .select('*')
      .single()
    if (error) console.error('[Notable] comment insert error:', error.message)
    if (!error && inserted) {
      const newComment: RecComment = { ...inserted, profiles: currentUserProfile, comment_likes: [] }
      setModalComments(prev => sortComments([...prev, newComment]))
      setModalCommentCount(c => c + 1)
      if (selectedRec.user_id !== currentUserId) {
        supabase.current.from('notifications').insert({ user_id: selectedRec.user_id, actor_id: currentUserId, type: 'comment', rec_id: selectedRec.id, read: false })
      }
    }
    setModalSubmittingComment(false)
  }

  // ── Scroll lock ─────────────────────────────────────────────────────────────

  useEffect(() => {
    document.body.style.overflow = (selectedRec || followListModal) ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [selectedRec, followListModal])

  // ── Derived values ──────────────────────────────────────────────────────────

  const filteredRecs = categoryFilter === 'all' ? recs : recs.filter(r => r.category === categoryFilter)
  const accentColor = selectedRec ? (CATEGORY_COLORS[selectedRec.category] ?? '#6b5d4f') : '#6b5d4f'
  const showBookmarked = isOwnProfile || !profile?.bookmarks_private
  const tabs: TabId[] = isOwnProfile
    ? ['posted', 'liked', 'bookmarked']
    : showBookmarked
      ? ['posted', 'bookmarked']
      : ['posted']
  const isPrivateAndGated = profile?.profile_private === true && !isOwnProfile && !isFollowing

  // ── Early returns ───────────────────────────────────────────────────────────

  if (notFound) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '12px' }}>
        <p className="font-display" style={{ fontSize: '1.4rem', fontWeight: 600, color: '#33261a' }}>Profile not found</p>
        <p className="font-body" style={{ color: '#6b5d4f', fontSize: '14px' }}>@{handle} doesn&apos;t exist.</p>
      </div>
    )
  }

  if (profileLoading || !profile) {
    return (
      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '14px 20px 48px' }}>
        {/* Header row */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', marginBottom: '14px' }}>
          <div className="skeleton-pulse" style={{ width: 72, height: 72, borderRadius: '50%', background: '#efe9e0', flexShrink: 0 }} />
          <div style={{ flex: 1, paddingTop: '2px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <div className="skeleton-pulse" style={{ height: 22, width: '42%', borderRadius: 8, background: '#efe9e0' }} />
              <div className="skeleton-pulse" style={{ height: 22, width: 80, borderRadius: 20, background: '#efe9e0' }} />
            </div>
            <div className="skeleton-pulse" style={{ height: 12, width: '22%', borderRadius: 6, background: '#efe9e0', marginBottom: 8 }} />
            <div className="skeleton-pulse" style={{ height: 12, width: '68%', borderRadius: 6, background: '#efe9e0', marginBottom: 10 }} />
            <div style={{ display: 'flex', gap: '8px' }}>
              <div className="skeleton-pulse" style={{ height: 12, width: 64, borderRadius: 6, background: '#efe9e0' }} />
              <div className="skeleton-pulse" style={{ height: 12, width: 64, borderRadius: 6, background: '#efe9e0' }} />
            </div>
          </div>
        </div>
        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(0,0,0,0.08)', marginBottom: '14px', gap: '4px' }}>
          {[60, 56, 68].map((w, i) => (
            <div key={i} className="skeleton-pulse" style={{ height: 14, width: w, borderRadius: 6, background: '#efe9e0', margin: '9px 8px', marginBottom: 10 }} />
          ))}
        </div>
        {/* Category filter row */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
          {[48, 56, 52, 72, 62].map((w, i) => (
            <div key={i} className="skeleton-pulse" style={{ height: 28, width: w, borderRadius: 20, background: '#efe9e0', flexShrink: 0 }} />
          ))}
        </div>
        {/* Feed card skeletons */}
        {[0, 1, 2].map(i => (
          <div key={i} style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.06)', background: '#faf8f4', marginBottom: 12 }}>
            <div className="skeleton-pulse" style={{ height: 160, background: '#efe9e0' }} />
            <div style={{ padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <div className="skeleton-pulse" style={{ width: 28, height: 28, borderRadius: '50%', background: '#efe9e0', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton-pulse" style={{ height: 11, width: '38%', borderRadius: 5, background: '#efe9e0', marginBottom: 5 }} />
                  <div className="skeleton-pulse" style={{ height: 10, width: '24%', borderRadius: 5, background: '#efe9e0' }} />
                </div>
              </div>
              <div className="skeleton-pulse" style={{ height: 14, width: '75%', borderRadius: 6, background: '#efe9e0', marginBottom: 6 }} />
              <div className="skeleton-pulse" style={{ height: 11, width: '90%', borderRadius: 5, background: '#efe9e0', marginBottom: 4 }} />
              <div className="skeleton-pulse" style={{ height: 11, width: '60%', borderRadius: 5, background: '#efe9e0' }} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: translateY(0) } }
        .grid-tile-anim { animation: fadeIn 0.3s ease both; }
        .count-btn { cursor: pointer; background: none; border: none; padding: 0; color: #6b5d4f; font-family: var(--font-body, 'DM Sans', sans-serif); font-size: 13px; }
        .count-btn:hover { color: #a09278; text-decoration: underline; text-underline-offset: 2px; }
      `}</style>

      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '14px 20px 48px' }}>

        {/* ── Profile header ─────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', marginBottom: '14px' }}>

          {/* Avatar */}
          <div style={{ flexShrink: 0, position: 'relative' }}>
            {isOwnProfile ? (
              <button
                onClick={() => avatarInputRef.current?.click()}
                onMouseEnter={() => setAvatarHovered(true)}
                onMouseLeave={() => setAvatarHovered(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, position: 'relative', display: 'block' }}
                title="Change profile photo"
              >
                {profile.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.avatar_url}
                    alt={profile.name ?? ''}
                    style={{
                      width: 72, height: 72, borderRadius: '50%',
                      objectFit: 'cover', border: '2px solid rgba(0,0,0,0.1)',
                      display: 'block',
                      filter: avatarHovered ? 'brightness(0.78)' : 'none',
                      transition: 'filter 0.15s',
                    }}
                  />
                ) : (
                  <div style={{ filter: avatarHovered ? 'brightness(0.78)' : 'none', transition: 'filter 0.15s' }}>
                    <InitialsAvatar name={profile.name} size={72} />
                  </div>
                )}

                {/* Camera badge */}
                <div style={{
                  position: 'absolute', bottom: '1px', right: '1px',
                  width: '22px', height: '22px', borderRadius: '50%',
                  background: 'rgba(0,0,0,0.62)',
                  border: '1.5px solid rgba(0,0,0,0.18)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  pointerEvents: 'none',
                }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2"
                    strokeLinecap="round" strokeLinejoin="round" width="11" height="11">
                    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                </div>

                {/* Upload spinner overlay */}
                {avatarUploading && (
                  <div style={{
                    position: 'absolute', inset: 0, borderRadius: '50%',
                    background: 'rgba(0,0,0,0.52)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" width="18" height="18"
                      style={{ animation: 'spin 0.8s linear infinite' }}>
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                    </svg>
                  </div>
                )}
              </button>
            ) : (
              profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar_url} alt={profile.name ?? ''} style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(0,0,0,0.1)', display: 'block' }} />
              ) : (
                <InitialsAvatar name={profile.name} size={72} />
              )
            )}
            <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp"
              onChange={handleAvatarUpload} style={{ display: 'none' }} />
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0, paddingTop: '2px' }}>

            {/* Name row — name + follow/edit button inline */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '2px', flexWrap: 'wrap' }}>
              <h1 className="font-display" style={{
                fontSize: '1.35rem', fontWeight: 600, color: '#33261a',
                letterSpacing: '-0.02em', lineHeight: 1.2, margin: 0,
              }}>
                {profile.name ?? handle}
              </h1>

              {isOwnProfile ? (
                <button
                  onClick={() => setEditOpen(true)}
                  className="font-body"
                  style={{
                    background: 'transparent', border: '1px solid rgba(0,0,0,0.12)',
                    borderRadius: '20px', padding: '3px 12px',
                    color: '#6b5d4f', fontSize: '12px', cursor: 'pointer',
                    transition: 'border-color 0.15s, color 0.15s',
                    flexShrink: 0,
                  }}
                >
                  Edit Profile
                </button>
              ) : currentUserId ? (
                <button
                  onClick={handleFollow}
                  disabled={followLoading}
                  onMouseEnter={() => setFollowHovered(true)}
                  onMouseLeave={() => setFollowHovered(false)}
                  className="font-body"
                  style={{
                    background: isFollowing
                      ? (followHovered ? 'rgba(212,99,107,0.12)' : 'rgba(0,0,0,0.08)')
                      : 'transparent',
                    border: isFollowing
                      ? `1px solid ${followHovered ? 'rgba(212,99,107,0.5)' : 'rgba(0,0,0,0.15)'}`
                      : '1px solid rgba(0,0,0,0.15)',
                    borderRadius: '20px', padding: '3px 14px',
                    color: isFollowing ? (followHovered ? '#d4636b' : '#33261a') : '#33261a',
                    fontSize: '12px', fontWeight: 500,
                    cursor: followLoading ? 'default' : 'pointer',
                    transition: 'all 0.15s',
                    flexShrink: 0, minWidth: '80px', textAlign: 'center',
                  }}
                >
                  {isFollowing ? (followHovered ? 'Unfollow' : 'Following') : 'Follow'}
                </button>
              ) : null}
            </div>

            {/* Handle */}
            <p className="font-body" style={{ color: '#6b5d4f', fontSize: '13px', marginBottom: '5px' }}>
              @{profile.handle}
            </p>

            {/* Bio */}
            {profile.bio && (
              <p className="font-body" style={{ color: '#33261a', fontSize: '13px', lineHeight: 1.5, marginBottom: '6px' }}>
                {profile.bio}
              </p>
            )}

            {/* Follower / following counts — clickable */}
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <button className="count-btn" onClick={() => setFollowListModal('followers')}>
                {followerCount} {followerCount === 1 ? 'follower' : 'followers'}
              </button>
              <span className="font-body" style={{ color: '#4a4438', fontSize: '13px' }}> · </span>
              <button className="count-btn" onClick={() => setFollowListModal('following')}>
                {followingCount} following
              </button>
            </div>
          </div>
        </div>

        {isPrivateAndGated ? (
          /* ── Private profile locked state ─────────────────────────── */
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            paddingTop: '56px', gap: '10px', textAlign: 'center',
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#6b5d4f" strokeWidth="1.5"
              strokeLinecap="round" strokeLinejoin="round" width="36" height="36">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
            <p className="font-display" style={{ fontSize: '1.15rem', fontWeight: 600, color: '#33261a', marginTop: '6px' }}>
              This profile is private
            </p>
            <p className="font-body" style={{ color: '#6b5d4f', fontSize: '14px', maxWidth: '260px', lineHeight: '1.55' }}>
              Follow {profile.name ?? `@${profile.handle}`} to see their recommendations.
            </p>
          </div>
        ) : (
          <>
            {/* ── Profile identity whisper (own profile only) ─────────── */}
            {isOwnProfile && (
              <div style={{ position: 'relative', height: 0, overflow: 'visible', zIndex: 40, marginBottom: 0 }}>
                <Whisper id="profile-identity" message="This is your taste identity. Only you can see your Bookmarks tab." />
              </div>
            )}

            {/* ── Tab bar ─────────────────────────────────────────────── */}
            <div style={{
              display: 'flex',
              borderBottom: '1px solid rgba(0,0,0,0.08)',
              marginBottom: '14px',
            }}>
              {tabs.map(tab => {
                const active = activeTab === tab
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className="font-body"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: '9px 16px',
                      fontSize: '13px', fontWeight: active ? 600 : 400,
                      color: active ? '#33261a' : '#6b5d4f',
                      borderBottom: active ? '2px solid #3a2a1a' : '2px solid transparent',
                      marginBottom: '-1px',
                      transition: 'color 0.15s',
                    }}
                  >
                    {TAB_LABELS[tab]}
                  </button>
                )
              })}
            </div>

            {/* ── Category filter ─────────────────────────────────────── */}
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', scrollbarWidth: 'none', marginBottom: '16px', paddingBottom: '2px' }}>
              {CATEGORIES.map(cat => {
                const active = categoryFilter === cat
                const color = cat === 'all' ? '#6b5d4f' : CATEGORY_COLORS[cat]
                return (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className="font-body"
                    style={{
                      background: active ? (cat === 'all' ? 'rgba(0,0,0,0.1)' : color) : 'transparent',
                      border: `1px solid ${active ? (cat === 'all' ? 'rgba(0,0,0,0.15)' : color) : 'rgba(0,0,0,0.1)'}`,
                      borderRadius: '20px', padding: '4px 11px',
                      fontSize: '12px', fontWeight: active ? 600 : 400,
                      color: active ? (cat === 'all' ? '#33261a' : '#ffffff') : '#6b5d4f',
                      cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                      transition: 'all 0.13s',
                    }}
                  >
                    {cat === 'all' ? 'All' : CATEGORY_LABELS[cat]}
                  </button>
                )
              })}
            </div>

            {/* ── Grid ────────────────────────────────────────────────── */}
            {recsLoading ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="skeleton-pulse" style={{ aspectRatio: '3/4', borderRadius: '10px', background: '#efe9e0' }} />
                ))}
              </div>
            ) : filteredRecs.length === 0 ? (
              <EmptyTab tab={activeTab} />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}
                className="profile-grid">
                <style>{`@media (max-width: 480px) { .profile-grid { grid-template-columns: repeat(2, 1fr) !important; } }`}</style>
                {filteredRecs.map((rec, i) => (
                  <div key={rec.id} className="grid-tile-anim" style={{ animationDelay: `${Math.min(i * 40, 200)}ms` }}>
                    <GridTile rec={rec} onClick={() => openRecModal(rec)} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Followers / Following modal ───────────────────────────── */}
      {followListModal && profile && (
        <FollowListModal
          type={followListModal}
          profileId={profile.id}
          currentUserId={currentUserId}
          onClose={() => setFollowListModal(null)}
        />
      )}

      {/* ── Edit profile modal ─────────────────────────────────────── */}
      {editOpen && profile && (
        <EditProfileModal
          profile={profile}
          onClose={() => setEditOpen(false)}
          onSave={({ name, bio, avatar_url }) => {
            setProfile(prev => prev ? { ...prev, name, bio, avatar_url } : prev)
            setEditOpen(false)
          }}
        />
      )}

      {/* ── Recommendation modal ───────────────────────────────────── */}
      {selectedRec && (
        <RecModal
          rec={selectedRec}
          accentColor={accentColor}
          liked={modalLiked}
          bookmarked={modalBookmarked}
          likeCount={modalLikeCount}
          commentCount={modalCommentCount}
          comments={modalComments}
          loadingComments={modalLoadingComments}
          commentInput={modalCommentInput}
          submittingComment={modalSubmittingComment}
          currentUserProfile={currentUserProfile}
          currentUserId={currentUserId}
          commentInputRef={commentInputRef}
          focusInput={false}
          onLike={handleModalLike}
          onBookmark={handleModalBookmark}
          onClose={() => setSelectedRec(null)}
          onCommentChange={setModalCommentInput}
          onCommentSubmit={handleModalComment}
          context="profile"
          onRecDeleted={() => {
            setRecs(prev => prev.filter(r => r.id !== selectedRec.id))
            setSelectedRec(null)
          }}
        />
      )}
    </>
  )
}
