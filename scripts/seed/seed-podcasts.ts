// Notable — iTunes Podcast Seed Script
//
// Searches iTunes for popular podcasts and inserts into the items table.
// Safe to run multiple times — skips items that already exist.
//
// Run with:
//   npm run seed:podcasts

import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { fileURLToPath } from 'url'

dotenv.config({ path: '.env.local' })

// ─── Config ───────────────────────────────────────────────────────────────────

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

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

// ─── iTunes types ─────────────────────────────────────────────────────────────

interface iTunesPodcast {
  collectionId: number
  collectionName: string
  artistName: string
  artworkUrl100?: string
  releaseDate?: string
  primaryGenreName?: string
  collectionViewUrl?: string
  wrapperType: string
  kind?: string
}

interface iTunesResponse {
  results?: iTunesPodcast[]
}

// ─── Searches ─────────────────────────────────────────────────────────────────

const SEARCHES = [
  'podcast',
  'true crime podcast',
  'business podcast',
  'comedy podcast',
  'science podcast',
  'history podcast',
  'technology podcast',
  'health podcast',
  'politics podcast',
  'culture podcast',
]

// ─── Fetch ────────────────────────────────────────────────────────────────────

async function fetchPodcasts(term: string): Promise<iTunesPodcast[]> {
  const encoded = encodeURIComponent(term)
  const url = `https://itunes.apple.com/search?term=${encoded}&media=podcast&entity=podcast&limit=200&country=US`
  const res = await fetch(url)
  if (!res.ok) {
    console.warn(`  iTunes "${term}": HTTP ${res.status}`)
    return []
  }
  const json = (await res.json()) as iTunesResponse
  return (json.results ?? []).filter(r => r.wrapperType === 'track' || r.kind === 'podcast')
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function run(): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0
  let skipped  = 0

  // Phase 1: collect unique podcasts across all searches
  const byId = new Map<string, { podcast: iTunesPodcast; term: string }>()

  for (const term of SEARCHES) {
    console.log(`Fetching iTunes podcasts for: "${term}"...`)
    const podcasts = await fetchPodcasts(term)
    for (const podcast of podcasts) {
      if (!podcast.artworkUrl100) continue
      if (!podcast.collectionViewUrl) continue
      const id = String(podcast.collectionId)
      if (!byId.has(id)) byId.set(id, { podcast, term })
    }
    console.log(`  ${podcasts.length} podcasts fetched, ${byId.size} unique total`)
    await delay(300)
  }

  console.log(`\nCollected ${byId.size} unique podcasts. Fetching existing IDs from Supabase...`)

  // Phase 2: fetch all existing iTunes podcast IDs
  const { data: existingRows, error: fetchErr } = await supabase
    .from('items')
    .select('external_id')
    .eq('external_source', 'itunes')
    .eq('category', 'podcasts')
  if (fetchErr) console.warn('  Could not fetch existing items:', fetchErr.message)
  const existingIds = new Set(existingRows?.map(r => r.external_id as string) ?? [])
  console.log(`Found ${existingIds.size} existing iTunes podcast items in DB.\n`)

  // Phase 3: insert new items
  for (const [id, { podcast }] of byId) {
    if (!podcast.collectionName) continue

    if (existingIds.has(id)) {
      console.log(`Skipped (already exists): ${podcast.collectionName}`)
      skipped++
      continue
    }

    const imageUrl   = podcast.artworkUrl100!.replace('100x100', '600x600')
    const year       = podcast.releaseDate
      ? (parseInt(podcast.releaseDate.slice(0, 4), 10) || null)
      : null
    const outboundUrl = podcast.collectionViewUrl!

    const { error } = await supabase.from('items').insert({
      title:             podcast.collectionName,
      normalized_title:  normalizeItemTitle(podcast.collectionName),
      category:          'podcasts',
      image_url:         imageUrl,
      author_or_creator: podcast.artistName || null,
      year,
      description:       null,
      external_id:       id,
      external_source:   'itunes',
      outbound_url:      outboundUrl,
      outbound_partner:  'apple_podcasts',
      outbound_urls:     { apple_podcasts: outboundUrl },
      metadata:          { genre: podcast.primaryGenreName ?? null },
    })

    if (error) {
      console.error(`  Error inserting "${podcast.collectionName}": ${error.message}`)
    } else {
      console.log(`Inserted: ${podcast.collectionName}${year ? ` (${year})` : ''}`)
      inserted++
    }
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
