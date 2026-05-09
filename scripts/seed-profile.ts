// Notable — Phase 9 Profile Seed Script
//
// Enriches @sarahk into a showcase profile and seeds follows between all users.
//
// Run with:
//   npx tsx --env-file=.env.local scripts/seed-profile.ts
//
// Idempotent — safe to re-run. Checks for existing follows/recs before inserting.

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
  console.log('Phase 9 seed starting...\n')

  // ── Resolve handles to user IDs ──────────────────────────────────────────────

  const handles = ['sarahk', 'marcusc', 'priyap', 'jordanw', 'elenar', 'tylerb']
  const { data: profileRows, error: profileErr } = await supabase
    .from('profiles')
    .select('id, handle')
    .in('handle', handles)

  if (profileErr || !profileRows?.length) {
    console.error('Could not find seed profiles. Run seed-feed.ts first.\n', profileErr?.message)
    process.exit(1)
  }

  const idFor: Record<string, string> = {}
  for (const p of profileRows) idFor[p.handle] = p.id

  const missing = handles.filter(h => !idFor[h])
  if (missing.length) {
    console.error('Missing profiles for handles:', missing.join(', '))
    console.error('Run seed-feed.ts first.')
    process.exit(1)
  }

  const sarah  = idFor['sarahk']
  const marcus = idFor['marcusc']
  const priya  = idFor['priyap']
  const jordan = idFor['jordanw']
  const elena  = idFor['elenar']
  const tyler  = idFor['tylerb']

  console.log('Resolved user IDs:')
  for (const [h, id] of Object.entries(idFor)) console.log(`  @${h} → ${id}`)
  console.log()

  // ── Update @sarahk bio ───────────────────────────────────────────────────────

  console.log('Updating @sarahk profile...')
  const { error: bioErr } = await supabase
    .from('profiles')
    .update({ bio: 'Film lover. Voracious reader. Always hunting for the perfect meal.' })
    .eq('id', sarah)
  if (bioErr) console.error('  Bio update failed:', bioErr.message)
  else console.log('  ✓ Bio updated')

  // ── @sarahk extra recommendations ────────────────────────────────────────────

  console.log('\nChecking @sarahk recommendation count...')
  const { data: existingRecs } = await supabase
    .from('recommendations')
    .select('id, category')
    .eq('user_id', sarah)

  const existingCount = existingRecs?.length ?? 0
  console.log(`  Existing: ${existingCount} recommendations`)

  const newRecs = [
    // ── Books (target: 4 total for sarah) ───────────────────────────────────
    {
      user_id: sarah, category: 'books', title: 'A Little Life',
      description: "This book broke me in the best possible way. Hanya Yanagihara writes about trauma and love and chosen family with a precision that feels almost cruel. I had to put it down four times in the last hundred pages because I couldn't see through the tears. One of those rare novels that actually changes the shape of you.",
      image_url: 'https://covers.openlibrary.org/b/id/8231587-L.jpg',
      external_url: 'https://openlibrary.org/works/OL17796939W',
    },
    {
      user_id: sarah, category: 'books', title: 'The Secret History',
      description: "Donna Tartt's debut and still maybe her best. A group of classics students at a small Vermont college — I kept reading at 1am telling myself just one more page. The tension is unbearable in the best way, and the ending lands with an inevitability that feels both surprising and completely right. Perfect for a long weekend.",
      image_url: 'https://covers.openlibrary.org/b/id/10523078-L.jpg',
      external_url: 'https://openlibrary.org/works/OL15358985W',
    },
    {
      user_id: sarah, category: 'books', title: 'Demon Copperhead',
      description: "Barbara Kingsolver reimagines David Copperfield in rural Appalachia during the opioid crisis, and it is devastating and brilliant. The voice is completely alive and specific. She won the Pulitzer for it and every word of that recognition is deserved. Play this on a rainy Sunday morning — clear your whole day because you won't want to stop.",
      image_url: 'https://covers.openlibrary.org/b/id/13272628-L.jpg',
      external_url: 'https://openlibrary.org/works/OL26315951W',
    },
    {
      user_id: sarah, category: 'books', title: 'Bewilderment',
      description: "Richard Powers writes a father and his neurodivergent son against the backdrop of an Earth in ecological collapse. The science is real and the grief is realer. I finished it on a cross-country flight and sat in the gate for twenty minutes just staring at the floor. Quieter than The Overstory but even more personal.",
      image_url: 'https://covers.openlibrary.org/b/id/12642241-L.jpg',
      external_url: 'https://openlibrary.org/works/OL24214986W',
    },

    // ── Movies (target: 5 total for sarah) ──────────────────────────────────
    {
      user_id: sarah, category: 'movies', title: 'Portrait of a Lady on Fire',
      description: "Céline Sciamma made the most visually precise and emotionally devastating romance I've ever seen. Two women in 18th century Brittany — a painter and her subject — falling in love in the stolen space between convention and freedom. The look. You'll know the one. I've thought about it almost every day since I first watched it.",
      image_url: 'https://image.tmdb.org/t/p/w500/3xGCGMBQTkPOpR2PkMTObFwZCFO.jpg',
      external_url: 'https://www.themoviedb.org/movie/578701',
    },
    {
      user_id: sarah, category: 'movies', title: 'Tár',
      description: "Cate Blanchett gives maybe the greatest screen performance I've seen in my lifetime. Todd Field made a film about power and complicity and art that refuses easy answers. I walked out of the theater not sure what I thought and spent the next week still thinking about it. That's how you know it's something real.",
      image_url: 'https://image.tmdb.org/t/p/w500/aaCJhKGTbfBTJyhe42D9z7F8vTJ.jpg',
      external_url: 'https://www.themoviedb.org/movie/842986',
    },
    {
      user_id: sarah, category: 'movies', title: 'The Favourite',
      description: "Yorgos Lanthimos at his most wickedly funny and his most formally adventurous. Three women in the court of Queen Anne — each performance is a masterclass. The film keeps pulling the rug out from under you on who to root for, which means you're rooting for all three of them and none of them simultaneously. Absolutely extraordinary.",
      image_url: 'https://image.tmdb.org/t/p/w500/zP8GdmQUE7CQLSH4ZMBJJWPBTXZ.jpg',
      external_url: 'https://www.themoviedb.org/movie/495233',
    },
    {
      user_id: sarah, category: 'movies', title: 'Dune: Part Two',
      description: "Denis Villeneuve made the second half of an epic and somehow outdid the first. The scale is staggering but it never loses the intimate character work underneath. Zendaya finally gets to be a real character and she is magnificent. The theater I saw this in shook during the Harkonnen battle scenes. Cinema. Actual cinema.",
      image_url: 'https://image.tmdb.org/t/p/w500/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg',
      external_url: 'https://www.themoviedb.org/movie/693134',
    },
    {
      user_id: sarah, category: 'movies', title: 'Moonlight',
      description: "Barry Jenkins made a film about Black masculinity, queerness, and tenderness that felt like nothing I'd ever seen. Three chapters, three actors playing the same man at different ages — and somehow every one of them is completely that person. The dinner scene in the third act. I will never forget it.",
      image_url: 'https://image.tmdb.org/t/p/w500/hSB2HuDuDNy6NQo6NvCq3SHwTk8.jpg',
      external_url: 'https://www.themoviedb.org/movie/376867',
    },

    // ── Music (target: 3 for sarah) ─────────────────────────────────────────
    {
      user_id: sarah, category: 'music', title: 'Folklore',
      description: "Taylor Swift retreating to a cabin with Aaron Dessner during lockdown and making this was one of the best things to happen to music in years. It's quiet and autumnal and full of fictional characters living out their grief. August and Seven are the best things she's ever written. Play this on a rainy Sunday morning — or any morning when you need to feel something slowly.",
      image_url: 'https://upload.wikimedia.org/wikipedia/en/f/f8/Taylor_Swift_-_Folklore.png',
      external_url: 'https://open.spotify.com/album/2fenSS68JI1h4Fo296JfGr',
    },
    {
      user_id: sarah, category: 'music', title: 'Punisher',
      description: "Phoebe Bridgers writes songs that feel like she's reading your diary without your permission and somehow making it more beautiful than you ever could have. Savior Complex is the most devastating four minutes in recent music. I've made roughly fifteen people listen to this album cold and they all came back to me shaken. This is the one.",
      image_url: 'https://upload.wikimedia.org/wikipedia/en/0/04/Phoebe_Bridgers_-_Punisher.png',
      external_url: 'https://open.spotify.com/album/2xECuqpkviLBDLFOaMz5QA',
    },
    {
      user_id: sarah, category: 'music', title: 'Blue',
      description: "I know everyone says this about Blue but everyone says it because it's true. Joni Mitchell made an album that sounds like it was recorded yesterday and will still sound that way in a hundred years. A Case of You alone justifies adding this to any list of essential listening. If you've never actually sat with it, sit with it.",
      image_url: 'https://upload.wikimedia.org/wikipedia/en/3/33/Jonicoverblue.jpg',
      external_url: 'https://open.spotify.com/album/1vz94WpXDVYIEGja8cjFNa',
    },

    // ── Restaurants (target: 3 for sarah) ───────────────────────────────────
    {
      user_id: sarah, category: 'restaurants', title: 'Quince',
      description: "The most beautiful meal I've eaten in San Francisco. Michael and Lindsay Tusk's three-Michelin-star restaurant in the Jackson Square neighborhood is everything fine dining should be — precise and warm and full of surprise. The pasta course alone is worth the price of admission. Go for a birthday and dress for it.",
      image_url: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80',
      external_url: null,
    },
    {
      user_id: sarah, category: 'restaurants', title: 'Gjusta',
      description: "The best breakfast/lunch in Los Angeles and it's not close. The bakery case alone could occupy you for twenty minutes. I've had the grain bowl, the smoked fish toast, the laminated pastries, the house-cured meats — everything is extraordinary. Park a few blocks away, order more than you think you need, find a table in the courtyard.",
      image_url: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=800&q=80',
      external_url: null,
    },
    {
      user_id: sarah, category: 'restaurants', title: 'Momofuku Ko',
      description: "David Chang's chef's counter in the East Village is one of the most distinctive dining experiences in New York. You can see every dish being plated from twelve inches away. The menu changes constantly but the technique and the audacity never waver. The caviar on the potato chip — if it's still on the menu when you go, order it immediately.",
      image_url: 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=800&q=80',
      external_url: null,
    },

    // ── Podcasts (target: 2 for sarah) ──────────────────────────────────────
    {
      user_id: sarah, category: 'podcasts', title: 'You\'re Wrong About',
      description: "Michael Hobbes and Sarah Marshall take stories you thought you understood — the Satanic Panic, Tonya Harding, the D.A.R.E. program — and systematically dismantle the media narrative around them. Every episode makes you trust journalism slightly less and your own recall significantly less. The best podcast about how misinformation actually works.",
      image_url: 'https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=800&q=80',
      external_url: 'https://podcasts.apple.com/us/podcast/youre-wrong-about/id1380008439',
    },
    {
      user_id: sarah, category: 'podcasts', title: 'Normal Gossip',
      description: "Kelsey McKinney reads anonymous gossip about strangers to a guest and they discuss it with the same earnestness you'd devote to a documentary. It sounds absurd. It is the most calming, delightful podcast I have found. I put it on when I'm doing dishes or walking somewhere and it makes everything better. Start from the beginning.",
      image_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&q=80',
      external_url: 'https://podcasts.apple.com/us/podcast/normal-gossip/id1614524749',
    },
  ]

  // Filter out categories sarahk already has recs in (if enough exist)
  const existingCategories = new Set((existingRecs ?? []).map(r => r.category))
  const recsToInsert = newRecs.filter(r => {
    // Always insert if sarah has fewer than 2 in this category from the original seed
    const countInCat = (existingRecs ?? []).filter(e => e.category === r.category).length
    return countInCat < 2
  })

  if (recsToInsert.length > 0) {
    const { error: recErr } = await supabase.from('recommendations').insert(recsToInsert)
    if (recErr) console.error('  Failed to insert recs:', recErr.message)
    else console.log(`  ✓ Inserted ${recsToInsert.length} new recommendations for @sarahk`)
  } else {
    console.log('  @sarahk already has enough recommendations in each category — skipping')
  }

  // ── @sarahk likes (15 on other users' recs) ──────────────────────────────────

  console.log('\nSeeding @sarahk likes...')
  const { data: othersRecs } = await supabase
    .from('recommendations')
    .select('id, category')
    .neq('user_id', sarah)
    .limit(30)

  const { data: sarahExistingLikes } = await supabase
    .from('likes')
    .select('recommendation_id')
    .eq('user_id', sarah)

  const alreadyLiked = new Set((sarahExistingLikes ?? []).map(l => l.recommendation_id))
  const likeCandidates = (othersRecs ?? []).filter(r => !alreadyLiked.has(r.id))
  const likesToAdd = likeCandidates.slice(0, Math.max(0, 15 - alreadyLiked.size)).map(r => ({
    user_id: sarah,
    recommendation_id: r.id,
  }))

  if (likesToAdd.length > 0) {
    const { error: likeErr } = await supabase.from('likes').insert(likesToAdd)
    if (likeErr) console.error('  Likes insert failed:', likeErr.message)
    else console.log(`  ✓ Inserted ${likesToAdd.length} likes for @sarahk`)
  } else {
    console.log('  @sarahk already has 15+ likes — skipping')
  }

  // ── @sarahk bookmarks (8 on other users' recs) ───────────────────────────────

  console.log('\nSeeding @sarahk bookmarks...')
  const { data: sarahExistingBm } = await supabase
    .from('bookmarks')
    .select('recommendation_id')
    .eq('user_id', sarah)

  const alreadyBookmarked = new Set((sarahExistingBm ?? []).map(b => b.recommendation_id))
  const bmCandidates = (othersRecs ?? []).filter(r => !alreadyBookmarked.has(r.id) && !likesToAdd.find(l => l.recommendation_id === r.id))
  const bmToAdd = bmCandidates.slice(0, Math.max(0, 8 - alreadyBookmarked.size)).map(r => ({
    user_id: sarah,
    recommendation_id: r.id,
  }))

  if (bmToAdd.length > 0) {
    const { error: bmErr } = await supabase.from('bookmarks').insert(bmToAdd)
    if (bmErr) console.error('  Bookmarks insert failed:', bmErr.message)
    else console.log(`  ✓ Inserted ${bmToAdd.length} bookmarks for @sarahk`)
  } else {
    console.log('  @sarahk already has 8+ bookmarks — skipping')
  }

  // ── Follows ───────────────────────────────────────────────────────────────────

  console.log('\nSeeding follows...')

  // Check existing follows
  const { data: existingFollows } = await supabase.from('follows').select('follower_id, following_id')
  const followSet = new Set((existingFollows ?? []).map(f => `${f.follower_id}:${f.following_id}`))

  const followPairs = [
    // @sarahk follows 4 others
    { follower_id: sarah, following_id: marcus },
    { follower_id: sarah, following_id: priya },
    { follower_id: sarah, following_id: elena },
    { follower_id: sarah, following_id: tyler },
    // 3+ users follow @sarahk
    { follower_id: marcus, following_id: sarah },
    { follower_id: priya,  following_id: sarah },
    { follower_id: jordan, following_id: sarah },
    { follower_id: elena,  following_id: sarah },
    // Cross-follows so everyone has 1-2
    { follower_id: marcus, following_id: tyler },
    { follower_id: priya,  following_id: jordan },
    { follower_id: jordan, following_id: elena },
    { follower_id: elena,  following_id: marcus },
    { follower_id: tyler,  following_id: priya },
    { follower_id: tyler,  following_id: jordan },
  ]

  const newFollows = followPairs.filter(f => !followSet.has(`${f.follower_id}:${f.following_id}`))

  if (newFollows.length > 0) {
    const { error: followErr } = await supabase.from('follows').insert(newFollows)
    if (followErr) console.error('  Follows insert failed:', followErr.message)
    else console.log(`  ✓ Inserted ${newFollows.length} follow relationships`)
  } else {
    console.log('  All follows already exist — skipping')
  }

  console.log('\n✅ Phase 9 seed complete!')
  console.log('\nReminder: create the "avatars" Supabase Storage bucket if you haven\'t already.')
  console.log('  Dashboard → Storage → New bucket → Name: avatars → Public: yes')
}

main().catch(err => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
