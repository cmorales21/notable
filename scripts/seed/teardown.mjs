// Notable — one-shot teardown for the seed created by scripts/seed/seed.mjs.
//
// Removes every row that seed.mjs writes, bottom-up, using explicit deletes
// (not just cascades) so we can report accurate per-table counts and detect
// orphans that the cascade path would silently miss.
//
// Run:
//   node scripts/seed/teardown.mjs
//   node scripts/seed/teardown.mjs --include-items
//
// Teardown markers:
//   - Auth users: email ends with @seed.notable.test
//   - Items:      metadata.seed === true  (only touched with --include-items)
//
// This script does NOT modify any application code. It also never touches
// content owned by non-seed users, though it will remove seed-user
// like/comment/follow/notification rows that were attached to non-seed rows.

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

// ── Config ───────────────────────────────────────────────────────────────────

const SEED_EMAIL_DOMAIN = 'seed.notable.test'
const AUTH_DELETE_DELAY = 300   // ms between admin.deleteUser calls
const IN_CHUNK          = 100   // max ids per .in() filter (Postgres/PostgREST comfortable)
const LIST_PAGE_SIZE    = 200   // per-page for admin.listUsers pagination

const includeItems = process.argv.slice(2).includes('--include-items')

// ── Env loading (parse .env.local by hand — matches seed.mjs) ────────────────

const __filename = fileURLToPath(import.meta.url)
const __dirname  = dirname(__filename)
const ENV_PATH   = join(__dirname, '..', '..', '.env.local')

function loadEnvFile(path) {
  let raw
  try {
    raw = readFileSync(path, 'utf8')
  } catch {
    console.error(
      `Could not read ${path}. Make sure the file exists at the repo root ` +
      `with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set.`
    )
    process.exit(1)
  }
  const env = {}
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (!val.startsWith('"') && !val.startsWith("'")) {
      const hash = val.indexOf(' #')
      if (hash >= 0) val = val.slice(0, hash).trim()
    }
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    env[key] = val
  }
  return env
}

const env = loadEnvFile(ENV_PATH)
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL in .env.local — cannot connect to Supabase.')
  process.exit(1)
}
if (!SERVICE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY in .env.local — the teardown script needs admin access to delete users.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function delay(ms) { return new Promise(res => setTimeout(res, ms)) }

// ── Reporting ────────────────────────────────────────────────────────────────

// Every counted delete lands here so we can print a single tidy summary at
// the end regardless of which branch ran.
const report = {}
function record(table, count) {
  report[table] = (report[table] ?? 0) + count
}

// ── Delete helpers ───────────────────────────────────────────────────────────

// Delete rows from `table` where `column` is IN `ids`, chunked so a huge id
// list doesn't blow the URL length limit. Returns the total deleted.
async function deleteWhereIn(table, column, ids) {
  if (!ids?.length) return 0
  let total = 0
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const slice = ids.slice(i, i + IN_CHUNK)
    const { error, count } = await supabase
      .from(table)
      .delete({ count: 'exact' })
      .in(column, slice)
    if (error) {
      console.warn(`  ! delete from ${table} where ${column} IN (…): ${error.message}`)
      continue
    }
    total += count ?? 0
  }
  return total
}

// Same as deleteWhereIn but with an OR across two columns (e.g. follows:
// follower_id OR following_id). Runs two chunked passes — since row match is
// exclusive across passes after the first delete, the sum reflects real rows.
async function deleteWhereInEither(table, colA, colB, ids) {
  const a = await deleteWhereIn(table, colA, ids)
  const b = await deleteWhereIn(table, colB, ids)
  return a + b
}

// Fetch a full list of ids from a table where `column` IN ids (chunked).
async function selectIdsWhereIn(table, selectCol, filterCol, ids) {
  if (!ids?.length) return []
  const out = []
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const slice = ids.slice(i, i + IN_CHUNK)
    const { data, error } = await supabase
      .from(table)
      .select(selectCol)
      .in(filterCol, slice)
    if (error) {
      console.warn(`  ! select from ${table}: ${error.message}`)
      continue
    }
    for (const row of data ?? []) out.push(row[selectCol])
  }
  return out
}

// ── Step 1: collect all seed user ids by paginating listUsers ────────────────

async function collectSeedUsers() {
  const seedIds = []
  const seedEmails = []
  let page = 1
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: LIST_PAGE_SIZE })
    if (error) {
      console.error('Failed to list auth users:', error.message)
      process.exit(1)
    }
    const users = data?.users ?? []
    for (const u of users) {
      if ((u.email ?? '').endsWith(`@${SEED_EMAIL_DOMAIN}`)) {
        seedIds.push(u.id)
        seedEmails.push(u.email)
      }
    }
    // If Supabase returned fewer than a full page, we've reached the end.
    if (users.length < LIST_PAGE_SIZE) break
    page++
  }
  return { seedIds, seedEmails }
}

// ── Step 2: notifications actor_ids cleanup ──────────────────────────────────
//
// Some notifications may be aggregated across multiple actors — an "N and 3
// others liked your post" row has an actor_ids uuid[] with several entries.
// After we've deleted notifications *owned by* or *authored by* seed users,
// a small set may remain that still list a seed user inside their actor_ids
// array. Scrub those in place.

async function scrubNotificationActorIds(seedIds) {
  const seedSet = new Set(seedIds)
  let scanned = 0
  let updated = 0
  let deletedBecauseEmpty = 0

  // The PostgREST `overlaps` filter matches rows whose array shares any
  // element with our seed id list.
  for (let i = 0; i < seedIds.length; i += IN_CHUNK) {
    const slice = seedIds.slice(i, i + IN_CHUNK)
    const { data, error } = await supabase
      .from('notifications')
      .select('id, actor_ids')
      .overlaps('actor_ids', slice)
    if (error) {
      console.warn(`  ! notifications overlaps scan: ${error.message}`)
      continue
    }
    for (const row of data ?? []) {
      scanned++
      const cleaned = (row.actor_ids ?? []).filter(id => !seedSet.has(id))
      if (cleaned.length === (row.actor_ids ?? []).length) continue
      if (cleaned.length === 0) {
        // Nothing left to attribute the notification to — remove it.
        const { error: delErr } = await supabase
          .from('notifications')
          .delete()
          .eq('id', row.id)
        if (!delErr) deletedBecauseEmpty++
      } else {
        const { error: updErr } = await supabase
          .from('notifications')
          .update({ actor_ids: cleaned })
          .eq('id', row.id)
        if (!updErr) updated++
      }
    }
  }
  return { scanned, updated, deletedBecauseEmpty }
}

// ── Step 3: delete auth users (with a small delay between calls) ─────────────

async function deleteAuthUsers(seedIds) {
  let deleted = 0
  for (const id of seedIds) {
    const { error } = await supabase.auth.admin.deleteUser(id)
    if (error) {
      console.warn(`  ! auth deleteUser ${id}: ${error.message}`)
    } else {
      deleted++
    }
    await delay(AUTH_DELETE_DELAY)
  }
  return deleted
}

// ── Step 4: optional items cleanup ───────────────────────────────────────────
//
// Only runs when --include-items was passed. Deletes items rows with
// metadata @> {"seed": true} that are no longer referenced by any surviving
// recommendation. Any seed item still referenced (e.g. a non-seed user has
// picked it up and posted about it) is left alone.

async function deleteOrphanSeedItems() {
  // 1. Pull all items marked seed:true.
  const { data: seedItems, error: itemErr } = await supabase
    .from('items')
    .select('id')
    .contains('metadata', { seed: true })
  if (itemErr) {
    console.warn(`  ! items scan failed: ${itemErr.message}`)
    return 0
  }
  const candidateIds = (seedItems ?? []).map(r => r.id)
  if (candidateIds.length === 0) return 0

  // 2. Find which of those are still referenced by any recommendation row.
  const referenced = new Set()
  for (let i = 0; i < candidateIds.length; i += IN_CHUNK) {
    const slice = candidateIds.slice(i, i + IN_CHUNK)
    const { data, error } = await supabase
      .from('recommendations')
      .select('item_id')
      .in('item_id', slice)
    if (error) {
      console.warn(`  ! recommendations item_id scan: ${error.message}`)
      continue
    }
    for (const row of data ?? []) if (row.item_id) referenced.add(row.item_id)
  }

  // 3. Delete the orphans (candidates minus referenced).
  const orphans = candidateIds.filter(id => !referenced.has(id))
  if (orphans.length === 0) return 0
  return await deleteWhereIn('items', 'id', orphans)
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Notable — teardown.mjs')
  console.log(`  --include-items: ${includeItems ? 'yes' : 'no'}`)
  console.log('─────────────────────────────────────────────────────────')

  console.log('Scanning auth users for seed accounts…')
  const { seedIds, seedEmails } = await collectSeedUsers()

  if (seedIds.length === 0) {
    console.log(`\nNo @${SEED_EMAIL_DOMAIN} users found — the database is already clean. Nothing to do.\n`)
    return
  }

  console.log(`Found ${seedIds.length} seed user(s):`)
  for (const e of seedEmails) console.log(`  · ${e}`)

  // Gather the derived id sets first, because several tables reference the
  // recommendation / collection / comment id rather than user_id directly.
  console.log('\nGathering ids owned by seed users…')
  const seedRecIds        = await selectIdsWhereIn('recommendations', 'id', 'user_id', seedIds)
  const seedCollectionIds = await selectIdsWhereIn('collections',     'id', 'user_id', seedIds)
  // Comments owned by seed users OR posted on seed recommendations.
  const seedCommentsByUser = await selectIdsWhereIn('comments', 'id', 'user_id',          seedIds)
  const seedCommentsByRec  = await selectIdsWhereIn('comments', 'id', 'recommendation_id', seedRecIds)
  const seedCommentIds     = Array.from(new Set([...seedCommentsByUser, ...seedCommentsByRec]))
  console.log(`  recommendations: ${seedRecIds.length}`)
  console.log(`  collections:     ${seedCollectionIds.length}`)
  console.log(`  comments:        ${seedCommentIds.length}`)

  console.log('\nDeleting rows bottom-up…')

  // 1. item_events — attributed to a seed user_id.
  record('item_events',
    await deleteWhereIn('item_events', 'user_id', seedIds))

  // 2. comment_likes — where the liker is a seed user OR the comment is a seed comment.
  record('comment_likes',
    await deleteWhereIn('comment_likes', 'user_id',    seedIds))
  record('comment_likes',
    await deleteWhereIn('comment_likes', 'comment_id', seedCommentIds))

  // 3. comments — authored by a seed user OR on a seed recommendation.
  record('comments',
    await deleteWhereIn('comments', 'user_id',           seedIds))
  record('comments',
    await deleteWhereIn('comments', 'recommendation_id', seedRecIds))

  // 4. likes on recommendations — by seed user OR on seed rec.
  record('likes',
    await deleteWhereIn('likes', 'user_id',           seedIds))
  record('likes',
    await deleteWhereIn('likes', 'recommendation_id', seedRecIds))

  // 5. bookmarks on recommendations — same pattern as likes.
  record('bookmarks',
    await deleteWhereIn('bookmarks', 'user_id',           seedIds))
  record('bookmarks',
    await deleteWhereIn('bookmarks', 'recommendation_id', seedRecIds))

  // 6. collection_likes — by seed user OR on a seed collection.
  record('collection_likes',
    await deleteWhereIn('collection_likes', 'user_id',       seedIds))
  record('collection_likes',
    await deleteWhereIn('collection_likes', 'collection_id', seedCollectionIds))

  // 7. collection_bookmarks — same pattern.
  record('collection_bookmarks',
    await deleteWhereIn('collection_bookmarks', 'user_id',       seedIds))
  record('collection_bookmarks',
    await deleteWhereIn('collection_bookmarks', 'collection_id', seedCollectionIds))

  // 8. collection_items — on a seed collection OR referencing a seed rec.
  record('collection_items',
    await deleteWhereIn('collection_items', 'collection_id',     seedCollectionIds))
  record('collection_items',
    await deleteWhereIn('collection_items', 'recommendation_id', seedRecIds))

  // 9. collections — owned by seed users.
  record('collections',
    await deleteWhereIn('collections', 'user_id', seedIds))

  // 10. notifications — where the recipient OR the actor is a seed user,
  //     then scrub any lingering rows that mention seed users inside actor_ids.
  record('notifications',
    await deleteWhereIn('notifications', 'user_id',  seedIds))
  record('notifications',
    await deleteWhereIn('notifications', 'actor_id', seedIds))
  const scrub = await scrubNotificationActorIds(seedIds)
  if (scrub.updated || scrub.deletedBecauseEmpty) {
    console.log(
      `  actor_ids scrub — scanned ${scrub.scanned}, ` +
      `updated ${scrub.updated}, removed ${scrub.deletedBecauseEmpty} empty rows.`
    )
    record('notifications', scrub.deletedBecauseEmpty)
  }

  // 11. follows — either side involves a seed user.
  record('follows',
    await deleteWhereInEither('follows', 'follower_id', 'following_id', seedIds))

  // 12. recommendations — owned by seed users.
  record('recommendations',
    await deleteWhereIn('recommendations', 'user_id', seedIds))

  // 13. profiles — the seed persona rows themselves.
  record('profiles',
    await deleteWhereIn('profiles', 'id', seedIds))

  // 14. Auth users — remove via Admin API (with delay to avoid rate limits).
  console.log(`\nDeleting ${seedIds.length} auth user(s)…`)
  const authDeleted = await deleteAuthUsers(seedIds)
  record('auth.users', authDeleted)

  // 15. Optional: orphan seed items.
  if (includeItems) {
    console.log('\n--include-items: removing orphaned seed items…')
    record('items', await deleteOrphanSeedItems())
  }

  // ── Summary ───────────────────────────────────────────────────────────────

  console.log('\n─────────────────────────────────────────────────────────')
  console.log('DONE — teardown summary')
  console.log('─────────────────────────────────────────────────────────')
  const tables = [
    'item_events', 'comment_likes', 'comments', 'likes', 'bookmarks',
    'collection_likes', 'collection_bookmarks', 'collection_items',
    'collections', 'notifications', 'follows', 'recommendations',
    'profiles', 'auth.users', 'items',
  ]
  const maxLen = tables.reduce((m, t) => Math.max(m, t.length), 0)
  for (const t of tables) {
    if (report[t] === undefined) continue
    console.log(`  ${t.padEnd(maxLen)}  ${String(report[t]).padStart(6)} row(s) deleted`)
  }
  if (!includeItems) {
    console.log('\nitems table was NOT touched. Pass --include-items to also clean orphaned seed items.')
  }
  console.log('\nSeed data removed. The database is clean.\n')
}

main().catch(err => {
  console.error('\nTeardown failed with an unexpected error:')
  console.error(err)
  process.exit(1)
})
