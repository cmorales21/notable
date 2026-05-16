// Notable — Demo Data Seed Script
//
// Creates 6 demo users with movie recommendations, likes, bookmarks,
// comments, and follows so the site looks populated for visual testing.
//
// Run with:
//   npx tsx --env-file=.env.local scripts/seed-demo-data.ts
//
// Idempotent: skips users that already exist (checks by handle).
// Remove demo data with: npx tsx --env-file=.env.local scripts/clear-demo-data.ts

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

// ─── User definitions ─────────────────────────────────────────────────────────

const DEMO_USERS = [
  {
    key: 'sofia',
    handle: 'demo_sofia',
    email: 'demo_sofia@notable.test',
    name: 'Sofia Reyes',
    bio: 'Film obsessive. Cookbook collector. Always has a restaurant recommendation.',
    avatar_url: 'https://i.pravatar.cc/150?u=demo_sofia',
  },
  {
    key: 'marco',
    handle: 'demo_marco',
    email: 'demo_marco@notable.test',
    name: 'Marco Chen',
    bio: 'Cinephile and vinyl head. If it has a good soundtrack, I\'m in.',
    avatar_url: 'https://i.pravatar.cc/150?u=demo_marco',
  },
  {
    key: 'ana',
    handle: 'demo_ana',
    email: 'demo_ana@notable.test',
    name: 'Ana Kowalski',
    bio: 'Reads too much, eats too well, watches everything twice.',
    avatar_url: 'https://i.pravatar.cc/150?u=demo_ana',
  },
  {
    key: 'james',
    handle: 'demo_james',
    email: 'demo_james@notable.test',
    name: 'James Okafor',
    bio: 'Director of nothing, critic of everything. Mostly movies and music.',
    avatar_url: 'https://i.pravatar.cc/150?u=demo_james',
  },
  {
    key: 'lucia',
    handle: 'demo_lucia',
    email: 'demo_lucia@notable.test',
    name: 'Lucía Vega',
    bio: 'The friend who always knows where to eat and what to watch.',
    avatar_url: 'https://i.pravatar.cc/150?u=demo_lucia',
  },
  {
    key: 'priya',
    handle: 'demo_priya',
    email: 'demo_priya@notable.test',
    name: 'Priya Nair',
    bio: 'Documentary lover. Podcast addict. Reluctant foodie.',
    avatar_url: 'https://i.pravatar.cc/150?u=demo_priya',
  },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysAgo(n: number): string {
  const d = new Date('2026-05-15T12:00:00Z')
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Notable demo seed starting...\n')

  // ── Step 1: Create auth users ─────────────────────────────────────────────

  console.log('Step 1: Creating auth users...')

  // Check which demo handles already exist so we're idempotent
  const { data: existingProfiles } = await supabase
    .from('profiles')
    .select('id, handle')
    .in('handle', DEMO_USERS.map(u => u.handle))

  const existingHandles = new Set((existingProfiles ?? []).map(p => p.handle))
  const idByHandle: Record<string, string> = {}
  for (const p of existingProfiles ?? []) idByHandle[p.handle] = p.id

  for (const user of DEMO_USERS) {
    if (existingHandles.has(user.handle)) {
      console.log(`  ⏭  ${user.handle} already exists (${idByHandle[user.handle]})`)
      continue
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: 'Notable2024!',
      email_confirm: true,
    })

    if (error) {
      console.error(`  ✗  Failed to create ${user.email}:`, error.message)
      process.exit(1)
    }

    idByHandle[user.handle] = data.user.id
    console.log(`  ✓  Created ${user.email} → ${data.user.id}`)
  }

  // ── Step 2: Upsert profiles ───────────────────────────────────────────────

  console.log('\nStep 2: Upserting profiles...')

  const profileRows = DEMO_USERS.map(u => ({
    id: idByHandle[u.handle],
    name: u.name,
    handle: u.handle,
    email: u.email,
    avatar_url: u.avatar_url,
    bio: u.bio,
    is_onboarded: true,
  }))

  const { error: profileErr } = await supabase
    .from('profiles')
    .upsert(profileRows, { onConflict: 'id' })

  if (profileErr) {
    console.error('  ✗  Profile upsert failed:', profileErr.message)
    process.exit(1)
  }
  console.log(`  ✓  Upserted ${profileRows.length} profiles`)

  // Convenience aliases
  const sofia = idByHandle['demo_sofia']
  const marco = idByHandle['demo_marco']
  const ana   = idByHandle['demo_ana']
  const james = idByHandle['demo_james']
  const lucia = idByHandle['demo_lucia']
  const priya = idByHandle['demo_priya']

  // ── Step 3: Insert recommendations ───────────────────────────────────────

  console.log('\nStep 3: Inserting recommendations...')

  // Check which recs already exist for demo users
  const { data: existingRecs } = await supabase
    .from('recommendations')
    .select('id, user_id, title')
    .in('user_id', [sofia, marco, ana, james, lucia, priya])

  type ExistingRec = { id: string; user_id: string; title: string }
  const existingRecSet = new Set(
    (existingRecs as ExistingRec[] ?? []).map(r => `${r.user_id}::${r.title}`)
  )

  const recDefinitions = [
    // ── Individual recommendations ───────────────────────────────────────────
    {
      key: 'aftersun',
      user_id: sofia,
      category: 'movies',
      title: 'Aftersun',
      description: "I watched this alone on a Tuesday night and sat in silence for twenty minutes after. It says everything about memory and parenthood without ever saying it directly. Charlotte Wells made something that lives in your chest.",
      image_url: 'https://image.tmdb.org/t/p/w500/yMbAFkI089F3kSDUaKFuJMdS1lM.jpg',
      external_url: 'https://www.themoviedb.org/movie/906221-aftersun',
      created_at: daysAgo(14),
    },
    {
      key: 'past_lives',
      user_id: marco,
      category: 'movies',
      title: 'Past Lives',
      description: "The restraint in this film is extraordinary. Two people, decades apart, sitting on a bench — and somehow it contains an entire universe of what-ifs. Celine Song understood something about connection that most filmmakers never touch.",
      image_url: 'https://image.tmdb.org/t/p/w500/k3waqVXSnvCZWfJYNtdamTgTtTA.jpg',
      external_url: 'https://www.themoviedb.org/movie/666277-past-lives',
      created_at: daysAgo(13),
    },
    {
      key: 'holdovers',
      user_id: ana,
      category: 'movies',
      title: 'The Holdovers',
      description: "Paul Giamatti was born to play this role. Grumpy, brilliant, deeply lonely — and then this kid cracks him open. It's funny and devastating in equal measure. The kind of film they don't make enough of anymore.",
      image_url: 'https://image.tmdb.org/t/p/w500/VHSzNBTwxV8vh7wylo7O9CLdac.jpg',
      external_url: 'https://www.themoviedb.org/movie/840430-the-holdovers',
      created_at: daysAgo(12),
    },
    {
      key: 'anatomy',
      user_id: james,
      category: 'movies',
      title: 'Anatomy of a Fall',
      description: "A courtroom drama that's actually about the impossibility of ever truly knowing another person. Justine Triet layers ambiguity on ambiguity until you realize your judgment says more about you than the accused. Masterful.",
      image_url: 'https://image.tmdb.org/t/p/w500/kQs6gmfNngORnINzFMSeFcAAANi.jpg',
      external_url: 'https://www.themoviedb.org/movie/915935-anatomie-d-une-chute',
      created_at: daysAgo(11),
    },
    {
      key: 'challengers',
      user_id: lucia,
      category: 'movies',
      title: 'Challengers',
      description: "Luca Guadagnino turned a tennis movie into the most electrifying love triangle I've seen in years. Zendaya is magnetic. The Reznor/Ross score is unreal. I've seen it three times and I'm going again.",
      image_url: 'https://image.tmdb.org/t/p/w500/H6vke7zGiuLsz4v4RPeReb9rsv.jpg',
      external_url: 'https://www.themoviedb.org/movie/945961-challengers',
      created_at: daysAgo(10),
    },
    {
      key: 'all_of_us',
      user_id: priya,
      category: 'movies',
      title: 'All of Us Strangers',
      description: "Andrew Scott in this film broke something in me. It's a ghost story, a love story, a grief story — all woven together so delicately you don't realize how deep you're in until it's too late. Hauntingly beautiful.",
      image_url: 'https://image.tmdb.org/t/p/w500/aWJtx3ZMRaBZaJhkSI5kfbFX76H.jpg',
      external_url: 'https://www.themoviedb.org/movie/996727-all-of-us-strangers',
      created_at: daysAgo(9),
    },

    // ── Zone of Interest (Sofia + Marco) ─────────────────────────────────────
    {
      key: 'zone_sofia',
      user_id: sofia,
      category: 'movies',
      title: 'The Zone of Interest',
      description: "The most disturbing film I've seen in years, and barely anything happens on screen. Jonathan Glazer forces you to confront evil through its banality — garden parties while the smoke rises next door. I couldn't shake it for days.",
      image_url: 'https://image.tmdb.org/t/p/w500/hUu9zyZmDd8VZegKi1iK1Vk0RYS.jpg',
      external_url: 'https://www.themoviedb.org/movie/467244-the-zone-of-interest',
      created_at: daysAgo(8),
    },
    {
      key: 'zone_marco',
      user_id: marco,
      category: 'movies',
      title: 'The Zone of Interest',
      description: "Sound design as horror. You never see what's happening on the other side of the wall, but you hear everything. Glazer made the absence more terrifying than any image could be.",
      image_url: 'https://image.tmdb.org/t/p/w500/hUu9zyZmDd8VZegKi1iK1Vk0RYS.jpg',
      external_url: 'https://www.themoviedb.org/movie/467244-the-zone-of-interest',
      created_at: daysAgo(8),
    },

    // ── Poor Things (Ana + Lucia) ─────────────────────────────────────────────
    {
      key: 'poor_ana',
      user_id: ana,
      category: 'movies',
      title: 'Poor Things',
      description: "Yorgos Lanthimos finally made a film that's as warm as it is weird. Emma Stone is absolutely fearless — funny, shocking, tender. The production design alone is worth the ticket.",
      image_url: 'https://image.tmdb.org/t/p/w500/kCGlIMHnOm8JPXq3rXM6c5wMxcT.jpg',
      external_url: 'https://www.themoviedb.org/movie/792307-poor-things',
      created_at: daysAgo(7),
    },
    {
      key: 'poor_lucia',
      user_id: lucia,
      category: 'movies',
      title: 'Poor Things',
      description: "Emma Stone deserved every award for this. Watching Bella Baxter discover the world with zero social conditioning is hilarious and oddly moving. It's bonkers and beautiful.",
      image_url: 'https://image.tmdb.org/t/p/w500/kCGlIMHnOm8JPXq3rXM6c5wMxcT.jpg',
      external_url: 'https://www.themoviedb.org/movie/792307-poor-things',
      created_at: daysAgo(7),
    },

    // ── Oppenheimer (James + Priya) ───────────────────────────────────────────
    {
      key: 'opp_james',
      user_id: james,
      category: 'movies',
      title: 'Oppenheimer',
      description: "Three hours and I didn't blink. Nolan built a ticking clock inside a moral crisis inside a political thriller. Cillian Murphy's eyes carry the weight of the entire twentieth century. The Trinity test sequence is cinema at its peak.",
      image_url: 'https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg',
      external_url: 'https://www.themoviedb.org/movie/872585-oppenheimer',
      created_at: daysAgo(5),
    },
    {
      key: 'opp_priya',
      user_id: priya,
      category: 'movies',
      title: 'Oppenheimer',
      description: "I went in expecting spectacle and got philosophy. The Strauss subplot is Nolan at his most structurally ambitious. And that score — Ludwig Göransson understood the assignment completely.",
      image_url: 'https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg',
      external_url: 'https://www.themoviedb.org/movie/872585-oppenheimer',
      created_at: daysAgo(5),
    },

    // ── Dune Part Two (Marco + Ana + James) ───────────────────────────────────
    {
      key: 'dune_marco',
      user_id: marco,
      category: 'movies',
      title: 'Dune: Part Two',
      description: "Villeneuve made the impossible look effortless. The sandworm riding sequence alone justifies IMAX existing. This is what blockbuster filmmaking should aspire to.",
      image_url: 'https://image.tmdb.org/t/p/w500/8b8R8l88Qje9dn9OE8PY05Nez7S.jpg',
      external_url: 'https://www.themoviedb.org/movie/693134-dune-part-two',
      created_at: daysAgo(3),
    },
    {
      key: 'dune_ana',
      user_id: ana,
      category: 'movies',
      title: 'Dune: Part Two',
      description: "I didn't think they could top Part One, but this is bigger, bolder, and somehow more intimate. Austin Butler as Feyd-Rautha is terrifying. Chani's arc is heartbreaking.",
      image_url: 'https://image.tmdb.org/t/p/w500/8b8R8l88Qje9dn9OE8PY05Nez7S.jpg',
      external_url: 'https://www.themoviedb.org/movie/693134-dune-part-two',
      created_at: daysAgo(3),
    },
    {
      key: 'dune_james',
      user_id: james,
      category: 'movies',
      title: 'Dune: Part Two',
      description: "Finally, a sequel that understands escalation isn't just about scale — it's about stakes. Villeneuve respected Herbert's complexity while making it viscerally cinematic. Best sci-fi since Blade Runner 2049.",
      image_url: 'https://image.tmdb.org/t/p/w500/8b8R8l88Qje9dn9OE8PY05Nez7S.jpg',
      external_url: 'https://www.themoviedb.org/movie/693134-dune-part-two',
      created_at: daysAgo(3),
    },
  ]

  const recsToInsert = recDefinitions.filter(
    r => !existingRecSet.has(`${r.user_id}::${r.title}`)
  )

  // Insert one at a time so we can collect IDs
  const recIdByKey: Record<string, string> = {}

  // Pre-populate IDs for recs that already existed
  for (const existing of existingRecs as ExistingRec[] ?? []) {
    const def = recDefinitions.find(
      d => d.user_id === existing.user_id && d.title === existing.title
    )
    if (def) recIdByKey[def.key] = existing.id
  }

  let recsCreated = 0
  for (const rec of recsToInsert) {
    const { key, ...row } = rec
    const { data, error } = await supabase
      .from('recommendations')
      .insert(row)
      .select('id')
      .single()

    if (error) {
      console.error(`  ✗  Failed to insert "${rec.title}" for ${rec.user_id}:`, error.message)
      process.exit(1)
    }

    recIdByKey[key] = data.id
    recsCreated++
  }

  console.log(`  ✓  Inserted ${recsCreated} recommendations (${recDefinitions.length - recsCreated} already existed)`)

  // ── Step 4: Likes ─────────────────────────────────────────────────────────

  console.log('\nStep 4: Inserting likes...')

  const likeDefs = [
    // Aftersun (Sofia's)
    { user_id: marco, key: 'aftersun' },
    { user_id: ana,   key: 'aftersun' },
    { user_id: lucia, key: 'aftersun' },
    { user_id: priya, key: 'aftersun' },
    // Past Lives (Marco's)
    { user_id: sofia, key: 'past_lives' },
    { user_id: ana,   key: 'past_lives' },
    { user_id: james, key: 'past_lives' },
    { user_id: lucia, key: 'past_lives' },
    // The Holdovers (Ana's)
    { user_id: sofia, key: 'holdovers' },
    { user_id: marco, key: 'holdovers' },
    { user_id: james, key: 'holdovers' },
    // Anatomy of a Fall (James's)
    { user_id: sofia, key: 'anatomy' },
    { user_id: ana,   key: 'anatomy' },
    { user_id: priya, key: 'anatomy' },
    // Challengers (Lucia's)
    { user_id: marco, key: 'challengers' },
    { user_id: ana,   key: 'challengers' },
    { user_id: james, key: 'challengers' },
    // All of Us Strangers (Priya's)
    { user_id: sofia, key: 'all_of_us' },
    { user_id: marco, key: 'all_of_us' },
    { user_id: lucia, key: 'all_of_us' },
    // Zone of Interest (Sofia's)
    { user_id: ana,   key: 'zone_sofia' },
    { user_id: james, key: 'zone_sofia' },
    { user_id: priya, key: 'zone_sofia' },
    // Zone of Interest (Marco's)
    { user_id: sofia, key: 'zone_marco' },
    { user_id: lucia, key: 'zone_marco' },
    // Poor Things (Ana's)
    { user_id: sofia, key: 'poor_ana' },
    { user_id: marco, key: 'poor_ana' },
    { user_id: james, key: 'poor_ana' },
    { user_id: priya, key: 'poor_ana' },
    // Poor Things (Lucia's)
    { user_id: ana,   key: 'poor_lucia' },
    { user_id: marco, key: 'poor_lucia' },
    // Oppenheimer (James's)
    { user_id: sofia, key: 'opp_james' },
    { user_id: marco, key: 'opp_james' },
    { user_id: ana,   key: 'opp_james' },
    { user_id: lucia, key: 'opp_james' },
    // Oppenheimer (Priya's)
    { user_id: james, key: 'opp_priya' },
    { user_id: sofia, key: 'opp_priya' },
    // Dune Part Two (Marco's)
    { user_id: sofia, key: 'dune_marco' },
    { user_id: ana,   key: 'dune_marco' },
    { user_id: lucia, key: 'dune_marco' },
    { user_id: priya, key: 'dune_marco' },
    // Dune Part Two (Ana's)
    { user_id: marco, key: 'dune_ana' },
    { user_id: james, key: 'dune_ana' },
    // Dune Part Two (James's)
    { user_id: marco, key: 'dune_james' },
    { user_id: sofia, key: 'dune_james' },
    { user_id: priya, key: 'dune_james' },
  ]

  // Fetch already-existing likes for demo recs
  const demoRecIds = Object.values(recIdByKey)
  const { data: existingLikes } = await supabase
    .from('likes')
    .select('user_id, recommendation_id')
    .in('recommendation_id', demoRecIds)

  const existingLikeSet = new Set(
    (existingLikes ?? []).map(l => `${l.user_id}::${l.recommendation_id}`)
  )

  const likesToInsert = likeDefs
    .filter(l => recIdByKey[l.key]) // skip if rec wasn't created
    .filter(l => !existingLikeSet.has(`${l.user_id}::${recIdByKey[l.key]}`))
    .map(l => ({ user_id: l.user_id, recommendation_id: recIdByKey[l.key] }))

  if (likesToInsert.length > 0) {
    const { error: likeErr } = await supabase.from('likes').insert(likesToInsert)
    if (likeErr) console.error('  ✗  Likes insert failed:', likeErr.message)
    else console.log(`  ✓  Inserted ${likesToInsert.length} likes`)
  } else {
    console.log('  ⏭  All likes already exist')
  }

  // ── Step 5: Bookmarks ─────────────────────────────────────────────────────

  console.log('\nStep 5: Inserting bookmarks...')

  const bookmarkDefs = [
    { user_id: sofia, key: 'past_lives' },
    { user_id: sofia, key: 'all_of_us' },
    { user_id: sofia, key: 'anatomy' },
    { user_id: marco, key: 'aftersun' },
    { user_id: marco, key: 'poor_ana' },
    { user_id: marco, key: 'all_of_us' },
    { user_id: ana,   key: 'challengers' },
    { user_id: ana,   key: 'dune_marco' },
    { user_id: james, key: 'aftersun' },
    { user_id: james, key: 'past_lives' },
    { user_id: lucia, key: 'anatomy' },
    { user_id: lucia, key: 'opp_james' },
    { user_id: lucia, key: 'holdovers' },
    { user_id: priya, key: 'past_lives' },
    { user_id: priya, key: 'challengers' },
    { user_id: priya, key: 'poor_ana' },
  ]

  const { data: existingBookmarks } = await supabase
    .from('bookmarks')
    .select('user_id, recommendation_id')
    .in('recommendation_id', demoRecIds)

  const existingBmSet = new Set(
    (existingBookmarks ?? []).map(b => `${b.user_id}::${b.recommendation_id}`)
  )

  const bookmarksToInsert = bookmarkDefs
    .filter(b => recIdByKey[b.key])
    .filter(b => !existingBmSet.has(`${b.user_id}::${recIdByKey[b.key]}`))
    .map(b => ({ user_id: b.user_id, recommendation_id: recIdByKey[b.key] }))

  if (bookmarksToInsert.length > 0) {
    const { error: bmErr } = await supabase.from('bookmarks').insert(bookmarksToInsert)
    if (bmErr) console.error('  ✗  Bookmarks insert failed:', bmErr.message)
    else console.log(`  ✓  Inserted ${bookmarksToInsert.length} bookmarks`)
  } else {
    console.log('  ⏭  All bookmarks already exist')
  }

  // ── Step 6: Comments ──────────────────────────────────────────────────────

  console.log('\nStep 6: Inserting comments...')

  const commentDefs = [
    // On Aftersun (Sofia's)
    { user_id: marco, key: 'aftersun', text: 'The pool scene. That\'s all I\'ll say.' },
    { user_id: ana,   key: 'aftersun', text: 'I\'ve recommended this to everyone I know. Nobody regrets it.' },
    // On Past Lives (Marco's)
    { user_id: sofia, key: 'past_lives', text: 'The ending destroyed me. In the best way.' },
    { user_id: lucia, key: 'past_lives', text: 'Watched it twice in one weekend. The bench scene is perfect.' },
    // On Challengers (Lucia's)
    { user_id: james, key: 'challengers', text: 'That final point. Guadagnino is showing off and I am here for it.' },
    { user_id: marco, key: 'challengers', text: 'The soundtrack alone deserves a recommendation.' },
    // On Poor Things (Ana's)
    { user_id: sofia, key: 'poor_ana', text: 'The production design is insane. Every frame could be a painting.' },
    { user_id: james, key: 'poor_ana', text: 'Emma Stone understood the assignment on a molecular level.' },
    // On Oppenheimer (James's)
    { user_id: marco, key: 'opp_james', text: 'The hearing scenes are more tense than the bomb.' },
    { user_id: ana,   key: 'opp_james', text: 'Ludwig Göransson\'s score is doing at least 40% of the emotional heavy lifting.' },
    // On Dune Part Two (Marco's)
    { user_id: lucia, key: 'dune_marco', text: 'I screamed in the theater during the sandworm scene. No regrets.' },
    { user_id: priya, key: 'dune_marco', text: 'Austin Butler made Feyd-Rautha genuinely terrifying.' },
    // On Zone of Interest (Sofia's)
    { user_id: priya, key: 'zone_sofia', text: 'The sound design haunted me for days. Glazer is a genius.' },
  ]

  // Fetch existing comments on demo recs to avoid duplicates
  const { data: existingComments } = await supabase
    .from('comments')
    .select('user_id, recommendation_id, text')
    .in('recommendation_id', demoRecIds)

  const existingCommentSet = new Set(
    (existingComments ?? []).map(c => `${c.user_id}::${c.recommendation_id}::${c.text.slice(0, 20)}`)
  )

  const commentsToInsert = commentDefs
    .filter(c => recIdByKey[c.key])
    .filter(c => !existingCommentSet.has(`${c.user_id}::${recIdByKey[c.key]}::${c.text.slice(0, 20)}`))
    .map(c => ({
      user_id: c.user_id,
      recommendation_id: recIdByKey[c.key],
      text: c.text,
    }))

  if (commentsToInsert.length > 0) {
    const { error: commentErr } = await supabase.from('comments').insert(commentsToInsert)
    if (commentErr) console.error('  ✗  Comments insert failed:', commentErr.message)
    else console.log(`  ✓  Inserted ${commentsToInsert.length} comments`)
  } else {
    console.log('  ⏭  All comments already exist')
  }

  // ── Step 7: Follows ───────────────────────────────────────────────────────

  console.log('\nStep 7: Inserting follows...')

  const followDefs = [
    // Sofia follows Marco, Ana, Lucia
    { follower_id: sofia, following_id: marco },
    { follower_id: sofia, following_id: ana },
    { follower_id: sofia, following_id: lucia },
    // Marco follows Sofia, James, Priya
    { follower_id: marco, following_id: sofia },
    { follower_id: marco, following_id: james },
    { follower_id: marco, following_id: priya },
    // Ana follows Sofia, Marco, Lucia, James
    { follower_id: ana, following_id: sofia },
    { follower_id: ana, following_id: marco },
    { follower_id: ana, following_id: lucia },
    { follower_id: ana, following_id: james },
    // James follows Marco, Ana, Priya
    { follower_id: james, following_id: marco },
    { follower_id: james, following_id: ana },
    { follower_id: james, following_id: priya },
    // Lucia follows Sofia, Ana, Priya
    { follower_id: lucia, following_id: sofia },
    { follower_id: lucia, following_id: ana },
    { follower_id: lucia, following_id: priya },
    // Priya follows Marco, James, Lucia
    { follower_id: priya, following_id: marco },
    { follower_id: priya, following_id: james },
    { follower_id: priya, following_id: lucia },
  ]

  const allDemoIds = [sofia, marco, ana, james, lucia, priya]
  const { data: existingFollows } = await supabase
    .from('follows')
    .select('follower_id, following_id')
    .in('follower_id', allDemoIds)

  const existingFollowSet = new Set(
    (existingFollows ?? []).map(f => `${f.follower_id}::${f.following_id}`)
  )

  const followsToInsert = followDefs.filter(
    f => !existingFollowSet.has(`${f.follower_id}::${f.following_id}`)
  )

  if (followsToInsert.length > 0) {
    const { error: followErr } = await supabase.from('follows').insert(followsToInsert)
    if (followErr) console.error('  ✗  Follows insert failed:', followErr.message)
    else console.log(`  ✓  Inserted ${followsToInsert.length} follows`)
  } else {
    console.log('  ⏭  All follows already exist')
  }

  // ── Summary ───────────────────────────────────────────────────────────────

  console.log('\n✅ Demo seed complete!\n')
  console.log('  6 demo users')
  console.log(`  ${recDefinitions.length} recommendations (${recsCreated} new)`)
  console.log(`  ${likesToInsert.length} likes inserted`)
  console.log(`  ${bookmarksToInsert.length} bookmarks inserted`)
  console.log(`  ${commentsToInsert.length} comments inserted`)
  console.log(`  ${followsToInsert.length} follows inserted`)
  console.log('\nTo remove all demo data:')
  console.log('  npx tsx --env-file=.env.local scripts/clear-demo-data.ts')
}

main().catch(err => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
