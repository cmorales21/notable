'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────

type NotifType = 'follow' | 'follow_request' | 'follow_request_accepted' | 'like' | 'bookmark' | 'comment' | 'mention'

type RawNotif = {
  id: string
  type: NotifType
  rec_id: string | null
  read: boolean
  updated_at: string
  actor_id: string | null
  actor: { name: string | null; handle: string | null; avatar_url: string | null } | { name: string | null; handle: string | null; avatar_url: string | null }[] | null
  rec: { title: string; category: string } | null
}

type GroupedNotif = {
  key: string
  type: NotifType
  count: number
  ids: string[]
  rec_id: string | null
  read: boolean
  updated_at: string
  actor_id: string | null
  actor: { name: string | null; handle: string | null; avatar_url: string | null } | null
  rec: { title: string; category: string } | null
}

interface FollowRequest {
  actor_id: string
  name: string | null
  handle: string | null
  avatar_url: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveActor(raw: RawNotif['actor']): { name: string | null; handle: string | null; avatar_url: string | null } | null {
  if (!raw) return null
  if (Array.isArray(raw)) return raw[0] ?? null
  return raw
}

function groupNotifications(rows: RawNotif[]): GroupedNotif[] {
  const map = new Map<string, GroupedNotif>()
  for (const row of rows) {
    const key = (row.type === 'like' || row.type === 'bookmark') && row.rec_id
      ? `${row.type}:${row.rec_id}`
      : row.id
    const actor = resolveActor(row.actor)
    if (!map.has(key)) {
      map.set(key, { key, type: row.type, count: 1, ids: [row.id], rec_id: row.rec_id, read: row.read, updated_at: row.updated_at, actor_id: row.actor_id, actor, rec: row.rec })
    } else {
      const g = map.get(key)!
      g.count++
      g.ids.push(row.id)
      if (!row.read) g.read = false
    }
  }
  return Array.from(map.values())
}

function formatRelativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diffMs / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return 'just now'
}

function notificationText(n: GroupedNotif): string {
  const name = n.actor?.name ?? n.actor?.handle ?? 'Someone'
  const others = n.count - 1
  const suffix = others > 0 ? ` and ${others} other${others > 1 ? 's' : ''}` : ''
  switch (n.type) {
    case 'follow':                   return `${name} started following you`
    case 'follow_request':           return `${name} wants to follow you`
    case 'follow_request_accepted':  return `${name} accepted your follow request`
    case 'like':                     return `${name}${suffix} liked your recommendation`
    case 'bookmark':                 return `${name}${suffix} bookmarked your recommendation`
    case 'comment':                  return `${name} commented on your recommendation`
    case 'mention':                  return `${name} mentioned you in a recommendation`
  }
}

function TypeIcon({ type }: { type: NotifType }) {
  const size = 14
  const stroke = '#6b5d4f'
  const w = { fill: 'none', stroke, strokeWidth: '1.8', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, width: size, height: size }
  if (type === 'follow' || type === 'follow_request' || type === 'follow_request_accepted') return <svg viewBox="0 0 24 24" {...w}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
  if (type === 'like') return <svg viewBox="0 0 24 24" {...w}><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/><path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/></svg>
  if (type === 'bookmark') return <svg viewBox="0 0 24 24" {...w}><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>
  if (type === 'comment') return <svg viewBox="0 0 24 24" {...w}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
  return <svg viewBox="0 0 24 24" {...w}><circle cx="12" cy="12" r="10"/><path d="M12 8h.01M12 12v4"/></svg>
}

function notifHref(n: GroupedNotif): string | null {
  if (n.type === 'follow') return n.actor?.handle ? `/profile/${n.actor.handle}` : null
  if (n.type === 'follow_request') return null
  if (n.type === 'follow_request_accepted') return n.actor?.handle ? `/profile/${n.actor.handle}` : null
  if (n.rec?.category && n.rec_id) return `/${n.rec.category}?rec=${n.rec_id}`
  if (n.rec?.category) return `/${n.rec.category}`
  return null
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ src, name }: { src: string | null | undefined; name: string | null | undefined }) {
  const initial = name?.charAt(0).toUpperCase() ?? '?'
  if (src) {
    return (
      <Image
        src={src}
        alt={name ?? ''}
        width={36}
        height={36}
        style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    )
  }
  return (
    <div style={{
      width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
      background: 'var(--color-surface)',
      border: '1px solid rgba(0,0,0,0.1)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '14px', color: 'var(--color-text)',
    }}>
      {initial}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<GroupedNotif[]>([])
  const [followRequests, setFollowRequests] = useState<FollowRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const userIdRef = useRef<string | null>(null)
  const blockedIdsRef = useRef(new Set<string>())

  useEffect(() => {
    const supabase = createClient()

    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const uid = user.id
      userIdRef.current = uid
      setUserId(uid)

      const [{ data: notifData, error: notifError }, { data: blockData }] = await Promise.all([
        supabase
          .from('notifications')
          .select(`
            id, type, rec_id, read, updated_at, actor_id,
            actor:profiles!actor_id(name, handle, avatar_url),
            rec:recommendations!rec_id(title, category)
          `)
          .eq('user_id', uid)
          .order('updated_at', { ascending: false })
          .limit(60),
        supabase
          .from('user_blocks')
          .select('blocked_id, blocker_id')
          .or(`blocker_id.eq.${uid},blocked_id.eq.${uid}`),
      ])

      if (notifError) {
        if (process.env.NODE_ENV !== 'production') console.error('[Notable] notifications fetch failed:', notifError.message)
        setLoading(false)
        return
      }

      const ids = new Set<string>()
      for (const r of (blockData ?? []) as { blocker_id: string; blocked_id: string }[]) {
        ids.add(r.blocker_id === uid ? r.blocked_id : r.blocker_id)
      }
      blockedIdsRef.current = ids

      const allRows = ((notifData ?? []) as unknown as RawNotif[]).filter(n => !n.actor_id || !ids.has(n.actor_id))

      // Derive follow requests from the notifications table — same source as the
      // AppShell dropdown, so they're guaranteed to be present if the dropdown works.
      const requests: FollowRequest[] = allRows
        .filter(n => n.type === 'follow_request' && n.actor_id)
        .map(n => {
          const actor = resolveActor(n.actor)
          return { actor_id: n.actor_id!, name: actor?.name ?? null, handle: actor?.handle ?? null, avatar_url: actor?.avatar_url ?? null }
        })
      setFollowRequests(requests)

      const regularRows = allRows.filter(n => n.type !== 'follow_request')
      setNotifications(groupNotifications(regularRows))
      setLoading(false)

      await supabase.from('notifications').update({ read: true }).eq('user_id', uid).eq('read', false)
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    })()

    // When a new notification arrives, fetch just that one row (with joins) and prepend it
    const channel = supabase
      .channel('notif-page')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        async (payload) => {
          const newRow = payload.new as { id: string; user_id: string; type: NotifType; actor_id: string | null }
          if (newRow.user_id !== userIdRef.current) return
          if (newRow.actor_id && blockedIdsRef.current.has(newRow.actor_id)) return

          const { data } = await supabase
            .from('notifications')
            .select(`
              id, type, rec_id, read, updated_at, actor_id,
              actor:profiles!actor_id(name, handle, avatar_url),
              rec:recommendations!rec_id(title, category)
            `)
            .eq('id', newRow.id)
            .single()

          if (!data) return
          const row = data as unknown as RawNotif
          const actor = resolveActor(row.actor)

          if (row.type === 'follow_request' && row.actor_id) {
            setFollowRequests(prev => {
              if (prev.some(r => r.actor_id === row.actor_id)) return prev
              return [...prev, { actor_id: row.actor_id!, name: actor?.name ?? null, handle: actor?.handle ?? null, avatar_url: actor?.avatar_url ?? null }]
            })
            return
          }

          await supabase.from('notifications').update({ read: true }).eq('id', newRow.id)

          setNotifications(prev => {
            // For likes/bookmarks on the same rec, merge into the existing group
            if ((row.type === 'like' || row.type === 'bookmark') && row.rec_id) {
              const existingIdx = prev.findIndex(n => n.type === row.type && n.rec_id === row.rec_id)
              if (existingIdx >= 0) {
                const updated = [...prev]
                updated[existingIdx] = { ...updated[existingIdx], count: updated[existingIdx].count + 1, ids: [...updated[existingIdx].ids, row.id], read: true }
                return updated
              }
            }
            const groupKey = (row.type === 'like' || row.type === 'bookmark') && row.rec_id
              ? `${row.type}:${row.rec_id}`
              : row.id
            const newNotif: GroupedNotif = { key: groupKey, type: row.type, count: 1, ids: [row.id], rec_id: row.rec_id, read: true, updated_at: row.updated_at, actor_id: row.actor_id, actor, rec: row.rec }
            return [newNotif, ...prev]
          })
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  // Refetch follow requests when the AppShell dropdown accepts/declines one,
  // so both the page and the dropdown stay in sync.
  useEffect(() => {
    async function refetchFollowRequests() {
      const uid = userIdRef.current
      if (!uid) return
      const supabase = createClient()
      const { data } = await supabase
        .from('notifications')
        .select(`id, type, rec_id, read, updated_at, actor_id,
                 actor:profiles!actor_id(name, handle, avatar_url)`)
        .eq('user_id', uid)
        .eq('type', 'follow_request')
      const requests: FollowRequest[] = ((data ?? []) as unknown as RawNotif[])
        .filter(n => n.actor_id && !blockedIdsRef.current.has(n.actor_id))
        .map(n => {
          const actor = resolveActor(n.actor)
          return { actor_id: n.actor_id!, name: actor?.name ?? null, handle: actor?.handle ?? null, avatar_url: actor?.avatar_url ?? null }
        })
      setFollowRequests(requests)
    }
    window.addEventListener('follow-request-updated', refetchFollowRequests)
    return () => window.removeEventListener('follow-request-updated', refetchFollowRequests)
  }, [])

  // Accepting triggers the Postgres fn_notify_follow (UPDATE branch), which
  // creates a follow_request_accepted notification for the requester.
  // No manual notification insert needed here.
  async function handleAcceptRequest(actorId: string) {
    if (!userId) return
    const supabase = createClient()
    await supabase.from('follows').update({ status: 'accepted' })
      .eq('follower_id', actorId).eq('following_id', userId)
    await supabase.from('notifications').delete()
      .eq('user_id', userId).eq('actor_id', actorId).eq('type', 'follow_request')
    setFollowRequests(prev => prev.filter(r => r.actor_id !== actorId))
    window.dispatchEvent(new Event('follow-request-updated'))
  }

  async function handleDeclineRequest(actorId: string) {
    if (!userId) return
    const supabase = createClient()
    await supabase.from('follows').delete()
      .eq('follower_id', actorId).eq('following_id', userId)
    await supabase.from('notifications').delete()
      .eq('user_id', userId).eq('actor_id', actorId).eq('type', 'follow_request')
    setFollowRequests(prev => prev.filter(r => r.actor_id !== actorId))
    window.dispatchEvent(new Event('follow-request-updated'))
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '24px 16px 40px' }}>
      <h1
        className="font-display font-bold"
        style={{ fontSize: '1.4rem', letterSpacing: '-0.02em', color: 'var(--color-text)', marginBottom: '20px' }}
      >
        Notifications
      </h1>

      {loading && (
        <p className="font-body" style={{ color: 'var(--color-muted)', fontSize: '14px' }}>
          Loading…
        </p>
      )}

      {!loading && notifications.length === 0 && followRequests.length === 0 && (
        <div style={{ textAlign: 'center', paddingTop: '60px' }}>
          <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'center' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#6b5d4f" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="32" height="32">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 01-3.46 0" />
            </svg>
          </div>
          <p className="font-body" style={{ color: 'var(--color-muted)', fontSize: '15px' }}>
            Nothing here yet. When someone follows you, likes, or comments on a post, it will show up here.
          </p>
        </div>
      )}

      {followRequests.length > 0 && (
        <div style={{ marginBottom: '28px' }}>
          <h2
            className="font-display font-bold"
            style={{ fontSize: '1rem', letterSpacing: '-0.01em', color: 'var(--color-text)', marginBottom: '10px' }}
          >
            Follow Requests
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {followRequests.map(req => (
              <div
                key={req.actor_id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '12px 14px', borderRadius: '10px',
                  background: 'rgba(0,0,0,0.02)',
                }}
              >
                <Avatar src={req.avatar_url} name={req.name} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="font-body" style={{ fontSize: '14px', color: '#33261a', fontWeight: 500, margin: 0 }}>
                    {req.name ?? req.handle}
                  </p>
                  {req.handle && (
                    <p className="font-body" style={{ fontSize: '12px', color: '#6b5d4f', margin: 0 }}>
                      @{req.handle}
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  <button
                    onClick={() => handleAcceptRequest(req.actor_id)}
                    className="font-body"
                    style={{
                      fontSize: '13px', fontWeight: 600,
                      padding: '5px 12px', borderRadius: '20px',
                      background: '#33261a', color: '#faf8f4',
                      border: 'none', cursor: 'pointer',
                    }}
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => handleDeclineRequest(req.actor_id)}
                    className="font-body"
                    style={{
                      fontSize: '13px', fontWeight: 500,
                      padding: '5px 12px', borderRadius: '20px',
                      background: 'transparent', color: '#6b5d4f',
                      border: '1px solid rgba(0,0,0,0.15)', cursor: 'pointer',
                    }}
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {notifications.map(n => {
          const isComment = n.type === 'comment' || n.type === 'mention'
          const href = notifHref(n)
          const rowStyle = {
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 14px',
            borderRadius: '10px',
            background: isComment
              ? 'rgba(0,0,0,0.03)'
              : n.read
                ? 'transparent'
                : 'rgba(0,0,0,0.02)',
            borderLeft: isComment ? '2px solid rgba(0,0,0,0.1)' : '2px solid transparent',
            textDecoration: 'none',
            cursor: href ? 'pointer' : 'default',
            transition: 'background 0.12s',
          }
          const inner = (
            <>
              <div style={{ flexShrink: 0 }}>
                <Avatar src={n.actor?.avatar_url} name={n.actor?.name} />
              </div>

              {/* Text + timestamp */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  className="font-body"
                  style={{
                    fontSize: '14px',
                    color: n.read ? '#6b5d4f' : '#33261a',
                    lineHeight: '1.4',
                    marginBottom: '2px',
                  }}
                >
                  {notificationText(n)}
                </p>
                <span
                  className="font-body"
                  style={{ fontSize: '12px', color: '#6b5d4f' }}
                >
                  {formatRelativeTime(n.updated_at)}
                </span>
              </div>

              {/* Type icon */}
              <span style={{ flexShrink: 0, opacity: 0.6, display: 'flex' }}>
                <TypeIcon type={n.type} />
              </span>
            </>
          )

          return href ? (
            <Link key={n.key} href={href} style={rowStyle}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.05)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = rowStyle.background }}
            >
              {inner}
            </Link>
          ) : (
            <div key={n.key} style={rowStyle}>
              {inner}
            </div>
          )
        })}
      </div>
    </div>
  )
}
