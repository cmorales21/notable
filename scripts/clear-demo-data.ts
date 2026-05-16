// Notable — Demo Data Clear Script
//
// Removes ALL data created by seed-demo-data.ts:
// auth users, profiles, recommendations, likes, bookmarks, comments, follows, notifications.
//
// Run with:
//   npx tsx --env-file=.env.local scripts/clear-demo-data.ts

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
  console.log('Notable demo clear starting...\n')

  // ── Find demo profiles ────────────────────────────────────────────────────

  const { data: profiles, error: profileFetchErr } = await supabase
    .from('profiles')
    .select('id, handle')
    .like('handle', 'demo_%')

  if (profileFetchErr) {
    console.error('Failed to fetch demo profiles:', profileFetchErr.message)
    process.exit(1)
  }

  if (!profiles?.length) {
    console.log('No demo profiles found — nothing to remove.')
    return
  }

  const userIds = profiles.map(p => p.id)
  const handles = profiles.map(p => p.handle)
  console.log(`Found ${profiles.length} demo users: ${handles.join(', ')}\n`)

  // ── Find demo recommendations ─────────────────────────────────────────────

  const { data: recs, error: recFetchErr } = await supabase
    .from('recommendations')
    .select('id')
    .in('user_id', userIds)

  if (recFetchErr) {
    console.error('Failed to fetch demo recommendations:', recFetchErr.message)
    process.exit(1)
  }

  const recIds = (recs ?? []).map(r => r.id)
  console.log(`Found ${recIds.length} recommendations to remove.`)

  // ── Find demo comments ────────────────────────────────────────────────────

  const { data: comments } = await supabase
    .from('comments')
    .select('id')
    .or(`user_id.in.(${userIds.join(',')}),recommendation_id.in.(${recIds.length ? recIds.join(',') : 'null'})`)

  const commentIds = (comments ?? []).map(c => c.id)
  console.log(`Found ${commentIds.length} comments to remove.`)

  // ── Delete comment_likes ──────────────────────────────────────────────────

  if (commentIds.length > 0) {
    console.log('\nDeleting comment_likes...')
    const { error, count } = await supabase
      .from('comment_likes')
      .delete({ count: 'exact' })
      .in('comment_id', commentIds)
    if (error) console.error('  ✗  comment_likes:', error.message)
    else console.log(`  ✓  Removed ${count ?? '?'} comment_likes`)
  }

  // ── Delete comment_likes by demo users on non-demo comments ───────────────

  {
    console.log('Deleting comment_likes by demo users...')
    const { error, count } = await supabase
      .from('comment_likes')
      .delete({ count: 'exact' })
      .in('user_id', userIds)
    if (error) console.error('  ✗  comment_likes (by user):', error.message)
    else console.log(`  ✓  Removed ${count ?? '?'} additional comment_likes`)
  }

  // ── Delete comments ───────────────────────────────────────────────────────

  {
    console.log('Deleting comments on demo recs...')
    if (recIds.length > 0) {
      const { error, count } = await supabase
        .from('comments')
        .delete({ count: 'exact' })
        .in('recommendation_id', recIds)
      if (error) console.error('  ✗  comments (on recs):', error.message)
      else console.log(`  ✓  Removed ${count ?? '?'} comments on demo recs`)
    }

    console.log('Deleting comments by demo users...')
    const { error, count } = await supabase
      .from('comments')
      .delete({ count: 'exact' })
      .in('user_id', userIds)
    if (error) console.error('  ✗  comments (by user):', error.message)
    else console.log(`  ✓  Removed ${count ?? '?'} comments by demo users`)
  }

  // ── Delete likes ──────────────────────────────────────────────────────────

  {
    console.log('Deleting likes on demo recs...')
    if (recIds.length > 0) {
      const { error, count } = await supabase
        .from('likes')
        .delete({ count: 'exact' })
        .in('recommendation_id', recIds)
      if (error) console.error('  ✗  likes (on recs):', error.message)
      else console.log(`  ✓  Removed ${count ?? '?'} likes on demo recs`)
    }

    console.log('Deleting likes by demo users...')
    const { error, count } = await supabase
      .from('likes')
      .delete({ count: 'exact' })
      .in('user_id', userIds)
    if (error) console.error('  ✗  likes (by user):', error.message)
    else console.log(`  ✓  Removed ${count ?? '?'} likes by demo users`)
  }

  // ── Delete bookmarks ──────────────────────────────────────────────────────

  {
    console.log('Deleting bookmarks on demo recs...')
    if (recIds.length > 0) {
      const { error, count } = await supabase
        .from('bookmarks')
        .delete({ count: 'exact' })
        .in('recommendation_id', recIds)
      if (error) console.error('  ✗  bookmarks (on recs):', error.message)
      else console.log(`  ✓  Removed ${count ?? '?'} bookmarks on demo recs`)
    }

    console.log('Deleting bookmarks by demo users...')
    const { error, count } = await supabase
      .from('bookmarks')
      .delete({ count: 'exact' })
      .in('user_id', userIds)
    if (error) console.error('  ✗  bookmarks (by user):', error.message)
    else console.log(`  ✓  Removed ${count ?? '?'} bookmarks by demo users`)
  }

  // ── Delete notifications ──────────────────────────────────────────────────

  {
    console.log('Deleting notifications involving demo users or recs...')

    // Notifications where actor is a demo user
    const { error: e1, count: c1 } = await supabase
      .from('notifications')
      .delete({ count: 'exact' })
      .in('actor_id', userIds)
    if (e1) console.error('  ✗  notifications (actor):', e1.message)
    else console.log(`  ✓  Removed ${c1 ?? '?'} notifications by demo actors`)

    // Notifications sent to demo users
    const { error: e2, count: c2 } = await supabase
      .from('notifications')
      .delete({ count: 'exact' })
      .in('user_id', userIds)
    if (e2) console.error('  ✗  notifications (recipient):', e2.message)
    else console.log(`  ✓  Removed ${c2 ?? '?'} notifications for demo users`)

    // Notifications referencing demo recs
    if (recIds.length > 0) {
      const { error: e3, count: c3 } = await supabase
        .from('notifications')
        .delete({ count: 'exact' })
        .in('rec_id', recIds)
      if (e3) console.error('  ✗  notifications (rec_id):', e3.message)
      else console.log(`  ✓  Removed ${c3 ?? '?'} notifications for demo recs`)
    }
  }

  // ── Delete follows ────────────────────────────────────────────────────────

  {
    console.log('Deleting follows involving demo users...')

    const { error: e1, count: c1 } = await supabase
      .from('follows')
      .delete({ count: 'exact' })
      .in('follower_id', userIds)
    if (e1) console.error('  ✗  follows (follower):', e1.message)
    else console.log(`  ✓  Removed ${c1 ?? '?'} follows by demo users`)

    const { error: e2, count: c2 } = await supabase
      .from('follows')
      .delete({ count: 'exact' })
      .in('following_id', userIds)
    if (e2) console.error('  ✗  follows (following):', e2.message)
    else console.log(`  ✓  Removed ${c2 ?? '?'} follows pointing to demo users`)
  }

  // ── Delete recommendations ────────────────────────────────────────────────

  if (recIds.length > 0) {
    console.log('Deleting recommendations...')
    const { error, count } = await supabase
      .from('recommendations')
      .delete({ count: 'exact' })
      .in('user_id', userIds)
    if (error) console.error('  ✗  recommendations:', error.message)
    else console.log(`  ✓  Removed ${count ?? '?'} recommendations`)
  }

  // ── Delete profiles ───────────────────────────────────────────────────────

  {
    console.log('Deleting profiles...')
    const { error, count } = await supabase
      .from('profiles')
      .delete({ count: 'exact' })
      .in('id', userIds)
    if (error) console.error('  ✗  profiles:', error.message)
    else console.log(`  ✓  Removed ${count ?? '?'} profiles`)
  }

  // ── Delete auth users ─────────────────────────────────────────────────────

  console.log('Deleting auth users...')
  let authDeleted = 0
  for (const uid of userIds) {
    const { error } = await supabase.auth.admin.deleteUser(uid)
    if (error) console.error(`  ✗  auth user ${uid}:`, error.message)
    else authDeleted++
  }
  console.log(`  ✓  Deleted ${authDeleted}/${userIds.length} auth users`)

  // ── Summary ───────────────────────────────────────────────────────────────

  console.log('\n✅ Demo data cleared.\n')
  console.log(`  Removed: ${profiles.length} users, ${recIds.length} recommendations,`)
  console.log(`           ${commentIds.length} comments, and all associated likes/bookmarks/follows/notifications.`)
}

main().catch(err => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
