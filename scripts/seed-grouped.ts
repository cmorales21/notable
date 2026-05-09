// Notable — Phase 10.5 Grouped Seed Script
//
// Adds duplicate recommendations across multiple users to test the grouping UI.
// Idempotent — checks for existing entries before inserting.
//
// Run with:
//   npx tsx --env-file=.env.local scripts/seed-grouped.ts

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
  console.log('Phase 10.5 grouped seed starting...\n')

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

  const missing = handles.filter(h => !idFor[h])
  if (missing.length) {
    console.warn('Warning: missing profiles for handles:', missing.join(', '))
    console.warn('These users will be skipped. Run the main seed scripts first.')
  }

  console.log('Resolved user IDs:')
  for (const [h, id] of Object.entries(idFor)) console.log(`  @${h} → ${id}`)
  console.log()

  // ── Recommendations to seed ───────────────────────────────────────────────────

  const toSeed: Array<{
    handle: string
    category: string
    title: string
    description: string
    image_url: string | null
    external_url: string | null
  }> = [
    // Past Lives — movies — @sarahk
    {
      handle: 'sarahk',
      category: 'movies',
      title: 'Past Lives',
      description: "Celine Song's debut feature is one of the most quietly devastating films I've ever seen. Two childhood sweethearts separated by emigration, reuniting twenty years later in New York. The final scene is just two people talking on a sidewalk and it destroyed me. The kind of film that makes you think about every path not taken.",
      image_url: 'https://image.tmdb.org/t/p/w500/k3waqVXSnQYGBbFHuFuN0WFBF85.jpg',
      external_url: 'https://www.themoviedb.org/movie/895539',
    },
    // Past Lives — movies — @marcusc
    {
      handle: 'marcusc',
      category: 'movies',
      title: 'Past Lives',
      description: "Saw this on a plane and had to pretend I wasn't crying to the person next to me. The way it holds time — the 12-year-olds, the 24-year-olds on Skype, the 36-year-olds in that bar — it's doing something structurally brilliant without calling attention to itself. One of the best films about grief for a life you didn't live.",
      image_url: 'https://image.tmdb.org/t/p/w500/k3waqVXSnQYGBbFHuFuN0WFBF85.jpg',
      external_url: 'https://www.themoviedb.org/movie/895539',
    },
    // Everything Everywhere All at Once — movies — @priyap
    {
      handle: 'priyap',
      category: 'movies',
      title: 'Everything Everywhere All at Once',
      description: "The Daniels made the most maximalist, chaotic, loving film about mothers and daughters and the terror of possibility. It starts as absurdist chaos and becomes something genuinely profound about kindness as the only rational response to nihilism. The googly eyes. The rocks. The hot dog fingers. I can't explain it — just watch it.",
      image_url: 'https://image.tmdb.org/t/p/w500/w3LxiVYdWWRvEVdn5RYq6jIqkb1.jpg',
      external_url: 'https://www.themoviedb.org/movie/545611',
    },
    // Pachinko — books — @jordanw
    {
      handle: 'jordanw',
      category: 'books',
      title: 'Pachinko',
      description: "Min Jin Lee traces four generations of a Korean family from early 20th century Japan through the 1980s, and every single character feels fully inhabited. It's a novel about identity and colonialism and what it means to belong somewhere — but it reads like you're watching a great TV show. I finished it in four days and felt genuinely sad it was over.",
      image_url: 'https://covers.openlibrary.org/b/id/10716508-L.jpg',
      external_url: 'https://openlibrary.org/works/OL17345710W',
    },
    // Pachinko — books — @priyap
    {
      handle: 'priyap',
      category: 'books',
      title: 'Pachinko',
      description: "My grandmother emigrated from Korea and this book broke something open in me I didn't know was closed. Lee renders the specific texture of being Korean in Japan — the bureaucratic humiliation, the small dignities, the way identity gets transmitted and deformed across generations — with a precision that felt almost documentary. Required reading.",
      image_url: 'https://covers.openlibrary.org/b/id/10716508-L.jpg',
      external_url: 'https://openlibrary.org/works/OL17345710W',
    },
    // SOS — music — @marcusc
    {
      handle: 'marcusc',
      category: 'music',
      title: 'SOS',
      description: "SZA made an 80-minute album that holds together as a single sustained mood — that particular blend of longing and self-possession and humor. Kill Bill is the obvious single but the deep cuts (Shirt, Conceited, Open Arms with Travis Scott) are where the real album lives. The production has this lush, slightly disorienting quality that I've gone back to hundreds of times.",
      image_url: 'https://upload.wikimedia.org/wikipedia/en/4/40/SZA_-_SOS.png',
      external_url: 'https://open.spotify.com/album/4OhAytAFBJgbBFkTuqIwBT',
    },
  ]

  // ── Insert (idempotent) ────────────────────────────────────────────────────────

  let inserted = 0
  let skipped = 0

  for (const item of toSeed) {
    const userId = idFor[item.handle]
    if (!userId) {
      console.log(`  ⊘ Skipping (user not found): @${item.handle} – ${item.title}`)
      skipped++
      continue
    }

    const { data: existing } = await supabase
      .from('recommendations')
      .select('id')
      .eq('user_id', userId)
      .eq('category', item.category)
      .ilike('title', item.title)
      .maybeSingle()

    if (existing) {
      console.log(`  ✓ Already exists: @${item.handle} – ${item.title}`)
      skipped++
      continue
    }

    const { error } = await supabase.from('recommendations').insert({
      user_id: userId,
      category: item.category,
      title: item.title,
      description: item.description,
      image_url: item.image_url,
      external_url: item.external_url,
    })

    if (error) {
      console.error(`  ✗ Failed: @${item.handle} – ${item.title}:`, error.message)
    } else {
      console.log(`  ✓ Inserted: @${item.handle} – ${item.title}`)
      inserted++
    }
  }

  console.log(`\n✅ Phase 10.5 seed complete! Inserted: ${inserted}, Skipped: ${skipped}`)
}

main().catch(err => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
