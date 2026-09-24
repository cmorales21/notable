// Notable — Remove Restaurant Items
//
// Deletes all `items` rows with category = 'restaurants'. The restaurant
// image lookups were never reliable, so these are being pulled out of the
// curated catalog for now. Safety: if an item is still referenced by a
// recommendation, it is left alone and reported instead of deleted, so a
// real post never silently breaks.
//
// Run with:
//   npx tsx --env-file=.env.local scripts/remove-restaurants.ts

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  console.log('Finding restaurant items...\n')

  const { data: restaurantItems, error: fetchErr } = await supabase
    .from('items')
    .select('id, title')
    .eq('category', 'restaurants')

  if (fetchErr) {
    console.error('Failed to fetch restaurant items:', fetchErr.message)
    process.exit(1)
  }

  if (!restaurantItems || restaurantItems.length === 0) {
    console.log('No restaurant items found — nothing to do.')
    return
  }

  console.log(`Found ${restaurantItems.length} restaurant items.\n`)

  let deleted = 0
  let skipped = 0

  for (const item of restaurantItems) {
    const { data: recs } = await supabase
      .from('recommendations')
      .select('id')
      .eq('item_id', item.id)
      .limit(1)

    if (recs && recs.length > 0) {
      console.log(`Skipped (has a recommendation attached): ${item.title}`)
      skipped++
      continue
    }

    const { error: delErr } = await supabase
      .from('items')
      .delete()
      .eq('id', item.id)

    if (delErr) {
      console.log(`Skipped (could not delete, likely still referenced): ${item.title} — ${delErr.message}`)
      skipped++
    } else {
      console.log(`Deleted: ${item.title}`)
      deleted++
    }
  }

  console.log(`\nDone. Deleted ${deleted} items, skipped ${skipped}.`)
}

main()
