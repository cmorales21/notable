// Notable — Remove All Restaurant Content
//
// Deletes every restaurant item AND any recommendation posts built on top
// of them, plus everything attached to those posts (comments, comment
// likes, likes, bookmarks, notifications, item-click events). This is a
// full cleanup, not just a catalog edit — restaurants are pre-launch test
// content that Carlos wants gone entirely while a better image source is
// sorted out.
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
  console.log('Notable restaurant cleanup starting...\n')

  const { data: items, error: itemsErr } = await supabase
    .from('items')
    .select('id, title')
    .eq('category', 'restaurants')

  if (itemsErr) {
    console.error('Failed to fetch restaurant items:', itemsErr.message)
    process.exit(1)
  }

  if (!items?.length) {
    console.log('No restaurant items found — nothing to do.')
    return
  }

  const itemIds = items.map(i => i.id)
  console.log(`Found ${items.length} restaurant items.\n`)

  const { data: recs, error: recsErr } = await supabase
    .from('recommendations')
    .select('id')
    .in('item_id', itemIds)

  if (recsErr) {
    console.error('Failed to fetch recommendations:', recsErr.message)
    process.exit(1)
  }

  const recIds = (recs ?? []).map(r => r.id)
  console.log(`Found ${recIds.length} recommendation posts built on restaurant items.\n`)

  let commentIds: string[] = []
  if (recIds.length > 0) {
    const { data: comments } = await supabase
      .from('comments')
      .select('id')
      .in('recommendation_id', recIds)
    commentIds = (comments ?? []).map(c => c.id)
  }

  if (commentIds.length > 0) {
    console.log('Deleting comment_likes...')
    const { error, count } = await supabase
      .from('comment_likes')
      .delete({ count: 'exact' })
      .in('comment_id', commentIds)
    if (error) console.error('  ✗  comment_likes:', error.message)
    else console.log(`  ✓  Removed ${count ?? '?'} comment_likes`)
  }

  if (recIds.length > 0) {
    console.log('Deleting comments...')
    const { error, count } = await supabase
      .from('comments')
      .delete({ count: 'exact' })
      .in('recommendation_id', recIds)
    if (error) console.error('  ✗  comments:', error.message)
    else console.log(`  ✓  Removed ${count ?? '?'} comments`)

    console.log('Deleting likes...')
    const r2 = await supabase.from('likes').delete({ count: 'exact' }).in('recommendation_id', recIds)
    if (r2.error) console.error('  ✗  likes:', r2.error.message)
    else console.log(`  ✓  Removed ${r2.count ?? '?'} likes`)

    console.log('Deleting bookmarks...')
    const r3 = await supabase.from('bookmarks').delete({ count: 'exact' }).in('recommendation_id', recIds)
    if (r3.error) console.error('  ✗  bookmarks:', r3.error.message)
    else console.log(`  ✓  Removed ${r3.count ?? '?'} bookmarks`)

    console.log('Deleting notifications...')
    const r4 = await supabase.from('notifications').delete({ count: 'exact' }).in('rec_id', recIds)
    if (r4.error) console.error('  ✗  notifications:', r4.error.message)
    else console.log(`  ✓  Removed ${r4.count ?? '?'} notifications`)
  }

  console.log('Deleting item_events...')
  const r5 = await supabase.from('item_events').delete({ count: 'exact' }).in('item_id', itemIds)
  if (r5.error) console.error('  ✗  item_events:', r5.error.message)
  else console.log(`  ✓  Removed ${r5.count ?? '?'} item_events`)

  if (recIds.length > 0) {
    console.log('Deleting recommendations...')
    const r6 = await supabase.from('recommendations').delete({ count: 'exact' }).in('item_id', itemIds)
    if (r6.error) console.error('  ✗  recommendations:', r6.error.message)
    else console.log(`  ✓  Removed ${r6.count ?? '?'} recommendations`)
  }

  console.log('Deleting items...')
  const r7 = await supabase.from('items').delete({ count: 'exact' }).eq('category', 'restaurants')
  if (r7.error) console.error('  ✗  items:', r7.error.message)
  else console.log(`  ✓  Removed ${r7.count ?? '?'} items`)

  console.log('\n✅ Restaurant cleanup complete.')
}

main().catch(err => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
