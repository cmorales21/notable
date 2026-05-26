// Notable — Open Library Book Seed Script
//
// Fetches popular books from Open Library subjects and inserts into the items table.
// Safe to run multiple times — skips items that already exist.
//
// Run with:
//   npm run seed:books

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

// ─── Open Library types ───────────────────────────────────────────────────────

interface OLAuthor {
  name: string
}

interface OLWork {
  key: string
  title: string
  cover_id?: number
  authors?: OLAuthor[]
  first_publish_year?: number
  subject?: string
}

interface OLSubjectResponse {
  works?: OLWork[]
}

// ─── Subjects to fetch ────────────────────────────────────────────────────────

const SUBJECTS: Array<{ subject: string; limit: number }> = [
  { subject: 'fiction',        limit: 200 },
  { subject: 'nonfiction',     limit: 200 },
  { subject: 'mystery',        limit: 100 },
  { subject: 'science_fiction', limit: 100 },
  { subject: 'romance',        limit: 100 },
  { subject: 'thriller',       limit: 100 },
  { subject: 'fantasy',        limit: 100 },
  { subject: 'biography',      limit: 100 },
  { subject: 'history',        limit: 100 },
  { subject: 'self-help',      limit: 100 },
]

// ─── Fetch ────────────────────────────────────────────────────────────────────

async function fetchSubject(subject: string, limit: number): Promise<OLWork[]> {
  const url = `https://openlibrary.org/subjects/${subject}.json?limit=${limit}&offset=0`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Notable/1.0 (carlos@notable.app)' },
  })
  if (!res.ok) {
    console.warn(`  Open Library ${subject}: HTTP ${res.status}`)
    return []
  }
  const json = (await res.json()) as OLSubjectResponse
  return json.works ?? []
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function run(): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0
  let skipped  = 0

  // Phase 1: collect unique works across all subjects
  const byKey = new Map<string, { work: OLWork; subject: string }>()

  for (const { subject, limit } of SUBJECTS) {
    console.log(`Fetching subject: ${subject} (limit ${limit})...`)
    const works = await fetchSubject(subject, limit)
    for (const work of works) {
      if (!work.cover_id) continue
      if (!byKey.has(work.key)) byKey.set(work.key, { work, subject })
    }
    console.log(`  ${works.length} works fetched, ${byKey.size} unique total`)
    await delay(300)
  }

  console.log(`\nCollected ${byKey.size} unique books. Fetching existing IDs from Supabase...`)

  // Phase 2: fetch all existing Open Library IDs
  const { data: existingRows, error: fetchErr } = await supabase
    .from('items')
    .select('external_id')
    .eq('external_source', 'open_library')
  if (fetchErr) console.warn('  Could not fetch existing items:', fetchErr.message)
  const existingIds = new Set(existingRows?.map(r => r.external_id as string) ?? [])
  console.log(`Found ${existingIds.size} existing Open Library items in DB.\n`)

  // Phase 3: insert new items
  for (const [key, { work, subject }] of byKey) {
    if (!work.title) continue

    if (existingIds.has(key)) {
      console.log(`Skipped (already exists): ${work.title}`)
      skipped++
      continue
    }

    const outboundUrl = `https://openlibrary.org${key}`
    const author      = work.authors?.[0]?.name ?? null
    const year        = work.first_publish_year ?? null
    const imageUrl    = `https://covers.openlibrary.org/b/id/${work.cover_id}-L.jpg`

    const { error } = await supabase.from('items').insert({
      title:             work.title,
      normalized_title:  normalizeItemTitle(work.title),
      category:          'books',
      image_url:         imageUrl,
      author_or_creator: author,
      year,
      description:       null,
      external_id:       key,
      external_source:   'open_library',
      outbound_url:      outboundUrl,
      outbound_partner:  'open_library',
      outbound_urls:     { open_library: outboundUrl },
      metadata:          { subject },
    })

    if (error) {
      console.error(`  Error inserting "${work.title}": ${error.message}`)
    } else {
      console.log(`Inserted: ${work.title}${year ? ` (${year})` : ''}`)
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
