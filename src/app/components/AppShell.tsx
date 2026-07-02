'use client'

import Link from 'next/link'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/app/components/Toast'
import { CATEGORY_COLORS, CATEGORY_LABELS } from '@/app/lib/theme'
import {
  type RawNotif,
  type GroupedNotif,
  groupNotifications,
  getRelTimeCompact,
  getNotifText,
  getNotifHref,
} from '@/lib/notifications'

const PostModal = dynamic(() => import('./PostModal'), { ssr: false })
const SearchDropdown = dynamic(() => import('./SearchDropdown'), { ssr: false })
const SettingsPanel = dynamic(() => import('./SettingsPanel'), { ssr: false })

interface Profile {
  name: string | null
  handle: string | null
  avatar_url: string | null
}

interface AppShellProps {
  profile: Profile | null
  userId: string
  children: React.ReactNode
}

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORIES = [
  { name: CATEGORY_LABELS.books,       href: '/books',       color: CATEGORY_COLORS.books,       iconSrc: '/icons/books-small.svg',       sidebarPadding: '6px'  },
  { name: CATEGORY_LABELS.movies,      href: '/movies',      color: CATEGORY_COLORS.movies,      iconSrc: '/icons/movies-small.svg',      sidebarPadding: '10px' },
  { name: CATEGORY_LABELS.music,       href: '/music',       color: CATEGORY_COLORS.music,       iconSrc: '/icons/music-small.svg',       sidebarPadding: '8px'  },
  { name: CATEGORY_LABELS.restaurants, href: '/restaurants', color: CATEGORY_COLORS.restaurants, iconSrc: '/icons/restaurants-small.svg', sidebarPadding: '6px'  },
  { name: CATEGORY_LABELS.podcasts,    href: '/podcasts',    color: CATEGORY_COLORS.podcasts,    iconSrc: '/icons/podcasts-small.svg',    sidebarPadding: '6px'  },
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function AppShell({ profile, userId, children }: AppShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const isLobby = pathname === '/lobby'
  const [postModalOpen, setPostModalOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Notification state
  const [hasUnread, setHasUnread] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [previewNotifs, setPreviewNotifs] = useState<GroupedNotif[]>([])
  const [previewLoading, setPreviewLoading] = useState(false)

  const toast = useToast()
  // Stable client ref — created once, reused across effects
  const supabaseRef = useRef(createClient())

  // Refs for outside-click detection
  const bellRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchBtnRef = useRef<HTMLButtonElement>(null)
  const searchPanelRef = useRef<HTMLDivElement>(null)

  const initial = profile?.name
    ? profile.name.charAt(0).toUpperCase()
    : '?'

  // Seeded from the server-rendered prop; updated client-side via custom event
  // so avatar changes in Settings/profile reflect immediately without a reload.
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatar_url ?? null)

  // ── Initial unread check + realtime subscription ────────────────────────────
  useEffect(() => {
    const supabase = supabaseRef.current

    supabase
      .from('notifications')
      .select('id')
      .eq('user_id', userId)
      .eq('read', false)
      .limit(1)
      .then(({ data, error }) => {
        if (error) {
          if (process.env.NODE_ENV !== 'production') console.error('[Notable] bell unread check failed:', error.message)
          return
        }
        if (data && data.length > 0) setHasUnread(true)
      })

    const filter = `user_id=eq.${userId}`
    const channel = supabase
      .channel(`notif-bell-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter },
        (payload) => {
          const isUnread =
            payload.eventType === 'INSERT' ||
            (payload.eventType === 'UPDATE' && !(payload.new as { read: boolean }).read)
          if (isUnread) setHasUnread(true)
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  // ── Clear dot when the user navigates to /notifications ────────────────────
  useEffect(() => {
    if (pathname === '/notifications') {
      setHasUnread(false)
      setDropdownOpen(false)
    }
  }, [pathname])

  // ── Fetch preview notifications ─────────────────────────────────────────────
  const fetchGroupedNotifs = useCallback(async () => {
    setPreviewLoading(true)
    const supabase = supabaseRef.current
    const [{ data, error }, { data: blockData }] = await Promise.all([
      supabase
        .from('notifications')
        .select(`
          id, type, rec_id, collection_id, read, updated_at, actor_id,
          actor:profiles!actor_id(name, handle, avatar_url),
          rec:recommendations!rec_id(title, category)
        `)
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(30),
      supabase
        .from('user_blocks')
        .select('blocked_id, blocker_id')
        .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`),
    ])
    if (error) {
      if (process.env.NODE_ENV !== 'production') console.error('[Notable] dropdown fetch failed:', error.message)
    } else {
      const blockedIds = new Set<string>()
      for (const r of (blockData ?? []) as { blocker_id: string; blocked_id: string }[]) {
        blockedIds.add(r.blocker_id === userId ? r.blocked_id : r.blocker_id)
      }
      const filtered = ((data ?? []) as unknown as RawNotif[]).filter(n => !n.actor_id || !blockedIds.has(n.actor_id))
      const grouped = groupNotifications(filtered)
      setPreviewNotifs(grouped.slice(0, 5))
    }
    setPreviewLoading(false)
  }, [userId])

  useEffect(() => {
    if (!dropdownOpen) return
    fetchGroupedNotifs()
  }, [dropdownOpen, fetchGroupedNotifs])

  // Refetch the dropdown if it's open when a follow request is accepted/declined
  // on the notifications page (keeps both in sync without a shared context).
  useEffect(() => {
    const handler = () => { if (dropdownOpen) fetchGroupedNotifs() }
    window.addEventListener('follow-request-updated', handler)
    return () => window.removeEventListener('follow-request-updated', handler)
  }, [dropdownOpen, fetchGroupedNotifs])

  // ── Sync nav avatar when the user uploads a new photo ──────────────────────
  useEffect(() => {
    function onAvatarUpdated(e: Event) {
      const { url } = (e as CustomEvent<{ url: string | null }>).detail
      setAvatarUrl(url)
    }
    window.addEventListener('notable:avatar-updated', onAvatarUpdated)
    return () => window.removeEventListener('notable:avatar-updated', onAvatarUpdated)
  }, [])

  // ── Close notification dropdown on outside click ────────────────────────────
  useEffect(() => {
    if (!dropdownOpen) return
    function onMouseDown(e: MouseEvent) {
      const t = e.target as Node
      if (bellRef.current?.contains(t) || dropdownRef.current?.contains(t)) return
      setDropdownOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [dropdownOpen])

  // ── Close search dropdown on outside click ──────────────────────────────────
  useEffect(() => {
    if (!searchOpen) return
    function onMouseDown(e: MouseEvent) {
      const t = e.target as Node
      if (searchBtnRef.current?.contains(t) || searchPanelRef.current?.contains(t)) return
      setSearchOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [searchOpen])

  // ── Mark a group of notifications as read ──────────────────────────────────
  async function markRead(ids: string[]) {
    setPreviewNotifs(prev => prev.map(n => ids.some(id => n.ids.includes(id)) ? { ...n, read: true } : n))
    const supabase = supabaseRef.current
    await supabase.from('notifications').update({ read: true }).in('id', ids)
    const { data } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', userId)
      .eq('read', false)
      .limit(1)
    if (!data || data.length === 0) setHasUnread(false)
  }

  // ── Follow request actions ──────────────────────────────────────────────────
  // Accepting triggers the Postgres fn_notify_follow (UPDATE branch), which
  // creates a follow_request_accepted notification for the requester.
  // No manual notification insert needed here.
  async function acceptFollowRequest(notif: GroupedNotif) {
    if (!notif.actor_id) return
    const supabase = supabaseRef.current
    await supabase.from('follows').update({ status: 'accepted' })
      .eq('follower_id', notif.actor_id).eq('following_id', userId)
    await supabase.from('notifications').delete().in('id', notif.ids)
    setPreviewNotifs(prev => prev.filter(n => n.key !== notif.key))
    const { data } = await supabase.from('notifications').select('id').eq('user_id', userId).eq('read', false).limit(1)
    if (!data || data.length === 0) setHasUnread(false)
    window.dispatchEvent(new Event('follow-request-updated'))
    toast('Follow request accepted')
  }

  async function declineFollowRequest(notif: GroupedNotif) {
    if (!notif.actor_id) return
    const supabase = supabaseRef.current
    await supabase.from('follows').delete()
      .eq('follower_id', notif.actor_id).eq('following_id', userId)
    await supabase.from('notifications').delete().in('id', notif.ids)
    setPreviewNotifs(prev => prev.filter(n => n.key !== notif.key))
    window.dispatchEvent(new Event('follow-request-updated'))
    toast('Request declined')
  }

  return (
    <div style={{ background: isLobby ? '#f5f0e8' : 'var(--color-background)', minHeight: '100vh' }}>

      {/* ── Top nav ───────────────────────────────────────────────── */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-5"
        style={{
          height: '56px',
          background: isLobby ? '#f5f0e8' : '#f5f0e8',
          borderBottom: isLobby ? '1px solid rgba(26,24,20,0.08)' : '1px solid rgba(0,0,0,0.08)',
        }}
      >
        {isLobby ? (
          <Link
            href="/lobby"
            className="select-none"
            style={{
              fontFamily: 'var(--font-climate-crisis)',
              fontSize: '1.85rem',
              fontWeight: 400,
              letterSpacing: '0.04em',
              color: '#33261a',
              textTransform: 'uppercase',
              textDecoration: 'none',
              lineHeight: 1,
            }}
          >
            NOTABLE
          </Link>
        ) : (
          <Link
            href="/lobby"
            className="select-none"
            style={{
              fontFamily: 'var(--font-climate-crisis)',
              fontSize: '1.85rem',
              fontWeight: 400,
              letterSpacing: '0.04em',
              color: '#33261a',
              textTransform: 'uppercase',
              textDecoration: 'none',
              lineHeight: 1,
            }}
          >
            NOTABLE
          </Link>
        )}

        <div className="flex items-center gap-3 sm:gap-6">
          <button
            ref={searchBtnRef}
            onClick={() => { setSearchOpen(o => !o); setDropdownOpen(false) }}
            aria-label="Search"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', lineHeight: 0, padding: 0,
              color: isLobby
                ? (searchOpen ? '#33261a' : '#6b5d4f')
                : (searchOpen ? '#33261a' : '#6b5d4f'),
              transition: 'color 0.15s',
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          </button>

          {/* ── Bell button + dropdown ─────────────────────────── */}
          <div style={{ position: 'relative' }}>
            <button
              ref={bellRef}
              onClick={() => { setDropdownOpen(o => !o); setSearchOpen(false) }}
              aria-label="Notifications"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', lineHeight: 0, padding: 0,
                color: isLobby
                  ? (dropdownOpen ? '#33261a' : '#6b5d4f')
                  : (dropdownOpen ? '#33261a' : '#6b5d4f'),
                transition: 'color 0.15s',
                position: 'relative',
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 01-3.46 0" />
              </svg>
              {hasUnread && pathname !== '/notifications' && (
                <span style={{
                  position: 'absolute', top: '-4px', right: '-4px',
                  width: '12px', height: '12px', borderRadius: '50%',
                  background: '#e05555',
                }} />
              )}
            </button>

            {/* Dropdown panel */}
            {dropdownOpen && (
              <div
                ref={dropdownRef}
                style={{
                  position: 'absolute',
                  top: '34px',
                  right: '0',
                  width: '300px',
                  maxWidth: 'calc(100vw - 24px)',
                  background: '#faf8f4',
                  border: '1px solid rgba(0,0,0,0.1)',
                  borderRadius: '12px',
                  boxShadow: '0 12px 40px rgba(58,42,26,0.15)',
                  zIndex: 200,
                  overflow: 'hidden',
                }}
              >
                {/* Header */}
                <div style={{
                  padding: '12px 14px 8px',
                  borderBottom: '1px solid rgba(0,0,0,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span className="font-body" style={{ fontSize: '13px', fontWeight: 600, color: '#33261a', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    Notifications
                  </span>
                </div>

                {/* Notification rows */}
                {previewLoading ? (
                  <div style={{ padding: '20px 14px', textAlign: 'center' }}>
                    <span className="font-body" style={{ fontSize: '13px', color: '#6b5d4f' }}>Loading…</span>
                  </div>
                ) : previewNotifs.length === 0 ? (
                  <div style={{ padding: '24px 14px', textAlign: 'center' }}>
                    <span className="font-body" style={{ fontSize: '13px', color: '#6b5d4f' }}>No notifications yet</span>
                  </div>
                ) : (
                  previewNotifs.map(n => {
                    const avatar = n.actor?.avatar_url ? (
                      <Image src={n.actor.avatar_url} alt={n.actor.name ?? ''} width={28} height={28}
                        style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0, marginTop: '1px' }} />
                    ) : (
                      <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, marginTop: '1px', background: 'rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: '#6b5d4f' }}>
                        {n.actor?.name?.charAt(0).toUpperCase() ?? '?'}
                      </div>
                    )

                    if (n.type === 'follow_request') {
                      return (
                        <div key={n.key} style={{ padding: '10px 14px', borderBottom: '1px solid rgba(0,0,0,0.04)', background: n.read ? 'transparent' : 'rgba(0,0,0,0.02)' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '8px' }}>
                            {avatar}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p className="font-body" style={{ fontSize: '13px', lineHeight: '1.45', color: n.read ? '#b0a290' : '#33261a', marginBottom: '2px', whiteSpace: 'normal' }}>
                                {getNotifText(n)}
                              </p>
                              <span className="font-body" style={{ fontSize: '11px', color: '#6b5d4f' }}>{getRelTimeCompact(n.updated_at)}</span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '6px', paddingLeft: '38px' }}>
                            <button
                              onClick={() => acceptFollowRequest(n)}
                              className="font-body"
                              style={{ flex: 1, background: '#33261a', border: 'none', borderRadius: '6px', color: '#f5f0e8', fontSize: '12px', fontWeight: 600, padding: '6px 0', cursor: 'pointer' }}
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => declineFollowRequest(n)}
                              className="font-body"
                              style={{ flex: 1, background: 'rgba(0,0,0,0.07)', border: 'none', borderRadius: '6px', color: '#6b5d4f', fontSize: '12px', padding: '6px 0', cursor: 'pointer' }}
                            >
                              Decline
                            </button>
                          </div>
                        </div>
                      )
                    }

                    return (
                      <button
                        key={n.key}
                        onClick={() => {
                          markRead(n.ids)
                          setDropdownOpen(false)
                          const href = getNotifHref(n)
                          if (href) router.push(href)
                        }}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'flex-start',
                          gap: '10px', padding: '10px 14px',
                          background: n.read ? 'transparent' : 'rgba(0,0,0,0.02)',
                          border: 'none', borderBottom: '1px solid rgba(0,0,0,0.04)',
                          cursor: 'pointer', textAlign: 'left',
                        }}
                      >
                        {avatar}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p className="font-body" style={{ fontSize: '13px', lineHeight: '1.45', color: n.read ? '#b0a290' : '#33261a', marginBottom: '2px', whiteSpace: 'normal' }}>
                            {getNotifText(n)}
                          </p>
                          <span className="font-body" style={{ fontSize: '11px', color: '#6b5d4f' }}>{getRelTimeCompact(n.updated_at)}</span>
                        </div>
                        {!n.read && (
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#e05555', flexShrink: 0, marginTop: '7px' }} />
                        )}
                      </button>
                    )
                  })
                )}

                {/* Footer — link to full page */}
                <Link
                  href="/notifications"
                  onClick={() => setDropdownOpen(false)}
                  className="font-body"
                  style={{
                    display: 'block', textAlign: 'center',
                    padding: '10px 14px',
                    fontSize: '13px', color: '#6b5d4f',
                    textDecoration: 'none',
                    borderTop: '1px solid rgba(0,0,0,0.08)',
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#33261a')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#6b5d4f')}
                >
                  See all notifications →
                </Link>
              </div>
            )}
          </div>

          <button
            onClick={() => setSettingsOpen(o => !o)}
            aria-label="Settings"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', lineHeight: 0, padding: 0,
              color: isLobby
                ? (settingsOpen ? '#33261a' : '#6b5d4f')
                : (settingsOpen ? '#33261a' : '#6b5d4f'),
              transition: 'color 0.15s',
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </button>

          <Link href={profile?.handle ? `/profile/${profile.handle}` : '/profile'} style={{ display: 'block', lineHeight: 0, flexShrink: 0 }}>
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={profile?.name ?? 'Profile'}
                width={36}
                height={36}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: isLobby ? '1px solid rgba(26,24,20,0.18)' : '1px solid rgba(0,0,0,0.12)',
                }}
              />
            ) : (
              <div
                className="flex items-center justify-center font-body font-medium select-none"
                style={{
                  width: '36px',
                  height: '36px',
                  flexShrink: 0,
                  borderRadius: '50%',
                  background: isLobby ? '#e0d8cc' : '#e8e0d4',
                  border: isLobby ? '1px solid rgba(26,24,20,0.18)' : '1px solid rgba(0,0,0,0.12)',
                  color: isLobby ? '#2a2218' : '#33261a',
                  fontSize: '0.875rem',
                }}
              >
                {initial}
              </div>
            )}
          </Link>
        </div>
      </header>

      {/* ── Desktop sidebar (hidden on lobby) ─────────────────────── */}
      {!isLobby && (
        <aside
          className="hidden md:flex fixed flex-col items-center py-5 gap-3 z-40"
          style={{
            top: '56px',
            left: 0,
            bottom: 0,
            width: '72px',
            background: '#f5f0e8',
          }}
        >
          {CATEGORIES.map(({ name, href, color, iconSrc, sidebarPadding }) => {
            const iconPx = 48 - 2 * parseInt(sidebarPadding)
            return (
              <Link
                key={href}
                href={href}
                title={name}
                className="app-cat-btn rounded-xl"
                style={{ width: '48px', height: '48px', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
              >
                <Image src={iconSrc} alt={name} width={iconPx} height={iconPx} style={{ width: iconPx, height: iconPx, objectFit: 'contain', filter: 'brightness(0) invert(1)', opacity: 0.92 }} />
              </Link>
            )
          })}
        </aside>
      )}

      {/* ── Main content ──────────────────────────────────────────── */}
      <main
        className={!isLobby ? 'md:pl-[72px] pb-16 md:pb-0' : 'pb-16 md:pb-0'}
        style={{ paddingTop: '56px' }}
      >
        <div key={pathname} className={isLobby ? undefined : 'page-enter'}>
          {children}
        </div>
      </main>

      {/* ── Floating + button ─────────────────────────────────────── */}
      <button
        onClick={() => setPostModalOpen(true)}
        className="float-btn fixed right-5 z-50 flex items-center justify-center rounded-full bottom-[80px] md:bottom-6"
        style={{
          width: '56px',
          height: '56px',
          background: '#33261a',
          color: '#f5f0e8',
          boxShadow: isLobby ? '0 8px 28px rgba(58,42,26,0.25)' : '0 8px 28px rgba(58,42,26,0.2)',
          border: 'none',
          cursor: 'pointer',
        }}
        aria-label="Post a recommendation"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" width="22" height="22">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      {/* ── Post modal ────────────────────────────────────────────── */}
      {postModalOpen && (
        <PostModal onClose={() => setPostModalOpen(false)} />
      )}

      {/* ── Search dropdown ───────────────────────────────────────── */}
      {searchOpen && (
        <SearchDropdown onClose={() => setSearchOpen(false)} panelRef={searchPanelRef} />
      )}

      {/* ── Settings panel ────────────────────────────────────────── */}
      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        userId={userId}
        initialProfile={profile}
      />

      {/* ── Mobile bottom nav (hidden on lobby) ───────────────────── */}
      {!isLobby && (
        <nav
          className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-center gap-2 px-2"
          style={{
            height: '64px',
            background: '#f5f0e8',
          }}
        >
          {CATEGORIES.map(({ name, href, color, iconSrc, sidebarPadding }) => {
            const iconPx = 44 - 2 * parseInt(sidebarPadding)
            return (
              <Link
                key={href}
                href={href}
                title={name}
                className="app-cat-btn rounded-xl"
                style={{ width: '44px', height: '44px', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
              >
                <Image src={iconSrc} alt={name} width={iconPx} height={iconPx} style={{ width: iconPx, height: iconPx, objectFit: 'contain', filter: 'brightness(0) invert(1)', opacity: 0.92 }} />
              </Link>
            )
          })}
        </nav>
      )}

    </div>
  )
}
