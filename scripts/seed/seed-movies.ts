// Notable — TMDB Movie & TV Seed Script
//
// Pulls top-rated and popular movies/TV from TMDB and inserts into the items table.
// Safe to run multiple times — skips items that already exist.
//
// Run with:
//   npm run seed:movies

import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { fileURLToPath } from 'url'

dotenv.config({ path: '.env.local' })

// ─── Config ───────────────────────────────────────────────────────────────────

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const tmdbKey    = process.env.TMDB_API_KEY

if (!supabaseUrl || !supabaseKey || !tmdbKey) {
  console.error('Missing env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TMDB_API_KEY')
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

// ─── TMDB types ───────────────────────────────────────────────────────────────

interface TMDBResult {
  id: number
  title?: string
  name?: string
  poster_path: string | null
  overview: string
  release_date?: string
  first_air_date?: string
  vote_average: number
}

interface TMDBResponse {
  results?: TMDBResult[]
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

async function fetchTMDBPage(endpoint: string, page: number): Promise<TMDBResult[]> {
  const url = `https://api.themoviedb.org/3${endpoint}?page=${page}&language=en-US`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${tmdbKey}` } })
  if (!res.ok) {
    console.warn(`  TMDB ${endpoint} page ${page}: HTTP ${res.status}`)
    return []
  }
  const json = (await res.json()) as TMDBResponse
  return json.results ?? []
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function run(): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0
  let skipped  = 0

  const sources: Array<{ endpoint: string; mediaType: 'movie' | 'tv'; pages: number }> = [
    { endpoint: '/movie/top_rated', mediaType: 'movie', pages: 15 },
    { endpoint: '/movie/popular',   mediaType: 'movie', pages: 10 },
    { endpoint: '/tv/top_rated',    mediaType: 'tv',    pages: 5  },
    { endpoint: '/tv/popular',      mediaType: 'tv',    pages: 5  },
  ]

  // Phase 1: collect all unique items from TMDB
  const byId = new Map<string, { item: TMDBResult; mediaType: 'movie' | 'tv' }>()

  for (const { endpoint, mediaType, pages } of sources) {
    console.log(`Fetching ${endpoint} (${pages} pages)...`)
    for (let page = 1; page <= pages; page++) {
      const results = await fetchTMDBPage(endpoint, page)
      for (const item of results) {
        if (!item.poster_path) continue
        const id = String(item.id)
        if (!byId.has(id)) byId.set(id, { item, mediaType })
      }
      process.stdout.write('.')
      await delay(300)
    }
    console.log(` ${byId.size} unique so far`)
  }

  console.log(`\nCollected ${byId.size} unique TMDB items. Fetching existing IDs from Supabase...`)

  // Phase 2: fetch all existing TMDB IDs in one query
  const { data: existingRows, error: fetchErr } = await supabase
    .from('items')
    .select('external_id')
    .eq('external_source', 'tmdb')
  if (fetchErr) console.warn('  Could not fetch existing items:', fetchErr.message)
  const existingIds = new Set(existingRows?.map(r => r.external_id as string) ?? [])
  console.log(`Found ${existingIds.size} existing TMDB items in DB.\n`)

  // Phase 3: insert new items
  for (const [id, { item, mediaType }] of byId) {
    const title = item.title ?? item.name ?? ''
    if (!title) continue

    if (existingIds.has(id)) {
      console.log(`Skipped (already exists): ${title}`)
      skipped++
      continue
    }

    const rawDate   = item.release_date ?? item.first_air_date ?? ''
    const year      = rawDate ? (parseInt(rawDate.slice(0, 4), 10) || null) : null
    const outboundUrl = `https://www.themoviedb.org/${mediaType}/${id}`

    const { error } = await supabase.from('items').insert({
      title,
      normalized_title: normalizeItemTitle(title),
      category:          'movies',
      image_url:         `https://image.tmdb.org/t/p/w500${item.poster_path}`,
      author_or_creator: null,
      year,
      description:       item.overview ? item.overview.slice(0, 300) : null,
      external_id:       id,
      external_source:   'tmdb',
      outbound_url:      outboundUrl,
      outbound_partner:  'tmdb',
      outbound_urls:     { tmdb: outboundUrl },
      metadata:          { type: mediaType, vote_average: item.vote_average },
    })

    if (error) {
      console.error(`  Error inserting "${title}": ${error.message}`)
    } else {
      console.log(`Inserted: ${title}${year ? ` (${year})` : ''}`)
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
