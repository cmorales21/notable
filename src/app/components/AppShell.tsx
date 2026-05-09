'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import PostModal from './PostModal'
import SearchDropdown from './SearchDropdown'
import SettingsPanel from './SettingsPanel'
import { createClient } from '@/lib/supabase/client'

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

// ─── Notification types ───────────────────────────────────────────────────────

type NotifType = 'follow' | 'like' | 'bookmark' | 'comment' | 'mention'

type RawNotif = {
  id: string
  type: NotifType
  rec_id: string | null
  read: boolean
  updated_at: string
  actor: { name: string | null; handle: string | null; avatar_url: string | null } | null
  rec: { title: string; category: string } | null
}

type DropdownNotif = {
  key: string
  type: NotifType
  count: number
  ids: string[]
  rec_id: string | null
  read: boolean
  updated_at: string
  actor: { name: string | null; handle: string | null; avatar_url: string | null } | null
  rec: { title: string; category: string } | null
}

function groupNotifs(rows: RawNotif[]): DropdownNotif[] {
  const map = new Map<string, DropdownNotif>()
  for (const row of rows) {
    const key = (row.type === 'like' || row.type === 'bookmark') && row.rec_id
      ? `${row.type}:${row.rec_id}`
      : row.id
    if (!map.has(key)) {
      map.set(key, { key, type: row.type, count: 1, ids: [row.id], rec_id: row.rec_id, read: row.read, updated_at: row.updated_at, actor: row.actor, rec: row.rec })
    } else {
      const g = map.get(key)!
      g.count++
      g.ids.push(row.id)
      if (!row.read) g.read = false
    }
  }
  return Array.from(map.values())
}

function notifText(n: DropdownNotif): string {
  const name = n.actor?.name ?? n.actor?.handle ?? 'Someone'
  const others = n.count - 1
  const suffix = others > 0 ? ` and ${others} other${others > 1 ? 's' : ''}` : ''
  switch (n.type) {
    case 'follow':   return `${name} started following you`
    case 'like':     return `${name}${suffix} liked your recommendation`
    case 'bookmark': return `${name}${suffix} bookmarked your recommendation`
    case 'comment':  return `${name} commented on your recommendation`
    case 'mention':  return `${name} mentioned you in a recommendation`
  }
}

function relTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diffMs / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d`
  if (hours > 0) return `${hours}h`
  if (minutes > 0) return `${minutes}m`
  return 'now'
}

function notifHref(n: DropdownNotif): string | null {
  if (n.type === 'follow') {
    return n.actor?.handle ? `/profile/${n.actor.handle}` : null
  }
  if (n.rec?.category && n.rec_id) return `/${n.rec.category}?rec=${n.rec_id}`
  if (n.rec?.category) return `/${n.rec.category}`
  return null
}

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORIES = [
  { name: 'Books',       href: '/books',       color: '#5271FF', iconSrc: '/icons/books-small.svg',       sidebarPadding: '6px'  },
  { name: 'Movies',      href: '/movies',      color: '#dc4f5c', iconSrc: '/icons/movies-small.svg',      sidebarPadding: '10px' },
  { name: 'Music',       href: '/music',       color: '#4aad4e', iconSrc: '/icons/music-small.svg',       sidebarPadding: '8px'  },
  { name: 'Restaurants', href: '/restaurants', color: '#9055d0', iconSrc: '/icons/restaurants-small.svg', sidebarPadding: '6px'  },
  { name: 'Podcasts',    href: '/podcasts',    color: '#d4920a', iconSrc: '/icons/podcasts-small.svg',    sidebarPadding: '6px'  },
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
  const [previewNotifs, setPreviewNotifs] = useState<DropdownNotif[]>([])
  const [previewLoading, setPreviewLoading] = useState(false)

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
          console.error('[Notable] bell unread check failed:', error.message)
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

  // ── Fetch preview notifications when dropdown opens ─────────────────────────
  useEffect(() => {
    if (!dropdownOpen) return
    const supabase = supabaseRef.current
    setPreviewLoading(true)

    supabase
      .from('notifications')
      .select(`
        id, type, rec_id, read, updated_at,
        actor:profiles!actor_id(name, handle, avatar_url),
        rec:recommendations!rec_id(title, category)
      `)
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(30)
      .then(({ data, error }) => {
        if (error) {
          console.error('[Notable] dropdown fetch failed:', error.message)
        } else {
          const grouped = groupNotifs((data as unknown as RawNotif[]) ?? [])
          setPreviewNotifs(grouped.slice(0, 5))
        }
        setPreviewLoading(false)
      })
  }, [dropdownOpen, userId])

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

        <div className="flex items-center gap-6">
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
                  position: 'absolute', top: '-1px', right: '-1px',
                  width: '7px', height: '7px', borderRadius: '50%',
                  background: '#e85d5d', border: isLobby ? '1.5px solid #f5f0e8' : '1.5px solid var(--color-background)',
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
                  previewNotifs.map(n => (
                    <button
                      key={n.key}
                      onClick={() => {
                        markRead(n.ids)
                        setDropdownOpen(false)
                        const href = notifHref(n)
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
                      {/* Avatar */}
                      {n.actor?.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={n.actor.avatar_url}
                          alt={n.actor.name ?? ''}
                          width={28} height={28}
                          style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, marginTop: '1px' }}
                        />
                      ) : (
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%', flexShrink: 0, marginTop: '1px',
                          background: 'rgba(0,0,0,0.08)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '11px', color: '#6b5d4f',
                        }}>
                          {n.actor?.name?.charAt(0).toUpperCase() ?? '?'}
                        </div>
                      )}

                      {/* Text + time */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p className="font-body" style={{
                          fontSize: '13px', lineHeight: '1.45',
                          color: n.read ? '#b0a290' : '#33261a',
                          marginBottom: '2px',
                          whiteSpace: 'normal',
                        }}>
                          {notifText(n)}
                        </p>
                        <span className="font-body" style={{ fontSize: '11px', color: '#6b5d4f' }}>
                          {relTime(n.updated_at)}
                        </span>
                      </div>

                      {/* Unread dot */}
                      {!n.read && (
                        <span style={{
                          width: 6, height: 6, borderRadius: '50%',
                          background: '#e85d5d', flexShrink: 0, marginTop: '7px',
                        }} />
                      )}
                    </button>
                  ))
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

          <Link href={profile?.handle ? `/profile/${profile.handle}` : '/profile'} style={{ display: 'block', lineHeight: 0 }}>
            {profile?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar_url}
                alt={profile.name ?? 'Profile'}
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
          {CATEGORIES.map(({ name, href, color, iconSrc, sidebarPadding }) => (
            <Link
              key={href}
              href={href}
              title={name}
              className="app-cat-btn rounded-xl"
              style={{ width: '48px', height: '48px', background: color, padding: sidebarPadding, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={iconSrc} alt={name} style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'brightness(0) invert(1)', opacity: 0.92, display: 'block' }} />
            </Link>
          ))}
        </aside>
      )}

      {/* ── Main content ──────────────────────────────────────────── */}
      <main
        className={!isLobby ? 'md:pl-[72px] pb-16 md:pb-0' : 'pb-16 md:pb-0'}
        style={{ paddingTop: '56px' }}
      >
        {children}
      </main>

      {/* ── Floating + button ─────────────────────────────────────── */}
      <button
        onClick={() => setPostModalOpen(true)}
        className="float-btn fixed right-5 z-50 flex items-center justify-center rounded-full bottom-[80px] md:bottom-6"
        style={{
          width: '56px',
          height: '56px',
          background: isLobby ? '#3a2a1a' : '#3a2a1a',
          color: isLobby ? '#f0ead8' : '#f5f0e8',
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
          {CATEGORIES.map(({ name, href, color, iconSrc, sidebarPadding }) => (
            <Link
              key={href}
              href={href}
              title={name}
              className="app-cat-btn rounded-xl"
              style={{ width: '44px', height: '44px', background: color, padding: sidebarPadding, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={iconSrc} alt={name} style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'brightness(0) invert(1)', opacity: 0.92, display: 'block' }} />
            </Link>
          ))}
        </nav>
      )}

    </div>
  )
}
