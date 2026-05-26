// Notable — Carlos's Curated List Seed Script
//
// Reads carlos-items.json and inserts each item, looking up cover images
// and external URLs from the appropriate API (TMDB, Open Library, iTunes).
//
// Run with:
//   npm run seed:carlos

import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { fileURLToPath } from 'url'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'

dotenv.config({ path: '.env.local' })

// ─── Config ───────────────────────────────────────────────────────────────────

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const tmdbKey    = process.env.TMDB_API_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeItemTitle(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ─── Item definition ──────────────────────────────────────────────────────────

interface CarlosItem {
  title: string
  category: 'movies' | 'books' | 'music' | 'podcasts' | 'restaurants'
  author_or_creator?: string
  year?: number
  description?: string
  address?: string
  city?: string
}

// ─── API lookup functions ─────────────────────────────────────────────────────

async function lookupMovie(title: string, year?: number): Promise<{
  imageUrl: string | null
  externalId: string | null
  outboundUrl: string | null
  description: string | null
} | null> {
  if (!tmdbKey) return null
  const query = encodeURIComponent(title)
  const yearParam = year ? `&year=${year}` : ''
  const url = `https://api.themoviedb.org/3/search/movie?query=${query}${yearParam}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${tmdbKey}` } })
  if (!res.ok) return null
  const json = (await res.json()) as { results?: Array<{ id: number; poster_path: string | null; overview: string }> }
  const hit = json.results?.[0]
  if (!hit) return null
  return {
    imageUrl:    hit.poster_path ? `https://image.tmdb.org/t/p/w500${hit.poster_path}` : null,
    externalId:  String(hit.id),
    outboundUrl: `https://www.themoviedb.org/movie/${hit.id}`,
    description: hit.overview ? hit.overview.slice(0, 300) : null,
  }
}

async function lookupBook(title: string): Promise<{
  imageUrl: string | null
  externalId: string | null
  outboundUrl: string | null
} | null> {
  const query = encodeURIComponent(title)
  const url = `https://openlibrary.org/search.json?q=${query}&limit=1&fields=key,cover_i`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Notable/1.0 (carlos@notable.app)' },
  })
  if (!res.ok) return null
  const json = (await res.json()) as { docs?: Array<{ key?: string; cover_i?: number }> }
  const hit = json.docs?.[0]
  if (!hit?.key) return null
  const workKey = hit.key.startsWith('/works/') ? hit.key : `/works/${hit.key}`
  return {
    imageUrl:    hit.cover_i ? `https://covers.openlibrary.org/b/id/${hit.cover_i}-L.jpg` : null,
    externalId:  workKey,
    outboundUrl: `https://openlibrary.org${workKey}`,
  }
}

async function lookupMusic(title: string, artist?: string): Promise<{
  imageUrl: string | null
  externalId: string | null
  outboundUrl: string | null
} | null> {
  const term = artist ? `${title} ${artist}` : title
  const encoded = encodeURIComponent(term)
  const url = `https://itunes.apple.com/search?term=${encoded}&media=music&entity=album&limit=5`
  const res = await fetch(url)
  if (!res.ok) return null
  const json = (await res.json()) as { results?: Array<{ collectionId: number; artworkUrl100?: string; collectionViewUrl?: string; collectionName: string }> }
  const hit = json.results?.[0]
  if (!hit) return null
  return {
    imageUrl:    hit.artworkUrl100 ? hit.artworkUrl100.replace('100x100', '600x600') : null,
    externalId:  String(hit.collectionId),
    outboundUrl: hit.collectionViewUrl ?? null,
  }
}

async function lookupPodcast(title: string): Promise<{
  imageUrl: string | null
  externalId: string | null
  outboundUrl: string | null
} | null> {
  const encoded = encodeURIComponent(title)
  const url = `https://itunes.apple.com/search?term=${encoded}&media=podcast&entity=podcast&limit=5`
  const res = await fetch(url)
  if (!res.ok) return null
  const json = (await res.json()) as { results?: Array<{ collectionId: number; artworkUrl100?: string; collectionViewUrl?: string }> }
  const hit = json.results?.[0]
  if (!hit) return null
  return {
    imageUrl:    hit.artworkUrl100 ? hit.artworkUrl100.replace('100x100', '600x600') : null,
    externalId:  String(hit.collectionId),
    outboundUrl: hit.collectionViewUrl ?? null,
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function run(): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0
  let skipped  = 0

  const __dirname = dirname(fileURLToPath(import.meta.url))
  const jsonPath  = resolve(__dirname, 'carlos-items.json')

  let items: CarlosItem[]
  try {
    items = JSON.parse(readFileSync(jsonPath, 'utf-8')) as CarlosItem[]
  } catch (e) {
    console.error(`Could not read carlos-items.json: ${e}`)
    return { inserted, skipped }
  }

  if (items.length === 0) {
    console.log('carlos-items.json is empty — nothing to insert.')
    return { inserted, skipped }
  }

  for (const item of items) {
    const { title, category, author_or_creator, year, description } = item

    // Check existing by normalized_title + category
    const { data: existing } = await supabase
      .from('items')
      .select('id')
      .eq('normalized_title', normalizeItemTitle(title))
      .eq('category', category)
      .maybeSingle()

    if (existing) {
      console.log(`Skipped (already exists): ${title}`)
      skipped++
      await delay(300)
      continue
    }

    let imageUrl:   string | null = null
    let externalId: string | null = null
    let outboundUrl: string | null = null
    let resolvedDesc: string | null = description ?? null
    let externalSource: string | null = null
    let outboundPartner: string | null = null
    let outboundUrls: Record<string, string> = {}

    if (category === 'movies') {
      const result = await lookupMovie(title, year)
      if (result) {
        imageUrl     = result.imageUrl
        externalId   = result.externalId
        outboundUrl  = result.outboundUrl
        resolvedDesc = resolvedDesc ?? result.description
        externalSource  = 'tmdb'
        outboundPartner = 'tmdb'
        if (outboundUrl) outboundUrls = { tmdb: outboundUrl }
      }
    } else if (category === 'books') {
      const result = await lookupBook(title)
      if (result) {
        imageUrl    = result.imageUrl
        externalId  = result.externalId
        outboundUrl = result.outboundUrl
        externalSource  = 'open_library'
        outboundPartner = 'open_library'
        if (outboundUrl) outboundUrls = { open_library: outboundUrl }
      }
    } else if (category === 'music') {
      const result = await lookupMusic(title, author_or_creator)
      if (result) {
        imageUrl    = result.imageUrl
        externalId  = result.externalId
        outboundUrl = result.outboundUrl
        externalSource  = 'itunes'
        outboundPartner = 'apple_music'
        if (outboundUrl) outboundUrls = { apple_music: outboundUrl }
      }
    } else if (category === 'podcasts') {
      const result = await lookupPodcast(title)
      if (result) {
        imageUrl    = result.imageUrl
        externalId  = result.externalId
        outboundUrl = result.outboundUrl
        externalSource  = 'itunes'
        outboundPartner = 'apple_podcasts'
        if (outboundUrl) outboundUrls = { apple_podcasts: outboundUrl }
      }
    }

    // Also check by external_id if we got one
    if (externalId && externalSource) {
      const { data: existingExternal } = await supabase
        .from('items')
        .select('id')
        .eq('external_id', externalId)
        .eq('external_source', externalSource)
        .maybeSingle()
      if (existingExternal) {
        console.log(`Skipped (already exists): ${title}`)
        skipped++
        await delay(300)
        continue
      }
    }

    const { error } = await supabase.from('items').insert({
      title,
      normalized_title:  normalizeItemTitle(title),
      category,
      image_url:         imageUrl,
      author_or_creator: author_or_creator ?? null,
      year:              year ?? null,
      description:       resolvedDesc,
      external_id:       externalId,
      external_source:   externalSource,
      outbound_url:      outboundUrl,
      outbound_partner:  outboundPartner,
      outbound_urls:     outboundUrls,
    })

    if (error) {
      console.error(`  Error inserting "${title}": ${error.message}`)
    } else {
      console.log(`Inserted: ${title}${year ? ` (${year})` : ''}`)
      inserted++
    }

    await delay(300)
  }

  return { inserted, skipped }
}

// ─── Entry point ──────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url)
if (process.argv[1] === __filename) {
  run()
    .then(({ inserted, skipped }) => {
      console.log(`\nDone. Inserted ${inserted} new items, skipped ${skipped} existing.`)
    })
    .catch(e => { console.error(e); process.exit(1) })
}
