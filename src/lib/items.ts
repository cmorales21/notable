import { createClient } from '@/lib/supabase/client'

function normalizeItemTitle(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const OUTBOUND_PARTNER: Record<string, string> = {
  google_books: 'google_books',
  tmdb:         'tmdb',
  itunes:       'apple',
}

export async function createOrMatchItem({
  title,
  category,
  imageUrl,
  authorOrCreator,
  year,
  externalId,
  externalSource,
  externalUrl,
}: {
  title: string
  category: string
  imageUrl?: string
  authorOrCreator?: string
  year?: number
  externalId?: string
  externalSource?: string
  externalUrl?: string
}): Promise<string | null> {
  const supabase = createClient()

  // 1. Exact external match
  if (externalId && externalSource) {
    const { data: existing } = await supabase
      .from('items')
      .select('id')
      .eq('external_id', externalId)
      .eq('external_source', externalSource)
      .maybeSingle()
    if (existing) return existing.id
  }

  // 2. Similarity search
  try {
    const { data: similar, error: rpcError } = await supabase.rpc('search_items', {
      p_query: title,
      p_category: category,
      p_limit: 1,
    })
    if (rpcError) {
      console.warn('[items] search_items RPC unavailable:', rpcError.message)
    } else if (similar && similar.length > 0 && similar[0].similarity > 0.85) {
      return similar[0].id as string
    }
  } catch {
    console.warn('[items] search_items RPC threw unexpectedly')
  }

  // 3. Insert new item
  const partner = externalSource ? (OUTBOUND_PARTNER[externalSource] ?? null) : null
  const outboundUrls = externalUrl && partner ? { [partner]: externalUrl } : {}

  const { data: newItem, error } = await supabase
    .from('items')
    .insert({
      title,
      normalized_title: normalizeItemTitle(title),
      category,
      image_url:         imageUrl ?? null,
      author_or_creator: authorOrCreator ?? null,
      year:              year ?? null,
      external_id:       externalId ?? null,
      external_source:   externalSource ?? null,
      outbound_url:      externalUrl ?? null,
      outbound_partner:  partner,
      outbound_urls:     outboundUrls,
    })
    .select('id')
    .single()

  if (error || !newItem) return null
  return newItem.id as string
}

function trackItemEvent({
  itemId,
  userId,
  type,
  partner,
  category,
  source,
}: {
  itemId: string
  userId: string
  type: 'impression' | 'expand' | 'click'
  partner?: string
  category?: string
  source?: string
}): void {
  // Fire-and-forget, but the builder must be .then()'d or it never executes.
  void createClient().from('item_events').insert({
    item_id:  itemId,
    user_id:  userId,
    type,
    partner:  partner ?? null,
    category: category ?? null,
    source:   source ?? null,
  }).then(({ error }) => {
    if (error && process.env.NODE_ENV !== 'production') {
      console.error('[items] event tracking failed:', error.message)
    }
  })
}

export function trackImpression(itemId: string, userId: string, category?: string): void {
  trackItemEvent({ itemId, userId, type: 'impression', category })
}

export function trackExpand(itemId: string, userId: string, category?: string): void {
  trackItemEvent({ itemId, userId, type: 'expand', category })
}

export function trackClick({
  itemId,
  userId,
  partner,
  category,
  source,
}: {
  itemId: string
  userId: string
  partner?: string
  category?: string
  source?: string
}): void {
  trackItemEvent({ itemId, userId, type: 'click', partner, category, source })
}
