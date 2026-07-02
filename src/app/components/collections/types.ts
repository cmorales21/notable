import type { Recommendation } from '@/app/lib/types'

export interface CollectionData {
  id: string
  user_id: string
  name: string
  description: string | null
  is_private: boolean
  category: string
  cover_recommendation_id: string | null
  position: number
  created_at: string
  updated_at: string
}

export interface CollectionItemRow {
  id: string
  recommendation_id: string
  added_at: string
  rec: Recommendation
}

export { CATEGORY_LABELS } from '@/app/lib/theme'
