// Notable — iTunes Music Seed Script
//
// Searches iTunes for popular albums across genres and inserts into the items table.
// Safe to run multiple times — skips items that already exist.
//
// Run with:
//   npm run seed:music

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

interface iTunesAlbum {
  collectionId: number
  collectionName: string
  artistName: string
  artworkUrl100?: string
  releaseDate?: string
  primaryGenreName?: string
  trackCount?: number
  collectionViewUrl?: string
  wrapperType: string
  collectionType?: string
}

interface iTunesResponse {
  results?: iTunesAlbum[]
}

// ─── Genre searches ───────────────────────────────────────────────────────────

const SEARCHES = [
  'rock',
  'pop',
  'hip hop',
  'jazz',
  'classical',
  'r b soul',
  'electronic',
  'country',
  'indie',
  'latin',
]

// ─── Fetch ────────────────────────────────────────────────────────────────────

async function fetchAlbums(term: string): Promise<iTunesAlbum[]> {
  const encoded = encodeURIComponent(term)
  const url = `https://itunes.apple.com/search?term=${encoded}&media=music&entity=album&limit=200&country=US`
  const res = await fetch(url)
  if (!res.ok) {
    console.warn(`  iTunes "${term}": HTTP ${res.status}`)
    return []
  }
  const json = (await res.json()) as iTunesResponse
  return (json.results ?? []).filter(r => r.wrapperType === 'collection')
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function run(): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0
  let skipped  = 0

  // Phase 1: collect unique albums across all genre searches
  const byId = new Map<string, { album: iTunesAlbum; genre: string }>()

  for (const term of SEARCHES) {
    console.log(`Fetching iTunes albums for: "${term}"...`)
    const albums = await fetchAlbums(term)
    for (const album of albums) {
      if (!album.artworkUrl100) continue
      if (!album.collectionViewUrl) continue
      const id = String(album.collectionId)
      if (!byId.has(id)) byId.set(id, { album, genre: term })
    }
    console.log(`  ${albums.length} albums fetched, ${byId.size} unique total`)
    await delay(300)
  }

  console.log(`\nCollected ${byId.size} unique albums. Fetching existing IDs from Supabase...`)

  // Phase 2: fetch all existing iTunes music IDs
  const { data: existingRows, error: fetchErr } = await supabase
    .from('items')
    .select('external_id')
    .eq('external_source', 'itunes')
    .eq('category', 'music')
  if (fetchErr) console.warn('  Could not fetch existing items:', fetchErr.message)
  const existingIds = new Set(existingRows?.map(r => r.external_id as string) ?? [])
  console.log(`Found ${existingIds.size} existing iTunes music items in DB.\n`)

  // Phase 3: insert new items
  for (const [id, { album }] of byId) {
    if (!album.collectionName) continue

    if (existingIds.has(id)) {
      console.log(`Skipped (already exists): ${album.collectionName}`)
      skipped++
      continue
    }

    const imageUrl   = album.artworkUrl100!.replace('100x100', '600x600')
    const year       = album.releaseDate
      ? (parseInt(album.releaseDate.slice(0, 4), 10) || null)
      : null
    const outboundUrl = album.collectionViewUrl!

    const { error } = await supabase.from('items').insert({
      title:             album.collectionName,
      normalized_title:  normalizeItemTitle(album.collectionName),
      category:          'music',
      image_url:         imageUrl,
      author_or_creator: album.artistName || null,
      year,
      description:       null,
      external_id:       id,
      external_source:   'itunes',
      outbound_url:      outboundUrl,
      outbound_partner:  'apple_music',
      outbound_urls:     { apple_music: outboundUrl },
      metadata:          {
        genre:       album.primaryGenreName ?? null,
        trackCount:  album.trackCount ?? null,
      },
    })

    if (error) {
      console.error(`  Error inserting "${album.collectionName}": ${error.message}`)
    } else {
      console.log(`Inserted: ${album.collectionName}${year ? ` (${year})` : ''}`)
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
