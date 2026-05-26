export interface RecProfile {
  name: string | null
  handle: string | null
  avatar_url: string | null
}

export interface Recommendation {
  id: string
  user_id: string
  category: string
  title: string
  description: string
  image_url: string | null
  external_url: string | null
  item_id?: string | null
  created_at: string
  profiles: RecProfile | null
}

export interface RecComment {
  id: string
  user_id: string
  recommendation_id: string
  text: string
  created_at: string
  profiles: RecProfile | null
  comment_likes?: Array<{ id: string; user_id: string }>
}
