// Notable — Landing Page Mosaic Snapshot
//
// Freezes the landing page's scrolling mosaic to whatever items exist in the
// database right now. Run this once to generate the snapshot file; the
// landing page will use that file from then on and will NOT pick up new
// items automatically. Re-run this script manually any time you want to
// refresh the mosaic with a new batch of items.
//
// Run with:
//   npx tsx --env-file=.env.local scripts/snapshot-mosaic.ts

import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'fs'
import { join } from 'path'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !anonKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, anonKey)

// Titles listed here are dropped from the landing-page mosaic without
// being removed from the catalog itself — the items stay usable in the
// product, they just don't appear on the public marketing page. Use for
// items with broken/unflattering preview images or subject matter that
// isn't a fit for the front door. Match `items.title` exactly, including
// curly quotes.
const MOSAIC_EXCLUDE_TITLES = [
  'Amazon',
  'A Genocide Scholar Asks “What Went Wrong” in Israel',
]

async function main() {
  console.log('Snapshotting current mosaic items...\n')

  // Exclude items marked `metadata.seed = true` — those are demo-persona
  // items created by scripts/seed/seed.mjs and must never appear in the
  // mosaic. The .or() covers rows where metadata is null or the seed key
  // is missing/false; only explicit `true` is filtered out.
  const { data, error } = await supabase
    .from('items')
    .select('id, title, image_url, category, author_or_creator')
    .not('image_url', 'is', null)
    .neq('image_url', '')
    .or('metadata->>seed.is.null,metadata->>seed.neq.true')
    .order('created_at', { ascending: false })
    .limit(75)

  if (error) {
    console.error('Query failed:', error.message)
    process.exit(1)
  }

  if (!data || data.length === 0) {
    console.error('No items found — nothing to snapshot.')
    process.exit(1)
  }

  const excludeSet = new Set(MOSAIC_EXCLUDE_TITLES)
  const filtered = data.filter(item => !excludeSet.has(item.title ?? ''))

  const outPath = join(process.cwd(), 'src/app/lib/mosaicSnapshot.json')
  writeFileSync(outPath, JSON.stringify(filtered, null, 2))

  console.log(`Wrote ${filtered.length} items to ${outPath}`)
}

main()
