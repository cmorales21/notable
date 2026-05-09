import type { Recommendation, RecProfile } from '@/app/components/CategoryFeed'

export function normalizeTitle(s: string): string {
  return s.trim().toLowerCase()
}

export interface GroupedRecommender {
  recommendation_id: string
  user_id: string
  profile: RecProfile | null
  description: string
  created_at: string
  individual_likes: number
  individual_comments: number
  is_liked_by_user: boolean
  is_bookmarked_by_user: boolean
  external_url: string | null
}

export interface GroupedRecommendation {
  groupKey: string
  title: string
  category: string
  image_url: string | null
  external_url: string | null
  total_likes: number
  total_comments: number
  most_recent_date: string
  lead_rec_id: string
  recommenders: GroupedRecommender[]  // sorted newest-first
}

export interface SearchGroupedRec {
  groupKey: string
  title: string
  category: string
  image_url: string | null
  lead_rec_id: string
  recommender_count: number
  most_recent_description: string
  recommenders: Array<{ name: string | null; handle: string | null; avatar_url: string | null }>
}

export function groupRecommendations(
  recs: Recommendation[],
  likeCounts: Record<string, number>,
  commentCounts: Record<string, number>,
  userLikes: Set<string>,
  userBookmarks: Set<string>,
): GroupedRecommendation[] {
  type MutableGroup = Omit<GroupedRecommendation, 'groupKey'>
  const groupMap = new Map<string, MutableGroup>()

  for (const rec of recs) {
    const key = `${normalizeTitle(rec.title)}::${rec.category}`
    const likes = likeCounts[rec.id] ?? 0
    const comments = commentCounts[rec.id] ?? 0

    const recommender: GroupedRecommender = {
      recommendation_id: rec.id,
      user_id: rec.user_id,
      profile: rec.profiles,
      description: rec.description,
      created_at: rec.created_at,
      individual_likes: likes,
      individual_comments: comments,
      is_liked_by_user: userLikes.has(rec.id),
      is_bookmarked_by_user: userBookmarks.has(rec.id),
      external_url: rec.external_url,
    }

    const existing = groupMap.get(key)
    if (existing) {
      existing.recommenders.push(recommender)
      existing.total_likes += likes
      existing.total_comments += comments
      if (rec.created_at > existing.most_recent_date) {
        existing.most_recent_date = rec.created_at
        existing.lead_rec_id = rec.id
        if (rec.image_url) existing.image_url = rec.image_url
        if (rec.external_url) existing.external_url = rec.external_url
      }
    } else {
      groupMap.set(key, {
        title: rec.title,
        category: rec.category,
        image_url: rec.image_url,
        external_url: rec.external_url,
        total_likes: likes,
        total_comments: comments,
        most_recent_date: rec.created_at,
        lead_rec_id: rec.id,
        recommenders: [recommender],
      })
    }
  }

  const result: GroupedRecommendation[] = []
  for (const [key, g] of groupMap) {
    g.recommenders.sort((a, b) => b.created_at.localeCompare(a.created_at))
    result.push({ groupKey: key, ...g })
  }
  result.sort((a, b) => b.most_recent_date.localeCompare(a.most_recent_date))
  return result
}

// Input recs expected sorted newest-first (as returned by Supabase .order('created_at', { ascending: false }))
export function groupSearchResults(recs: Recommendation[]): SearchGroupedRec[] {
  const seen = new Map<string, SearchGroupedRec>()
  const order: string[] = []

  for (const rec of recs) {
    const key = `${normalizeTitle(rec.title)}::${rec.category}`

    const existing = seen.get(key)
    if (existing) {
      existing.recommender_count++
      if (rec.profiles) {
        existing.recommenders.push({
          name: rec.profiles.name,
          handle: rec.profiles.handle,
          avatar_url: rec.profiles.avatar_url,
        })
      }
    } else {
      order.push(key)
      seen.set(key, {
        groupKey: key,
        title: rec.title,
        category: rec.category,
        image_url: rec.image_url,
        lead_rec_id: rec.id,
        recommender_count: 1,
        most_recent_description: rec.description,
        recommenders: rec.profiles
          ? [{ name: rec.profiles.name, handle: rec.profiles.handle, avatar_url: rec.profiles.avatar_url }]
          : [],
      })
    }
  }

  return order.map(k => seen.get(k)!)
}
