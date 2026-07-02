import type { createClient } from '@/lib/supabase/client'

// Shared like/bookmark toggle: optimistic apply, server write, rollback on
// failure. Notifications are created by DB triggers (see
// scripts/migrate-notifications.sql and
// scripts/migrate-collection-notification-triggers.sql), never by the client.

const TABLES = {
  rec:        { like: 'likes',            bookmark: 'bookmarks' },
  collection: { like: 'collection_likes', bookmark: 'collection_bookmarks' },
} as const

const ID_COLUMNS = {
  rec:        'recommendation_id',
  collection: 'collection_id',
} as const

export async function toggleEngagement(
  client: ReturnType<typeof createClient>,
  {
    kind,
    scope,
    targetId,
    userId,
    isActive,
    apply,
  }: {
    kind: 'like' | 'bookmark'
    scope: 'rec' | 'collection'
    targetId: string
    userId: string
    isActive: boolean
    apply: (active: boolean) => void
  }
): Promise<void> {
  const table = TABLES[scope][kind]
  const idColumn = ID_COLUMNS[scope]

  const next = !isActive
  apply(next)

  const { error } = next
    ? await client.from(table).insert({ user_id: userId, [idColumn]: targetId })
    : await client
        .from(table)
        .delete()
        .eq('user_id', userId)
        .eq(idColumn, targetId)

  if (error) apply(isActive)
}
