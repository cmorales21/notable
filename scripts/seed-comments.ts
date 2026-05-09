// Notable — Comment & Comment Likes Seed Script
//
// Seeds realistic comments and comment likes for the existing grouped recommendations.
// Idempotent — checks for existing entries before inserting.
//
// Prerequisites:
//   - Run the SQL migration: scripts/migrate-comment-likes.sql
//   - Phase 10 and 10.5 seed data already present
//
// Run with:
//   npx tsx --env-file=.env.local scripts/seed-comments.ts

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
  console.log('Seed-comments starting...\n')

  // ── Resolve handles to user IDs ──────────────────────────────────────────────

  const handles = ['sarahk', 'marcusc', 'priyap', 'jordanw']
  const { data: profileRows, error: profileErr } = await supabase
    .from('profiles')
    .select('id, handle')
    .in('handle', handles)

  if (profileErr) {
    console.error('Profile lookup failed:', profileErr.message)
    process.exit(1)
  }

  const idFor: Record<string, string> = {}
  for (const p of (profileRows ?? [])) idFor[p.handle] = p.id

  console.log('Resolved user IDs:')
  for (const [h, id] of Object.entries(idFor)) console.log(`  @${h} → ${id}`)

  const missing = handles.filter(h => !idFor[h])
  if (missing.length) {
    console.warn('\nWarning: missing profiles:', missing.join(', '))
    console.warn('Skipping comments for those users.')
  }
  console.log()

  // ── Fetch recs for the titles we want to comment on ──────────────────────────

  const titles = ['Past Lives', 'Everything Everywhere All at Once', 'Pachinko', 'SOS']
  const { data: recs, error: recsErr } = await supabase
    .from('recommendations')
    .select('id, title, user_id')
    .in('title', titles)

  if (recsErr) {
    console.error('Rec lookup failed:', recsErr.message)
    process.exit(1)
  }

  // Map title → array of rec IDs (there can be multiple for the same title)
  const recsByTitle: Record<string, Array<{ id: string; user_id: string }>> = {}
  for (const r of (recs ?? [])) {
    if (!recsByTitle[r.title]) recsByTitle[r.title] = []
    recsByTitle[r.title].push({ id: r.id, user_id: r.user_id })
  }

  console.log('Found recs:')
  for (const [title, rs] of Object.entries(recsByTitle)) {
    console.log(`  "${title}" — ${rs.length} rec(s)`)
  }
  console.log()

  // ── Comments to seed ─────────────────────────────────────────────────────────

  // Each entry: comment on a rec identified by title+recommender_handle
  // We seed realistic comments from the other users

  type CommentSeed = {
    rec_title: string
    rec_handle: string  // whose rec to comment on
    commenter_handle: string
    text: string
    like_handles: string[]  // handles of users who liked this comment
  }

  const commentSeeds: CommentSeed[] = [
    // Past Lives — sarahk's rec
    {
      rec_title: 'Past Lives',
      rec_handle: 'sarahk',
      commenter_handle: 'marcusc',
      text: "The sidewalk scene at the end — I was not prepared. Saw this twice in theaters and both times the audience was completely silent when the credits rolled.",
      like_handles: ['priyap', 'jordanw'],
    },
    {
      rec_title: 'Past Lives',
      rec_handle: 'sarahk',
      commenter_handle: 'jordanw',
      text: "The concept of in-yeon is going to live in my head for a long time. The film makes you feel the weight of all those accumulated chance meetings.",
      like_handles: ['sarahk', 'marcusc'],
    },
    {
      rec_title: 'Past Lives',
      rec_handle: 'sarahk',
      commenter_handle: 'priyap',
      text: "Adding to my watchlist immediately. I've been putting this off and your description is exactly why I need to stop doing that.",
      like_handles: ['sarahk'],
    },

    // Past Lives — marcusc's rec
    {
      rec_title: 'Past Lives',
      rec_handle: 'marcusc',
      commenter_handle: 'sarahk',
      text: "The plane cry is the only correct response, truly. There's something about watching it in a semi-public space that makes it even more affecting.",
      like_handles: ['marcusc', 'jordanw'],
    },
    {
      rec_title: 'Past Lives',
      rec_handle: 'marcusc',
      commenter_handle: 'priyap',
      text: "Your point about the structural thing is so right — the way it uses time as a character almost. Each section has its own emotional logic.",
      like_handles: ['marcusc'],
    },

    // Everything Everywhere — priyap's rec
    {
      rec_title: 'Everything Everywhere All at Once',
      rec_handle: 'priyap',
      commenter_handle: 'sarahk',
      text: "The hot dog fingers universe is genuinely one of the most tender things in recent cinema. I laughed until I cried and then just cried.",
      like_handles: ['priyap', 'marcusc', 'jordanw'],
    },
    {
      rec_title: 'Everything Everywhere All at Once',
      rec_handle: 'priyap',
      commenter_handle: 'jordanw',
      text: "Your read on kindness as the rational response to nihilism is exactly it. The film earns its emotional climax in a way that almost no maximalist movie does.",
      like_handles: ['priyap', 'marcusc'],
    },
    {
      rec_title: 'Everything Everywhere All at Once',
      rec_handle: 'priyap',
      commenter_handle: 'marcusc',
      text: "Watched this with my mom and it wrecked both of us in completely different ways. That's the magic of it.",
      like_handles: ['priyap'],
    },

    // Pachinko — jordanw's rec
    {
      rec_title: 'Pachinko',
      rec_handle: 'jordanw',
      commenter_handle: 'priyap',
      text: "Four days is exactly right. I kept telling myself 'one more chapter' and suddenly it was 2am three nights running. The Sunja chapters especially.",
      like_handles: ['jordanw', 'sarahk'],
    },
    {
      rec_title: 'Pachinko',
      rec_handle: 'jordanw',
      commenter_handle: 'sarahk',
      text: "Min Jin Lee is so good at making history feel immediate and personal rather than epic. Every character's choices feel inevitable and heartbreaking at once.",
      like_handles: ['jordanw'],
    },

    // Pachinko — priyap's rec
    {
      rec_title: 'Pachinko',
      rec_handle: 'priyap',
      commenter_handle: 'jordanw',
      text: "The bureaucratic humiliation detail — yes. The way the novel renders the small indignities as just as devastating as the large ones.",
      like_handles: ['priyap', 'sarahk'],
    },
    {
      rec_title: 'Pachinko',
      rec_handle: 'priyap',
      commenter_handle: 'marcusc',
      text: "The personal connection you bring to this makes me want to read it even more. History that's filtered through lived experience hits differently.",
      like_handles: ['priyap'],
    },

    // SOS — marcusc's rec
    {
      rec_title: 'SOS',
      rec_handle: 'marcusc',
      commenter_handle: 'sarahk',
      text: "Shirt is so underrated compared to Kill Bill. The way it builds from that opening riff — I've listened to it probably 80 times.",
      like_handles: ['marcusc', 'priyap'],
    },
    {
      rec_title: 'SOS',
      rec_handle: 'marcusc',
      commenter_handle: 'jordanw',
      text: "The 80 minutes as a single sustained mood is exactly the right description. It's the rare album where sequencing is as important as the songs themselves.",
      like_handles: ['marcusc'],
    },
  ]

  // ── Insert comments ───────────────────────────────────────────────────────────

  let inserted = 0
  let skipped = 0

  const insertedComments: Array<{ id: string; like_handles: string[] }> = []

  for (const seed of commentSeeds) {
    const commenterUserId = idFor[seed.commenter_handle]
    if (!commenterUserId) {
      console.log(`  ⊘ Skipping comment (commenter not found): @${seed.commenter_handle}`)
      skipped++
      continue
    }

    // Find the rec by title + rec author handle
    const recAuthorId = idFor[seed.rec_handle]
    if (!recAuthorId) {
      console.log(`  ⊘ Skipping comment (rec author not found): @${seed.rec_handle}`)
      skipped++
      continue
    }

    const targetRec = (recsByTitle[seed.rec_title] ?? []).find(r => r.user_id === recAuthorId)
    if (!targetRec) {
      console.log(`  ⊘ Skipping comment (rec not found): "${seed.rec_title}" by @${seed.rec_handle}`)
      skipped++
      continue
    }

    // Check if this comment already exists (same user, rec, and first 50 chars of text)
    const { data: existing } = await supabase
      .from('comments')
      .select('id')
      .eq('user_id', commenterUserId)
      .eq('recommendation_id', targetRec.id)
      .ilike('text', seed.text.substring(0, 50) + '%')
      .maybeSingle()

    if (existing) {
      console.log(`  ✓ Already exists: @${seed.commenter_handle} on "${seed.rec_title}"`)
      insertedComments.push({ id: existing.id, like_handles: seed.like_handles })
      skipped++
      continue
    }

    const { data: newComment, error } = await supabase.from('comments').insert({
      user_id: commenterUserId,
      recommendation_id: targetRec.id,
      text: seed.text,
    }).select('id').single()

    if (error || !newComment) {
      console.error(`  ✗ Failed: @${seed.commenter_handle} on "${seed.rec_title}":`, error?.message)
    } else {
      console.log(`  ✓ Inserted: @${seed.commenter_handle} on "${seed.rec_title}"`)
      insertedComments.push({ id: newComment.id, like_handles: seed.like_handles })
      inserted++
    }
  }

  console.log(`\n✓ Comments: Inserted ${inserted}, Skipped ${skipped}`)

  // ── Insert comment likes ──────────────────────────────────────────────────────

  console.log('\nSeeding comment likes...')
  let likesInserted = 0
  let likesSkipped = 0

  for (const { id: commentId, like_handles } of insertedComments) {
    for (const likeHandle of like_handles) {
      const likerUserId = idFor[likeHandle]
      if (!likerUserId) continue

      const { data: existingLike } = await supabase
        .from('comment_likes')
        .select('id')
        .eq('user_id', likerUserId)
        .eq('comment_id', commentId)
        .maybeSingle()

      if (existingLike) {
        likesSkipped++
        continue
      }

      const { error: likeErr } = await supabase.from('comment_likes').insert({
        user_id: likerUserId,
        comment_id: commentId,
      })

      if (likeErr) {
        console.error(`  ✗ Like failed for @${likeHandle} on comment ${commentId}:`, likeErr.message)
      } else {
        likesInserted++
      }
    }
  }

  console.log(`✓ Comment likes: Inserted ${likesInserted}, Skipped ${likesSkipped}`)
  console.log('\n✅ seed-comments complete!')
}

main().catch(err => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
