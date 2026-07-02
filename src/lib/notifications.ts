// ─── Types ────────────────────────────────────────────────────────────────────

export type NotifType =
  | 'follow'
  | 'follow_request'
  | 'follow_request_accepted'
  | 'like'
  | 'bookmark'
  | 'comment'
  | 'mention'
  | 'collection_like'
  | 'collection_bookmark'

export type RawNotif = {
  id: string
  type: NotifType
  rec_id: string | null
  collection_id: string | null
  read: boolean
  updated_at: string
  actor_id: string | null
  // Supabase joins can return either a single object or an array depending on
  // the query. resolveActor() normalises this to a plain object or null.
  actor:
    | { name: string | null; handle: string | null; avatar_url: string | null }
    | { name: string | null; handle: string | null; avatar_url: string | null }[]
    | null
  rec: { title: string; category: string } | null
  collection: { name: string; category: string } | null
}

export type GroupedNotif = {
  key: string
  type: NotifType
  count: number
  ids: string[]
  rec_id: string | null
  collection_id: string | null
  read: boolean
  updated_at: string
  actor_id: string | null
  actor: { name: string | null; handle: string | null; avatar_url: string | null } | null
  rec: { title: string; category: string } | null
  collection: { name: string; category: string } | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function resolveActor(
  raw: RawNotif['actor'],
): { name: string | null; handle: string | null; avatar_url: string | null } | null {
  if (!raw) return null
  if (Array.isArray(raw)) return raw[0] ?? null
  return raw
}

export function groupNotifications(rows: RawNotif[]): GroupedNotif[] {
  const map = new Map<string, GroupedNotif>()
  for (const row of rows) {
    const key =
      (row.type === 'like' || row.type === 'bookmark') && row.rec_id
        ? `${row.type}:${row.rec_id}`
        : (row.type === 'collection_like' || row.type === 'collection_bookmark') && row.collection_id
          ? `${row.type}:${row.collection_id}`
          : row.id
    const actor = resolveActor(row.actor)
    if (!map.has(key)) {
      map.set(key, {
        key,
        type: row.type,
        count: 1,
        ids: [row.id],
        rec_id: row.rec_id,
        collection_id: row.collection_id ?? null,
        read: row.read,
        updated_at: row.updated_at,
        actor_id: row.actor_id,
        actor,
        rec: row.rec,
        collection: row.collection ?? null,
      })
    } else {
      const g = map.get(key)!
      g.count++
      g.ids.push(row.id)
      if (!row.read) g.read = false
    }
  }
  return Array.from(map.values())
}

export function getNotifText(n: GroupedNotif): string {
  const name = n.actor?.name ?? n.actor?.handle ?? 'Someone'
  const others = n.count - 1
  const suffix = others > 0 ? ` and ${others} other${others > 1 ? 's' : ''}` : ''
  switch (n.type) {
    case 'follow':                  return `${name} started following you`
    case 'follow_request':          return `${name} wants to follow you`
    case 'follow_request_accepted': return `${name} accepted your follow request`
    case 'like':                    return `${name}${suffix} liked your recommendation`
    case 'bookmark':                return `${name}${suffix} bookmarked your recommendation`
    case 'comment':                 return `${name} commented on your recommendation`
    case 'mention':                 return `${name} mentioned you in a recommendation`
    case 'collection_like':         return n.collection ? `${name}${suffix} liked "${n.collection.name}"` : `${name}${suffix} liked your collection`
    case 'collection_bookmark':     return n.collection ? `${name}${suffix} saved "${n.collection.name}"` : `${name}${suffix} saved your collection`
  }
}

export function getNotifHref(n: GroupedNotif): string | null {
  if (n.type === 'follow') return n.actor?.handle ? `/profile/${n.actor.handle}` : null
  if (n.type === 'follow_request') return null
  if (n.type === 'follow_request_accepted') return n.actor?.handle ? `/profile/${n.actor.handle}` : null
  if (n.type === 'collection_like' || n.type === 'collection_bookmark') return n.collection_id ? `/collections/${n.collection_id}` : null
  if (n.rec?.category && n.rec_id) return `/${n.rec.category}?rec=${n.rec_id}`
  if (n.rec?.category) return `/${n.rec.category}`
  return null
}
