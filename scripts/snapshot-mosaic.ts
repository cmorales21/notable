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

async function main() {
  console.log('Snapshotting current mosaic items...\n')

  const { data, error } = await supabase
    .from('items')
    .select('id, title, image_url, category, author_or_creator')
    .not('image_url', 'is', null)
    .neq('image_url', '')
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

  const outPath = join(process.cwd(), 'src/app/lib/mosaicSnapshot.json')
  writeFileSync(outPath, JSON.stringify(data, null, 2))

  console.log(`Wrote ${data.length} items to ${outPath}`)
}

main()
