// Notable — one-shot seed script.
//
// Runs the entire seed in a single pass: creates 12 persona users, upserts
// profiles, builds items + recommendations with runtime-validated images,
// then wires a follow graph and a spread of likes/bookmarks/comments and
// item_events so all the DB triggers (follow / follow_request /
// follow_request_accepted / like / bookmark / comment / mention) fire the
// same way they would in real usage.
//
// Run:   node scripts/seed/seed.mjs
// Teardown marker:
//   - Users:  email domain @seed.notable.test
//   - Items:  metadata.seed === true
//
// This script does NOT modify any application code and never touches users
// or content outside the seeded set.

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

// ── Config ───────────────────────────────────────────────────────────────────

const SEED_EMAIL_DOMAIN = 'seed.notable.test'
const SEED_PASSWORD     = 'notable-seed-2026'
const USER_CREATE_DELAY = 300   // ms between Admin API createUser calls
const IMAGE_TIMEOUT_MS  = 8000  // per-image validation timeout
const DAYS_BACK         = 45    // spread recommendations across this window

// ── Env loading (parse .env.local by hand, no dotenv dependency) ─────────────

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
    // Skip blanks and comments; ignore trailing "# comment" on the same line.
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    // Strip inline comments, respecting quoted strings only loosely.
    if (!val.startsWith('"') && !val.startsWith("'")) {
      const hash = val.indexOf(' #')
      if (hash >= 0) val = val.slice(0, hash).trim()
    }
    // Strip wrapping quotes.
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
const TMDB_KEY     = env.TMDB_API_KEY  // optional

if (!SUPABASE_URL) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL in .env.local — cannot connect to Supabase.')
  process.exit(1)
}
if (!SERVICE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY in .env.local — the seed script needs admin access to create users.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── Small helpers ────────────────────────────────────────────────────────────

function delay(ms) { return new Promise(res => setTimeout(res, ms)) }

// Mirrors src/lib/items.ts normalizeItemTitle exactly.
function normalizeItemTitle(title) {
  return title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Pick a random point in the past `DAYS_BACK` days as an ISO string.
function randomBackdate() {
  const now  = Date.now()
  const back = Math.floor(Math.random() * DAYS_BACK * 24 * 3600 * 1000)
  return new Date(now - back).toISOString()
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function shuffle(arr) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Validate a candidate image URL. Returns true only if status 200 AND
// content-type starts with "image/". Uses GET (HEAD isn't reliable across
// CDNs) with a small timeout.
async function validateImage(url) {
  if (!url) return false
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS)
    const res = await fetch(url, { method: 'GET', signal: controller.signal, redirect: 'follow' })
    clearTimeout(timeout)
    if (!res.ok) return false
    const ct = res.headers.get('content-type') || ''
    if (!ct.startsWith('image/')) return false
    // Drain body so the socket can close cleanly.
    await res.arrayBuffer()
    return true
  } catch {
    return false
  }
}

// ── Image sourcing ───────────────────────────────────────────────────────────

async function openLibraryCover(isbn) {
  return `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`
}

// iTunes Search API — keyless. entity is 'album' | 'movie' | 'podcast'.
async function itunesArtwork(term, entity) {
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=${entity}&limit=1`
    const res = await fetch(url)
    if (!res.ok) return null
    const json = await res.json()
    const hit = json?.results?.[0]
    if (!hit?.artworkUrl100) return null
    return hit.artworkUrl100.replace('100x100', '600x600')
  } catch {
    return null
  }
}

async function tmdbPoster(title, year) {
  if (!TMDB_KEY) return null
  try {
    const q   = encodeURIComponent(title)
    const yr  = year ? `&year=${year}` : ''
    // v4 read-token (JWT) — pass as Bearer.
    const res = await fetch(`https://api.themoviedb.org/3/search/movie?query=${q}${yr}`, {
      headers: { Authorization: `Bearer ${TMDB_KEY}` },
    })
    if (!res.ok) return null
    const json = await res.json()
    const hit  = json?.results?.[0]
    if (!hit?.poster_path) return null
    return `https://image.tmdb.org/t/p/w780${hit.poster_path}`
  } catch {
    return null
  }
}

// Wikimedia Commons Special:FilePath: given a file name, returns a direct
// image URL that resolves 302 to the file. Used for restaurant dish photos.
function wikimediaCommons(fileName) {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}?width=800`
}

// Generic fallback pool — used only if a per-item lookup fails after retries.
// Every URL here is validated once at startup; the survivors form the pool.
// The restaurant list is deliberately the same file names as the per-restaurant
// pool below (all pre-verified to resolve on Wikimedia Commons at time of
// writing), because fictional restaurants have no canonical image anyway.
const FALLBACK_CANDIDATES = {
  books:       ['https://covers.openlibrary.org/b/isbn/9780679731726-L.jpg'],
  movies:      [],
  music:       [],
  restaurants: [
    wikimediaCommons('Cheeseburger.jpg'),
    wikimediaCommons('Neapolitan_pizza.jpg'),
    wikimediaCommons('Pho_bo.jpg'),
    wikimediaCommons('Bibimbap.jpg'),
    wikimediaCommons('Sushi_platter.jpg'),
    wikimediaCommons('Nasi_lemak_1.jpg'),
    wikimediaCommons('Pad_See_Ew.jpg'),
    wikimediaCommons('Pozole_rojo.jpg'),
    wikimediaCommons('Tacos_al_pastor.jpg'),
    wikimediaCommons('Enchiladas.jpg'),
    wikimediaCommons('Paella_de_marisco.jpg'),
  ],
  podcasts:    [],
}
const FALLBACK = { books: [], movies: [], music: [], restaurants: [], podcasts: [] }

async function primeFallbacks() {
  for (const cat of Object.keys(FALLBACK_CANDIDATES)) {
    for (const url of FALLBACK_CANDIDATES[cat]) {
      // eslint-disable-next-line no-await-in-loop
      if (await validateImage(url)) FALLBACK[cat].push(url)
    }
  }
}

// Return a validated image for the given category, trying preferred sources
// first, then a category fallback. Never returns an invalidated URL.
async function resolveImage(entry) {
  const { category, isbn, itunesTerm, itunesEntity, title, year, wikimediaFile } = entry

  const attempts = []

  if (category === 'books' && isbn) {
    attempts.push(() => openLibraryCover(isbn))
  }
  if (category === 'movies') {
    attempts.push(() => tmdbPoster(title, year))
    attempts.push(() => itunesArtwork(itunesTerm ?? title, 'movie'))
  }
  if (category === 'music') {
    attempts.push(() => itunesArtwork(itunesTerm ?? title, 'album'))
  }
  if (category === 'podcasts') {
    attempts.push(() => itunesArtwork(itunesTerm ?? title, 'podcast'))
  }
  if (category === 'restaurants' && wikimediaFile) {
    attempts.push(() => wikimediaCommons(wikimediaFile))
  }

  for (const build of attempts) {
    // eslint-disable-next-line no-await-in-loop
    const url = await build()
    // eslint-disable-next-line no-await-in-loop
    if (url && await validateImage(url)) return url
  }

  // Fallback pool for the category.
  const pool = FALLBACK[category] ?? []
  if (pool.length > 0) return pickRandom(pool)
  return null
}

// External (outbound) link builders — plausible real destinations.
function externalUrl(entry) {
  const { category, title, isbn, author, itunesTerm, city, restaurantName } = entry
  const q = encodeURIComponent(`${title}${author ? ' ' + author : ''}`)
  switch (category) {
    case 'books':
      return isbn
        ? `https://bookshop.org/books?keywords=${encodeURIComponent(isbn)}`
        : `https://bookshop.org/books?keywords=${q}`
    case 'movies':
      // Letterboxd search URL — resolves to the film page.
      return `https://letterboxd.com/search/films/${encodeURIComponent(title.toLowerCase().replace(/\s+/g, '-'))}/`
    case 'music':
      return `https://open.spotify.com/search/${encodeURIComponent(itunesTerm ?? title)}`
    case 'podcasts':
      return `https://podcasts.apple.com/search?term=${encodeURIComponent(itunesTerm ?? title)}`
    case 'restaurants':
      return `https://www.google.com/maps/search/${encodeURIComponent(`${restaurantName ?? title} ${city ?? ''}`)}`
    default:
      return `https://www.google.com/search?q=${q}`
  }
}

// ── Personas ─────────────────────────────────────────────────────────────────

const PERSONAS = [
  { handle: 'margoreads',   name: 'Margo Okafor',     bio: 'Fiction that rearranges the furniture in your head.' },
  { handle: 'samthrillers', name: "Sam O'Rourke",     bio: 'If nobody dies in chapter one I\'m out.' },
  { handle: 'devwatches',   name: 'Dev Ramaswamy',    bio: 'Watching everything so you can watch the good ones.' },
  { handle: 'yukiframes',   name: 'Yuki Tanaka',      bio: 'Slow cinema, long takes, quiet rooms.' },
  { handle: 'lenalistens',  name: 'Lena Kowalski',    bio: 'Records to fill a room with.' },
  { handle: 'graceplays',   name: 'Grace Adeyemi',    bio: 'Your late-night frequency.' },
  { handle: 'tommyeats',    name: 'Tommy Nguyen',     bio: 'I will drive two hours for noodles.' },
  { handle: 'rosacooks',    name: 'Rosa Delgado',     bio: 'Judging kitchens by their care, not their hype.' },
  { handle: 'priyaonair',   name: 'Priya Shah',       bio: 'Podcasts, dissected with love.' },
  { handle: 'jonasb',       name: 'Jonas Bergström',  bio: 'Everything connects if you look long enough.' },
  { handle: 'alicequiet',   name: 'Alice Fontaine',   bio: 'Mostly here to remember.', private: true },
  { handle: 'marcuswebb',   name: 'Marcus Webb',      bio: 'Better at finding than sharing.' },
]

function avatarUrl(handle) {
  return `https://api.dicebear.com/9.x/notionists/png?seed=${encodeURIComponent(handle)}&size=200`
}

// ── Voice-flavored copy pools per persona ────────────────────────────────────
// Each pool is templated so a persona's tone stays consistent no matter which
// title we drop in. Placeholders: {title}, {author}.

const VOICE = {
  margoreads: [
    "{title} moves like tide across a room. I finished it late one night and sat with the light off for a while.",
    "There is a hush inside {title} that stayed with me for a week. Not sad, exactly. Attentive.",
    "{author} writes people who feel already remembered. I put {title} down thinking about my grandmother's hands.",
    "The last chapter of {title} does something I can't quite name. Something like forgiveness that hasn't found its target yet.",
    "You don't read {title} so much as let it thicken around you. Small book. Long shadow.",
    "By page fifty {title} had already changed the color of the ceiling.",
  ],
  samthrillers: [
    "{title}. Dead body by page nine. Do you need anything else from me.",
    "Read {title} in one sitting. Two suspects, three lies, one truly stupid detective who I nonetheless love.",
    "{author} does not waste a sentence in {title}. I checked. Twice.",
    "The final twist in {title} is the good kind — the kind you feel dumb for missing.",
    "Sat down with {title} on a Thursday. Was still up at 3 a.m. Regret nothing.",
    "{title} has a scene in it I will not describe here because you should meet it fresh.",
  ],
  devwatches: [
    "{title} keeps its camera exactly where you don't want to look. That's the whole trick, and it works.",
    "Rewatched {title} this week. It's older and stranger than I remembered. In a good way.",
    "The color palette of {title} is doing about 40% of the emotional work and nobody's giving it credit.",
    "Twenty minutes of {title} is worth ninety of anything currently on Netflix. Fight me later.",
    "{title} is the rare film that trusts you. It expects you to have been paying attention.",
    "One long take in {title} does more with a doorway than most films do with a plot.",
  ],
  yukiframes: [
    "{title}. Rain. A room. A woman not speaking.",
    "You wait through {title}. And then it arrives.",
    "Long takes. Cold windows. A small kindness at the end.",
    "{title} is quiet in the way a house is quiet when someone has just left.",
    "Watch {title} alone, at night, once.",
    "The camera in {title} refuses to look away. Neither should you.",
  ],
  lenalistens: [
    "{title} fills a room the way afternoon light fills one — slowly, and then all at once.",
    "Put {title} on the record player and everything got warmer. That's not a metaphor.",
    "The bass on {title} sits in your chest. The vocals sit in the room. It's a whole architecture.",
    "Every time I return to {title} I hear a new instrument. This week it was a single tambourine.",
    "{title} sounds like a wooden room. I can't explain it better than that.",
    "There's a track on {title} that I've played maybe two hundred times and it hasn't given up its secret.",
  ],
  graceplays: [
    "Put {title} on tonight and let it hold the room. That's the whole recommendation.",
    "{title} is the kind of thing you play at 11pm when the day finally stops.",
    "I've been ending my nights with {title} all week. It's doing something for me. Try it.",
    "Somewhere between comfort and dare, that's {title}. Perfect low-light listen.",
    "This one is for the dishwashers and the drivers and the not-yet-sleepers. {title}.",
    "{title} — hit play, dim the lamp, and see where you are in forty minutes.",
  ],
  tommyeats: [
    "{title}. Order the special. Trust me on this!",
    "Drove out to {title} on a Tuesday for the noodles. Regretted nothing. Came back Thursday.",
    "The dish to get at {title} is the one everyone tells you not to fill up on. Fill up on it.",
    "{title} has that thing where the first bite makes you laugh out loud. I did. The waiter laughed too.",
    "You have not eaten until you have eaten at {title} after 10pm on a weeknight.",
    "Rice was perfect. Broth was perfect. Bill was reasonable. What else do you want!",
  ],
  rosacooks: [
    "{title} sweats the small stuff — the bread, the butter, the water glass. That's the whole tell.",
    "The kitchen at {title} cares. You can taste it in the vinegar.",
    "No noise, no hype, just a small room doing careful work. That's {title}.",
    "I judge a kitchen by its beans. {title} passes.",
    "The menu at {title} is short because it needs to be. Everything on it is fussed over.",
    "A place like {title} reminds you what a stove is for.",
  ],
  priyaonair: [
    "{title} is a commute podcast — 35 minutes, tight edit, no fat. Save it for the train.",
    "The pacing on {title} is genuinely instructive. Listen to episode 2 for the interview structure alone.",
    "This one is best on a long walk. {title} builds slowly and then rewards you.",
    "{title} does the rare thing of respecting silence. Give it the good headphones.",
    "If you liked This American Life ten years ago, {title} will feel like coming home.",
    "The host on {title} asks the question you were about to. That's a hard trick.",
  ],
  jonasb: [
    "{title} pairs strangely well with the last thing I read about oceans. I can't explain it and I don't want to.",
    "This connects — {title} and a documentary about mycelium and a walk I took in October. Same shape.",
    "Kept thinking about {title} while cooking beans last week. Everything is beans, actually.",
    "{title} shares a spine with a film I loved in college whose name I've forgotten. Recommend both.",
    "Started {title} because a stranger mentioned it on a train. Finished it because it kept insisting.",
    "The world would make more sense if more people had encountered {title} first.",
  ],
  alicequiet: [
    "{title}. A window left open.",
    "I keep {title} where I can see it.",
    "Reading {title} again. Slower this time.",
    "{title} — the sound of a door not quite closing.",
    "For the winter shelf: {title}.",
  ],
  marcuswebb: [
    "Been sitting with {title} for a while. Finally posting.",
    "{title} is one of the ones I'd hand you if you asked.",
  ],
}

const COMMENT_VOICE = {
  margoreads: [
    "This one stayed with me for weeks. You've named the exact quality.",
    "Yes — that hush is the whole thing. Thank you for saying it.",
    "I keep returning to the last chapter. It's doing something quietly enormous.",
  ],
  samthrillers: [
    "Sold. Adding to the pile.",
    "You had me at chapter nine.",
    "Loved this one. The twist got me clean.",
  ],
  devwatches: [
    "Agreed on the color palette — nobody talks about it. Rewatching tonight.",
    "That doorway shot lives rent-free in my head.",
    "Underrated by every list I've seen. Glad you flagged it.",
  ],
  yukiframes: [
    "Yes.",
    "Watched last week. Still quiet.",
    "Same room. Different window.",
  ],
  lenalistens: [
    "Warm room record for sure. Been on rotation all month.",
    "The tambourine! I noticed it this week too.",
    "You're right about the architecture. It really does build a whole space.",
  ],
  graceplays: [
    "Perfect late-night pick. Adding to the show.",
    "This is going on the playlist tonight.",
    "Yes. Exactly the right frequency.",
  ],
  tommyeats: [
    "Going Friday! Any dish I shouldn't miss?",
    "Their noodles are unreal. Fully agree.",
    "Second everything here. That special is genuinely elite.",
  ],
  rosacooks: [
    "The care shows in the bread every time.",
    "Small room, real work. That's the whole game.",
    "I trust anywhere that treats vinegar like an ingredient.",
  ],
  priyaonair: [
    "Episode 2 is the one I send people first. Great pick.",
    "Their interview structure is genuinely a masterclass.",
    "Been catching up on the back catalog. All excellent.",
  ],
  jonasb: [
    "Pairs beautifully with something I'll link in the comments later.",
    "This one connects to about four other things I love. Nice find.",
    "The shape is exactly right. Nice write-up.",
  ],
  alicequiet: [
    "Yes.",
    "Kept.",
    "For the shelf.",
  ],
  marcuswebb: [
    "Adding this one.",
    "Bookmarked. Thanks for posting.",
    "Been meaning to get to this. Now I will.",
    "Good pick.",
    "Saving for the weekend.",
  ],
}

// ── Content catalog ──────────────────────────────────────────────────────────
// Each entry: { title, author, isbn?, itunesTerm?, year?, city?, restaurantName?,
//   wikimediaFile?, category }. The `authorField` is what we store as items.author_or_creator.

const BOOKS_MARGO = [
  { title: 'The Remains of the Day',   author: 'Kazuo Ishiguro',  isbn: '9780679731726', year: 1989 },
  { title: 'Stoner',                    author: 'John Williams',   isbn: '9781590171998', year: 1965 },
  { title: 'Beloved',                   author: 'Toni Morrison',   isbn: '9781400033416', year: 1987 },
  { title: 'Never Let Me Go',           author: 'Kazuo Ishiguro',  isbn: '9781400078776', year: 2005 },
  { title: 'A Little Life',             author: 'Hanya Yanagihara',isbn: '9780804172707', year: 2015 },
  { title: 'The Sense of an Ending',    author: 'Julian Barnes',   isbn: '9780307947727', year: 2011 },
  { title: 'Gilead',                    author: 'Marilynne Robinson', isbn: '9780312424404', year: 2004 },
]
const BOOKS_MARGO_OVERLAP = { title: 'Piranesi', author: 'Susanna Clarke', isbn: '9781635575637', year: 2020 }

const BOOKS_SAM = [
  { title: 'Gone Girl',                       author: 'Gillian Flynn',   isbn: '9780307588371', year: 2012 },
  { title: 'The Silent Patient',              author: 'Alex Michaelides',isbn: '9781250301697', year: 2019 },
  { title: 'In the Woods',                    author: 'Tana French',     isbn: '9780143113492', year: 2007 },
  { title: 'The Girl with the Dragon Tattoo', author: 'Stieg Larsson',   isbn: '9780307473479', year: 2005 },
  { title: 'Mystic River',                    author: 'Dennis Lehane',   isbn: '9780380731855', year: 2001 },
  { title: 'The Talented Mr. Ripley',         author: 'Patricia Highsmith', isbn: '9780393332148', year: 1955 },
  { title: 'Still Life',                      author: 'Louise Penny',    isbn: '9780312541538', year: 2005 },
]

const BOOKS_ALICE = [
  { title: 'The Bell Jar',            author: 'Sylvia Plath',   isbn: '9780060837020', year: 1963 },
  { title: 'A Room of One\'s Own',    author: 'Virginia Woolf', isbn: '9780156787338', year: 1929 },
  { title: 'The Waves',               author: 'Virginia Woolf', isbn: '9780156949606', year: 1931 },
  { title: 'The Argonauts',           author: 'Maggie Nelson',  isbn: '9781555977078', year: 2015 },
]

const BOOKS_JONAS = [
  { title: 'The Overstory',           author: 'Richard Powers', isbn: '9780393356687', year: 2018 },
]

const MOVIES_DEV = [
  { title: 'Parasite',                    year: 2019 },
  { title: 'There Will Be Blood',         year: 2007 },
  { title: 'No Country for Old Men',      year: 2007 },
  { title: 'Michael Clayton',             year: 2007 },
  { title: 'Zodiac',                      year: 2007 },
  { title: 'The Social Network',          year: 2010 },
  { title: 'Whiplash',                    year: 2014 },
]
const MOVIES_DEV_OVERLAP = { title: 'In the Mood for Love', year: 2000 }

const MOVIES_YUKI = [
  { title: 'Tokyo Story',      year: 1953 },
  { title: 'Paterson',         year: 2016 },
  { title: 'Perfect Days',     year: 2023 },
  { title: 'Drive My Car',     year: 2021 },
  { title: 'The Long Day Closes', year: 1992 },
  { title: 'Columbus',         year: 2017 },
  { title: 'Aftersun',         year: 2022 },
]

const MOVIES_ALICE = [
  { title: 'Certified Copy',  year: 2010 },
  { title: 'Wings of Desire', year: 1987 },
  { title: 'Ordet',           year: 1955 },
]

const MOVIES_JONAS = [
  { title: 'Stalker',            year: 1979 },
  { title: 'The Tree of Life',   year: 2011 },
]

const MUSIC_LENA = [
  { title: 'Blonde on Blonde',          author: 'Bob Dylan',           itunesTerm: 'Blonde on Blonde Bob Dylan',           year: 1966 },
  { title: 'Rumours',                   author: 'Fleetwood Mac',        itunesTerm: 'Rumours Fleetwood Mac',                 year: 1977 },
  { title: 'Pink Moon',                 author: 'Nick Drake',           itunesTerm: 'Pink Moon Nick Drake',                  year: 1972 },
  { title: 'For Emma, Forever Ago',     author: 'Bon Iver',             itunesTerm: 'For Emma Forever Ago Bon Iver',         year: 2007 },
  { title: 'A Love Supreme',            author: 'John Coltrane',        itunesTerm: 'A Love Supreme John Coltrane',          year: 1965 },
  { title: 'The Bends',                 author: 'Radiohead',            itunesTerm: 'The Bends Radiohead',                   year: 1995 },
  { title: 'Astral Weeks',              author: 'Van Morrison',         itunesTerm: 'Astral Weeks Van Morrison',             year: 1968 },
  { title: 'Music Has the Right to Children', author: 'Boards of Canada', itunesTerm: 'Music Has the Right to Children',    year: 1998 },
]
const MUSIC_LENA_OVERLAP = { title: 'Blue', author: 'Joni Mitchell', itunesTerm: 'Blue Joni Mitchell', year: 1971 }

const MUSIC_GRACE = [
  { title: 'Voodoo',                    author: "D'Angelo",             itunesTerm: 'Voodoo DAngelo',                        year: 2000 },
  { title: 'Baduizm',                   author: 'Erykah Badu',          itunesTerm: 'Baduizm Erykah Badu',                   year: 1997 },
  { title: 'Un Verano Sin Ti',          author: 'Bad Bunny',            itunesTerm: 'Un Verano Sin Ti Bad Bunny',            year: 2022 },
  { title: 'Currents',                  author: 'Tame Impala',          itunesTerm: 'Currents Tame Impala',                  year: 2015 },
  { title: 'Renaissance',               author: 'Beyoncé',              itunesTerm: 'Renaissance Beyonce',                   year: 2022 },
  { title: 'Blonde',                    author: 'Frank Ocean',          itunesTerm: 'Blonde Frank Ocean',                    year: 2016 },
  { title: 'To Pimp a Butterfly',       author: 'Kendrick Lamar',       itunesTerm: 'To Pimp a Butterfly',                   year: 2015 },
]

const MUSIC_JONAS = [
  { title: 'The Köln Concert',          author: 'Keith Jarrett',        itunesTerm: 'Koln Concert Keith Jarrett',            year: 1975 },
  { title: 'Kind of Blue',              author: 'Miles Davis',          itunesTerm: 'Kind of Blue Miles Davis',              year: 1959 },
  { title: 'Sound of Silver',           author: 'LCD Soundsystem',      itunesTerm: 'Sound of Silver LCD Soundsystem',       year: 2007 },
]

// Restaurants: fictional-but-plausible names in real cities. Wikimedia
// filenames listed here are all pre-verified to exist. If any 429s at
// runtime, the fallback pool (built from the same set) covers it.
const RESTAURANTS_TOMMY = [
  { title: 'Golden Hour Pho',        city: 'Portland, OR',     wikimediaFile: 'Pho_bo.jpg' },
  { title: 'Little Bells Noodle Bar',city: 'Austin, TX',       wikimediaFile: 'Pad_See_Ew.jpg' },
  { title: 'Kimchi & Ash',           city: 'Los Angeles, CA',  wikimediaFile: 'Bibimbap.jpg' },
  { title: 'Sundown Dumpling',       city: 'Chicago, IL',      wikimediaFile: 'Sushi_platter.jpg' },
  { title: 'Rice & Rebel',           city: 'Houston, TX',      wikimediaFile: 'Nasi_lemak_1.jpg' },
  { title: 'Ninh Kieu Kitchen',      city: 'San Jose, CA',     wikimediaFile: 'Pho_bo.jpg' },
  { title: 'Basil & Bone',           city: 'Miami, FL',        wikimediaFile: 'Pad_See_Ew.jpg' },
]
const RESTAURANTS_TOMMY_OVERLAP = { title: 'Superiority Burger', city: 'New York, NY', wikimediaFile: 'Cheeseburger.jpg' }

const RESTAURANTS_ROSA = [
  { title: 'Casa Mira',          city: 'Oakland, CA',      wikimediaFile: 'Tacos_al_pastor.jpg' },
  { title: 'La Pequeña Cocina',  city: 'Santa Fe, NM',     wikimediaFile: 'Enchiladas.jpg' },
  { title: 'Norte Verde',        city: 'Denver, CO',       wikimediaFile: 'Pozole_rojo.jpg' },
  { title: 'Almendra',           city: 'Brooklyn, NY',     wikimediaFile: 'Paella_de_marisco.jpg' },
  { title: 'Salt House Bakery',  city: 'Asheville, NC',    wikimediaFile: 'Neapolitan_pizza.jpg' },
  { title: 'Trattoria Piccola',  city: 'Providence, RI',   wikimediaFile: 'Neapolitan_pizza.jpg' },
  { title: "Nonna's Table",      city: 'Philadelphia, PA', wikimediaFile: 'Neapolitan_pizza.jpg' },
]

const RESTAURANTS_JONAS = [
  { title: 'The Small Hours',    city: 'Berlin, Germany',       wikimediaFile: 'Cheeseburger.jpg' },
  { title: 'Kaffir & Copper',    city: 'Melbourne, Australia',  wikimediaFile: 'Pad_See_Ew.jpg' },
]

const PODCASTS_PRIYA = [
  { title: 'This American Life',  author: 'WBEZ Chicago',           itunesTerm: 'This American Life' },
  { title: 'Radiolab',            author: 'WNYC Studios',           itunesTerm: 'Radiolab' },
  { title: '99% Invisible',       author: 'Roman Mars',             itunesTerm: '99 Percent Invisible' },
  { title: 'The Daily',           author: 'The New York Times',     itunesTerm: 'The Daily New York Times' },
  { title: 'Reply All',           author: 'Gimlet',                 itunesTerm: 'Reply All Gimlet' },
  { title: 'S-Town',              author: 'Serial Productions',     itunesTerm: 'S-Town' },
  { title: 'Song Exploder',       author: 'Hrishikesh Hirway',      itunesTerm: 'Song Exploder' },
]
const PODCASTS_PRIYA_OVERLAP = { title: 'Heavyweight', author: 'Jonathan Goldstein', itunesTerm: 'Heavyweight Jonathan Goldstein' }

const PODCASTS_GRACE = [
  { title: 'Broken Record',       author: 'Rick Rubin',             itunesTerm: 'Broken Record Rick Rubin' },
  { title: 'The Read',            author: 'Kid Fury and Crissle',   itunesTerm: 'The Read podcast' },
  { title: 'Still Processing',    author: 'The New York Times',     itunesTerm: 'Still Processing' },
  { title: 'Dissect',             author: 'Cole Cuchna',            itunesTerm: 'Dissect podcast' },
]

const PODCASTS_JONAS = [
  { title: 'Ezra Klein Show',     author: 'The New York Times',     itunesTerm: 'Ezra Klein Show' },
  { title: 'On Being',            author: 'Krista Tippett',         itunesTerm: 'On Being Krista Tippett' },
  { title: 'The Rest Is History', author: 'Goalhanger',             itunesTerm: 'The Rest Is History' },
  { title: 'Hardcore History',    author: 'Dan Carlin',             itunesTerm: 'Hardcore History Dan Carlin' },
]

// Overlap items — pointed at by 2–3 different personas.
const OVERLAPS = [
  {
    category: 'books',
    entry: BOOKS_MARGO_OVERLAP,
    handles: ['margoreads', 'jonasb', 'marcuswebb'],
  },
  {
    category: 'movies',
    entry: MOVIES_DEV_OVERLAP,
    handles: ['devwatches', 'yukiframes', 'jonasb'],
  },
  {
    category: 'music',
    entry: MUSIC_LENA_OVERLAP,
    handles: ['lenalistens', 'graceplays'],
  },
  {
    category: 'restaurants',
    entry: RESTAURANTS_TOMMY_OVERLAP,
    handles: ['tommyeats', 'rosacooks'],
  },
  {
    category: 'podcasts',
    entry: PODCASTS_PRIYA_OVERLAP,
    handles: ['priyaonair', 'graceplays', 'marcuswebb'],
  },
]

// Flatten into an assignment list of { handle, entry, category } — non-overlap
// posts each get their own item; overlap posts share an item id (resolved
// during insertion).
function buildAssignments() {
  const assignments = []
  const addAll = (list, handle, category) => {
    for (const entry of list) assignments.push({ handle, category, entry })
  }
  addAll(BOOKS_MARGO,  'margoreads',   'books')
  addAll(BOOKS_SAM,    'samthrillers', 'books')
  addAll(BOOKS_ALICE,  'alicequiet',   'books')
  addAll(BOOKS_JONAS,  'jonasb',       'books')
  addAll(MOVIES_DEV,   'devwatches',   'movies')
  addAll(MOVIES_YUKI,  'yukiframes',   'movies')
  addAll(MOVIES_ALICE, 'alicequiet',   'movies')
  addAll(MOVIES_JONAS, 'jonasb',       'movies')
  addAll(MUSIC_LENA,   'lenalistens',  'music')
  addAll(MUSIC_GRACE,  'graceplays',   'music')
  addAll(MUSIC_JONAS,  'jonasb',       'music')
  addAll(RESTAURANTS_TOMMY, 'tommyeats', 'restaurants')
  addAll(RESTAURANTS_ROSA,  'rosacooks', 'restaurants')
  addAll(RESTAURANTS_JONAS, 'jonasb',    'restaurants')
  addAll(PODCASTS_PRIYA, 'priyaonair',  'podcasts')
  addAll(PODCASTS_GRACE, 'graceplays',  'podcasts')
  addAll(PODCASTS_JONAS, 'jonasb',      'podcasts')
  return assignments
}

// ── Idempotency guard ────────────────────────────────────────────────────────

async function checkAlreadySeeded() {
  // paginate through users (Admin API caps page size, so fetch just one page).
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 })
  if (error) {
    console.error('Could not read auth users to check for existing seed. Aborting.', error.message)
    process.exit(1)
  }
  const found = data.users?.find(u => (u.email ?? '').endsWith(`@${SEED_EMAIL_DOMAIN}`))
  if (found) {
    console.error(
      `\nExisting @${SEED_EMAIL_DOMAIN} user found (${found.email}). ` +
      `Run the teardown script first before re-seeding.\n`
    )
    process.exit(1)
  }
}

// ── User + profile creation ──────────────────────────────────────────────────

async function createPersonaUsers() {
  console.log('\n── Creating persona users + profiles ────────────────────')
  const results = {}
  for (const p of PERSONAS) {
    const email = `${p.handle}@${SEED_EMAIL_DOMAIN}`

    // Create the auth user. email_confirm=true so they can log in immediately.
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password: SEED_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: p.name, handle: p.handle },
    })
    if (createErr || !created?.user) {
      console.error(`  Failed to create user @${p.handle}: ${createErr?.message ?? 'unknown'}`)
      process.exit(1)
    }
    const userId = created.user.id

    // If a profiles-row trigger ran, patch it; otherwise insert.
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle()

    const profilePatch = {
      name: p.name,
      handle: p.handle,
      bio: p.bio,
      avatar_url: avatarUrl(p.handle),
      profile_private: !!p.private,
      is_onboarded: true,
      email,
    }

    if (existingProfile) {
      const { error: updErr } = await supabase.from('profiles').update(profilePatch).eq('id', userId)
      if (updErr) {
        console.error(`  Profile update failed for @${p.handle}: ${updErr.message}`)
        process.exit(1)
      }
    } else {
      const { error: insErr } = await supabase.from('profiles').insert({ id: userId, ...profilePatch })
      if (insErr) {
        console.error(`  Profile insert failed for @${p.handle}: ${insErr.message}`)
        process.exit(1)
      }
    }

    results[p.handle] = { userId, email }
    console.log(`  ✓ @${p.handle} (${email})`)
    await delay(USER_CREATE_DELAY)
  }
  return results
}

// ── Items ────────────────────────────────────────────────────────────────────

// Build an items row (creating it if new) from a content entry. Returns the
// item's id, along with the resolved image URL so the recommendation row
// mirrors it.
async function upsertItem(entry, category) {
  const title = entry.title
  const author = entry.author ?? null
  const year   = entry.year ?? null

  const image = await resolveImage({
    category,
    title,
    isbn: entry.isbn,
    itunesTerm: entry.itunesTerm,
    itunesEntity: category === 'music' ? 'album' : category === 'podcasts' ? 'podcast' : 'movie',
    year,
    wikimediaFile: entry.wikimediaFile,
  })
  if (!image) {
    console.warn(`    ! Could not resolve validated image for "${title}" (${category}). Skipping.`)
    return { itemId: null, image: null }
  }

  const outUrl = externalUrl({
    category,
    title,
    isbn: entry.isbn,
    author,
    itunesTerm: entry.itunesTerm,
    city: entry.city,
    restaurantName: entry.title,
  })

  const partner =
    category === 'books' && entry.isbn ? 'open_library' :
    category === 'movies' ? 'tmdb' :
    (category === 'music' || category === 'podcasts') ? 'apple' :
    null

  // See if a normalized-title match already exists in this category, to avoid
  // creating duplicate rows on repeated runs of related scripts.
  const norm = normalizeItemTitle(title)
  const { data: existing } = await supabase
    .from('items')
    .select('id')
    .eq('category', category)
    .eq('normalized_title', norm)
    .maybeSingle()

  if (existing?.id) return { itemId: existing.id, image }

  const { data: inserted, error } = await supabase
    .from('items')
    .insert({
      title,
      normalized_title: norm,
      category,
      image_url: image,
      author_or_creator: author,
      year,
      outbound_url: outUrl,
      outbound_partner: partner,
      outbound_urls: partner ? { [partner]: outUrl } : {},
      metadata: { seed: true },
    })
    .select('id')
    .single()

  if (error || !inserted) {
    console.warn(`    ! items insert failed for "${title}": ${error?.message ?? 'unknown'}`)
    return { itemId: null, image }
  }
  return { itemId: inserted.id, image }
}

// ── Recommendations ──────────────────────────────────────────────────────────

function voiceDescription(handle, entry) {
  const pool = VOICE[handle]
  const tmpl = pickRandom(pool)
  return tmpl
    .replaceAll('{title}',  entry.title)
    .replaceAll('{author}', entry.author ?? 'the writer')
}

async function insertRecommendations(usersByHandle, assignments, overlapItems) {
  console.log('\n── Creating items + recommendations ─────────────────────')

  const created = []  // { recId, userId, handle, category, itemId }

  // 1. Non-overlap posts.
  for (const a of assignments) {
    const { itemId, image } = await upsertItem(a.entry, a.category)
    if (!itemId) continue

    const userId = usersByHandle[a.handle].userId
    const description = voiceDescription(a.handle, a.entry)
    const created_at = randomBackdate()

    const { data: rec, error } = await supabase
      .from('recommendations')
      .insert({
        user_id: userId,
        category: a.category,
        title: a.entry.title,
        description,
        image_url: image,
        external_url: externalUrl({
          category: a.category,
          title: a.entry.title,
          isbn: a.entry.isbn,
          author: a.entry.author,
          itunesTerm: a.entry.itunesTerm,
          city: a.entry.city,
          restaurantName: a.entry.title,
        }),
        item_id: itemId,
        created_at,
      })
      .select('id')
      .single()

    if (error || !rec) {
      console.warn(`    ! rec insert failed for @${a.handle}/"${a.entry.title}": ${error?.message ?? 'unknown'}`)
      continue
    }
    created.push({ recId: rec.id, userId, handle: a.handle, category: a.category, itemId, createdAt: created_at, title: a.entry.title })
    process.stdout.write('.')
  }

  // 2. Overlap posts — one item, multiple recs pointing at it.
  for (const o of OVERLAPS) {
    const { itemId, image } = await upsertItem(o.entry, o.category)
    if (!itemId) continue
    for (const handle of o.handles) {
      const userId = usersByHandle[handle].userId
      const description = voiceDescription(handle, o.entry)
      const created_at = randomBackdate()

      const { data: rec, error } = await supabase
        .from('recommendations')
        .insert({
          user_id: userId,
          category: o.category,
          title: o.entry.title,
          description,
          image_url: image,
          external_url: externalUrl({
            category: o.category,
            title: o.entry.title,
            isbn: o.entry.isbn,
            author: o.entry.author,
            itunesTerm: o.entry.itunesTerm,
            city: o.entry.city,
            restaurantName: o.entry.title,
          }),
          item_id: itemId,
          created_at,
        })
        .select('id')
        .single()

      if (error || !rec) {
        console.warn(`    ! overlap rec insert failed for @${handle}/"${o.entry.title}": ${error?.message ?? 'unknown'}`)
        continue
      }
      overlapItems.push({ itemId, category: o.category, title: o.entry.title })
      created.push({ recId: rec.id, userId, handle, category: o.category, itemId, createdAt: created_at, title: o.entry.title })
      process.stdout.write('.')
    }
  }
  process.stdout.write('\n')
  return created
}

// ── Follow graph ─────────────────────────────────────────────────────────────

async function buildFollows(usersByHandle) {
  console.log('\n── Building follow graph ────────────────────────────────')

  // ~30 accepted edges among the non-Alice personas, chosen to feel like a
  // web (asymmetric — not everyone follows everyone).
  const publicHandles = PERSONAS.filter(p => !p.private).map(p => p.handle)
  const edges = new Set()

  // Seed some intentional edges (curators follow adjacent-taste curators).
  const intentional = [
    ['margoreads','samthrillers'], ['margoreads','alicequiet'], ['margoreads','jonasb'],
    ['samthrillers','margoreads'], ['samthrillers','devwatches'],
    ['devwatches','yukiframes'], ['devwatches','jonasb'], ['devwatches','margoreads'],
    ['yukiframes','devwatches'], ['yukiframes','alicequiet'], ['yukiframes','jonasb'],
    ['lenalistens','graceplays'], ['lenalistens','jonasb'],
    ['graceplays','lenalistens'], ['graceplays','priyaonair'],
    ['tommyeats','rosacooks'], ['tommyeats','jonasb'],
    ['rosacooks','tommyeats'],
    ['priyaonair','graceplays'], ['priyaonair','jonasb'],
    ['jonasb','margoreads'], ['jonasb','devwatches'], ['jonasb','lenalistens'],
    ['jonasb','priyaonair'], ['jonasb','rosacooks'],
    ['marcuswebb','margoreads'], ['marcuswebb','samthrillers'], ['marcuswebb','devwatches'],
    ['marcuswebb','graceplays'], ['marcuswebb','priyaonair'], ['marcuswebb','jonasb'],
    ['marcuswebb','tommyeats'], ['marcuswebb','yukiframes'],
  ]
  for (const [a, b] of intentional) edges.add(`${a}::${b}`)

  let acceptedCount = 0
  for (const key of edges) {
    const [follower, following] = key.split('::')
    if (!publicHandles.includes(follower) || !publicHandles.includes(following)) continue
    if (follower === following) continue
    const { error } = await supabase.from('follows').insert({
      follower_id: usersByHandle[follower].userId,
      following_id: usersByHandle[following].userId,
      status: 'accepted',
    })
    if (error) {
      console.warn(`    ! follow ${follower}→${following}: ${error.message}`)
      continue
    }
    acceptedCount++
  }

  // Alice edges — 2 pending (stay pending), 1 pending→accepted (fires both triggers).
  const aliceId = usersByHandle['alicequiet'].userId

  // Two persistent pending requests toward Alice.
  for (const requester of ['jonasb', 'lenalistens']) {
    const { error } = await supabase.from('follows').insert({
      follower_id: usersByHandle[requester].userId,
      following_id: aliceId,
      status: 'pending',
    })
    if (error) console.warn(`    ! pending follow ${requester}→alicequiet: ${error.message}`)
  }

  // Insert as pending then UPDATE to accepted so both notification triggers fire.
  const { error: pendErr } = await supabase.from('follows').insert({
    follower_id: usersByHandle['margoreads'].userId,
    following_id: aliceId,
    status: 'pending',
  })
  if (pendErr) {
    console.warn(`    ! pending follow margoreads→alicequiet: ${pendErr.message}`)
  } else {
    // Small delay so the follow_request trigger runs before the update.
    await delay(200)
    const { error: accErr } = await supabase
      .from('follows')
      .update({ status: 'accepted' })
      .eq('follower_id', usersByHandle['margoreads'].userId)
      .eq('following_id', aliceId)
    if (accErr) console.warn(`    ! accept follow margoreads→alicequiet: ${accErr.message}`)
    else acceptedCount++
  }

  console.log(`  ${acceptedCount} accepted follow edges; 3 pending (2 persistent + 1 that became accepted).`)
  return acceptedCount
}

// ── Engagement (likes / bookmarks / comments / item_events) ──────────────────

async function buildEngagement(usersByHandle, recs) {
  console.log('\n── Building engagement ──────────────────────────────────')

  const publicHandles = PERSONAS.filter(p => !p.private).map(p => p.handle)
  const publicUserIds = publicHandles.map(h => usersByHandle[h].userId)
  const allUserIds    = PERSONAS.map(p => usersByHandle[p.handle].userId)

  // Distribute engagement:
  //  - 4 breakout recs get 12–18 likes each (drawn from other personas).
  //  - middle band: ~30 recs get 3–8 likes each.
  //  - at least 15 recs get zero likes.
  //  - ~80 bookmarks across the middle+top band.
  //  - ~40 comments in persona voice, 4–5 threaded, some with @mentions.
  //  - ~150 item_events.

  const shuffled = shuffle(recs)
  const breakouts = shuffled.slice(0, 4)
  const middle    = shuffled.slice(4, 34)
  const noEngage  = shuffled.slice(34, 34 + 15)  // 15 with zero engagement
  // The remainder (shuffled.slice(49)) gets a light random smattering.

  let likeCount = 0
  let bookmarkCount = 0
  let commentCount  = 0
  let eventCount    = 0

  async function likeRec(rec, engagerUserId) {
    // Skip self-likes.
    if (engagerUserId === rec.userId) return
    // Skip likes of Alice's posts by non-followers (private profile).
    // Simpler: just skip Alice's posts entirely from likes to be safe.
    if (rec.handle === 'alicequiet') return
    const { error } = await supabase.from('likes').insert({
      user_id: engagerUserId, recommendation_id: rec.recId,
    })
    if (!error) likeCount++
  }

  async function bookmarkRec(rec, engagerUserId) {
    if (engagerUserId === rec.userId) return
    if (rec.handle === 'alicequiet') return
    const { error } = await supabase.from('bookmarks').insert({
      user_id: engagerUserId, recommendation_id: rec.recId,
    })
    if (!error) bookmarkCount++
  }

  async function commentOn(rec, engagerHandle, text) {
    const engagerId = usersByHandle[engagerHandle].userId
    if (rec.handle === 'alicequiet') return
    const { error } = await supabase.from('comments').insert({
      user_id: engagerId,
      recommendation_id: rec.recId,
      text,
    })
    if (!error) commentCount++
  }

  // Breakouts: 12–18 likes each, 6–10 bookmarks, 3–5 comments each.
  for (const rec of breakouts) {
    const targetLikes = 12 + Math.floor(Math.random() * 7)
    const engagers = shuffle(publicUserIds).filter(u => u !== rec.userId).slice(0, targetLikes)
    for (const u of engagers) await likeRec(rec, u)

    const targetBk = 6 + Math.floor(Math.random() * 5)
    const bkEngagers = shuffle(publicUserIds).filter(u => u !== rec.userId).slice(0, targetBk)
    for (const u of bkEngagers) await bookmarkRec(rec, u)

    // 3–5 comments per breakout, some in threads.
    const commenters = shuffle(publicHandles.filter(h => h !== rec.handle)).slice(0, 3 + Math.floor(Math.random() * 3))
    let prev = null
    for (const h of commenters) {
      const base = pickRandom(COMMENT_VOICE[h])
      const text = prev ? `@${prev} ${base}` : base
      await commentOn(rec, h, text)
      prev = h
    }
  }

  // Middle band: 3–8 likes each, ~2 bookmarks each, occasional comment.
  for (const rec of middle) {
    const targetLikes = 3 + Math.floor(Math.random() * 6)
    const engagers = shuffle(publicUserIds).filter(u => u !== rec.userId).slice(0, targetLikes)
    for (const u of engagers) await likeRec(rec, u)

    const targetBk = 1 + Math.floor(Math.random() * 3)
    const bkEngagers = shuffle(publicUserIds).filter(u => u !== rec.userId).slice(0, targetBk)
    for (const u of bkEngagers) await bookmarkRec(rec, u)

    if (Math.random() < 0.35) {
      const h = pickRandom(publicHandles.filter(x => x !== rec.handle))
      await commentOn(rec, h, pickRandom(COMMENT_VOICE[h]))
    }
  }

  // The zero-engagement set gets literally nothing. Guaranteed 15+.
  void noEngage

  // Marcus comments widely — pile on a bunch of extra comments from Marcus.
  const marcusTargets = shuffle(recs.filter(r => r.handle !== 'marcuswebb' && r.handle !== 'alicequiet')).slice(0, 12)
  for (const rec of marcusTargets) {
    await commentOn(rec, 'marcuswebb', pickRandom(COMMENT_VOICE['marcuswebb']))
  }

  // Ensure at least 3 comments with @mentions of another seed persona.
  const mentionSources = shuffle(recs.filter(r => r.handle !== 'alicequiet')).slice(0, 4)
  const mentionAuthors = ['margoreads', 'jonasb', 'graceplays', 'priyaonair']
  for (let i = 0; i < mentionSources.length; i++) {
    const rec = mentionSources[i]
    const author = mentionAuthors[i % mentionAuthors.length]
    if (rec.handle === author) continue
    const target = pickRandom(publicHandles.filter(h => h !== author && h !== rec.handle))
    const text = `@${target} you'd love this — reminds me of your last pick.`
    await commentOn(rec, author, text)
  }

  // Sprinkle ~150 item_events. Mix types roughly 60% impression / 25% expand / 15% click.
  const TYPES = [
    ...Array(60).fill('impression'),
    ...Array(25).fill('expand'),
    ...Array(15).fill('click'),
  ]
  const seedItemIds = Array.from(new Set(recs.map(r => r.itemId).filter(Boolean)))
  for (let i = 0; i < 150; i++) {
    const itemId  = pickRandom(seedItemIds)
    const userId  = pickRandom(allUserIds)
    const type    = pickRandom(TYPES)
    const recForItem = recs.find(r => r.itemId === itemId)
    const category = recForItem?.category ?? null
    const { error } = await supabase.from('item_events').insert({
      item_id: itemId,
      user_id: userId,
      type,
      partner: null,
      category,
      source: 'seed',
    })
    if (!error) eventCount++
  }

  return { likeCount, bookmarkCount, commentCount, eventCount, breakouts: breakouts.length, zeroEngagement: noEngage.length }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Notable — seed.mjs')
  console.log('─────────────────────────────────────────────────────────')

  console.log('Priming image fallback pool…')
  await primeFallbacks()
  console.log(`  ${Object.values(FALLBACK).reduce((n, arr) => n + arr.length, 0)} fallback images validated.`)

  console.log('\nChecking for prior seed run…')
  await checkAlreadySeeded()
  console.log('  No prior seed found. Proceeding.')

  const usersByHandle = await createPersonaUsers()

  const assignments = buildAssignments()
  const overlapItems = []
  const recs = await insertRecommendations(usersByHandle, assignments, overlapItems)
  console.log(`  ${recs.length} recommendations inserted.`)

  const acceptedFollows = await buildFollows(usersByHandle)

  const eng = await buildEngagement(usersByHandle, recs)

  // Final summary.
  console.log('\n─────────────────────────────────────────────────────────')
  console.log('DONE — seed summary')
  console.log('─────────────────────────────────────────────────────────')
  console.log(`Users:            ${PERSONAS.length}`)
  console.log(`Recommendations:  ${recs.length}`)
  console.log(`  breakout posts: ${eng.breakouts} (12–18 likes each)`)
  console.log(`  zero-engagement posts: ${eng.zeroEngagement}`)
  console.log(`Follow edges:     ${acceptedFollows} accepted + 3 pending (2 stay pending, 1 became accepted)`)
  console.log(`Likes:            ${eng.likeCount}`)
  console.log(`Bookmarks:        ${eng.bookmarkCount}`)
  console.log(`Comments:         ${eng.commentCount}`)
  console.log(`item_events:      ${eng.eventCount}`)
  console.log('')
  console.log(`Shared login password: ${SEED_PASSWORD}`)
  console.log('Try logging in with any of these:')
  console.log(`  margoreads@${SEED_EMAIL_DOMAIN}`)
  console.log(`  devwatches@${SEED_EMAIL_DOMAIN}`)
  console.log(`  tommyeats@${SEED_EMAIL_DOMAIN}`)
  console.log('')
}

main().catch(err => {
  console.error('\nSeed failed with an unexpected error:')
  console.error(err)
  process.exit(1)
})
