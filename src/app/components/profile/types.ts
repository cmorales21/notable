// ─── Shared types ─────────────────────────────────────────────────────────────

import { CATEGORY_ORDER, type Category } from '@/app/lib/theme'

export interface FullProfile {
  id: string
  name: string | null
  handle: string | null
  bio: string | null
  avatar_url: string | null
  bookmarks_private?: boolean | null
  profile_private?: boolean | null
  collections_private?: boolean | null
}

export type CollectionCategory = Category

export interface Collection {
  id: string
  user_id: string
  name: string
  description: string | null
  is_private: boolean
  category: CollectionCategory
  cover_recommendation_id: string | null
  position: number
  created_at: string
  updated_at: string
  collection_items: { recommendation_id: string; recommendations: { image_url: string | null } | null }[]
}

// ─── Shared constants ──────────────────────────────────────────────────────────

export { CATEGORY_COLORS, CATEGORY_LABELS } from '@/app/lib/theme'

export const COLLECTION_CATEGORIES: CollectionCategory[] = [...CATEGORY_ORDER]
