// ─── Shared types ─────────────────────────────────────────────────────────────

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

export type CollectionCategory = 'books' | 'movies' | 'music' | 'restaurants' | 'podcasts'

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

export const CATEGORY_COLORS: Record<string, string> = {
  books: '#5271FF',
  movies: '#dc4f5c',
  music: '#4aad4e',
  restaurants: '#9055d0',
  podcasts: '#e5a517',
}

export const CATEGORY_LABELS: Record<string, string> = {
  books: 'Books',
  movies: 'Movies & TV',
  music: 'Music',
  restaurants: 'Restaurants',
  podcasts: 'Podcasts',
}

export const COLLECTION_CATEGORIES: CollectionCategory[] = ['books', 'movies', 'music', 'restaurants', 'podcasts']
