// Notable — Category Feed Seed Script
//
// Run with:
//   NEXT_PUBLIC_SUPABASE_URL=your_url SUPABASE_SERVICE_ROLE_KEY=your_key npx tsx scripts/seed-feed.ts
//
// Or copy your .env.local values into a one-liner:
//   npx tsx --env-file=.env.local scripts/seed-feed.ts
//
// Requires: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
// Uses the service role key to bypass RLS for seeding.
//
// The script is idempotent — it checks for the handle @sarahk and skips if
// already seeded.

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

// ─── Fake users ───────────────────────────────────────────────────────────────

const FAKE_USERS = [
  {
    email: 'sarah.kim.notable@example.com',
    handle: 'sarahk',
    name: 'Sarah Kim',
    bio: 'Books, film, and finding the best ramen in every city.',
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=SarahKim',
  },
  {
    email: 'marcus.chen.notable@example.com',
    handle: 'marcusc',
    name: 'Marcus Chen',
    bio: 'Music nerd and amateur home cook. Always have a podcast on.',
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=MarcusChen',
  },
  {
    email: 'priya.patel.notable@example.com',
    handle: 'priyap',
    name: 'Priya Patel',
    bio: 'Literary fiction devotee. Drinking too much coffee since 2009.',
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=PriyaPatel',
  },
  {
    email: 'jordan.williams.notable@example.com',
    handle: 'jordanw',
    name: 'Jordan Williams',
    bio: 'Documentary filmmaker and cookbook hoarder.',
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=JordanWilliams',
  },
  {
    email: 'elena.rodriguez.notable@example.com',
    handle: 'elenar',
    name: 'Elena Rodriguez',
    bio: 'Obsessed with arthouse cinema and rooftop restaurants.',
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ElenaRodriguez',
  },
  {
    email: 'tyler.brooks.notable@example.com',
    handle: 'tylerb',
    name: 'Tyler Brooks',
    bio: 'Science, history, and anything Cormac McCarthy has touched.',
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=TylerBrooks',
  },
]

// ─── Recommendations seed data ────────────────────────────────────────────────

function buildRecs(userIds: string[]) {
  const u = userIds
  return [
    // ── Books ──────────────────────────────────────────────────────────────
    {
      user_id: u[0], category: 'books', title: 'Pachinko',
      description: "Min Jin Lee spent decades researching this multigenerational saga of a Korean family in Japan, and every page shows it. The novel follows four generations navigating discrimination, sacrifice, and the peculiar loneliness of being foreigners in a country you've lived in your whole life. I stayed up until 2am for three nights straight because I couldn't bear to stop. One of the most quietly devastating books I've ever read.",
      image_url: 'https://picsum.photos/seed/book-pachinko/800/500', external_url: null,
    },
    {
      user_id: u[1], category: 'books', title: 'Project Hail Mary',
      description: "Andy Weir does it again, but somehow better than The Martian. A lone astronaut wakes up in deep space with no memory and has to science his way through an impossible situation. What makes it special is the relationship that develops — I can't say more without spoiling it, but I laughed out loud at least a dozen times. Perfect for people who think they don't like sci-fi.",
      image_url: 'https://picsum.photos/seed/book-hailmary/800/500', external_url: null,
    },
    {
      user_id: u[2], category: 'books', title: 'The Goldfinch',
      description: "Donna Tartt spent eleven years writing this novel and I understand why — the texture of every scene is so dense and lived-in it almost feels wrong to call it fiction. The story follows a boy who survives a bombing at a museum and becomes inadvertently entangled with a priceless stolen painting. It's about grief, beauty, and the strange persistence of art. Some people hate the ending; I loved it.",
      image_url: 'https://picsum.photos/seed/book-goldfinch/800/500', external_url: null,
    },
    {
      user_id: u[3], category: 'books', title: 'Klara and the Sun',
      description: "Ishiguro writes from the perspective of an artificial friend — a solar-powered android observing human behavior from a storefront window. It sounds cold but it's one of the warmest, most heartbreaking books I've read in years. He never explains the world to you; you piece it together the way Klara does, through careful observation. The last thirty pages wrecked me.",
      image_url: 'https://picsum.photos/seed/book-klara/800/500', external_url: null,
    },
    {
      user_id: u[4], category: 'books', title: 'Normal People',
      description: "Sally Rooney writes dialogue unlike anyone else working today — it feels stripped down but carries enormous weight in the silences. Connell and Marianne's relationship over several years is excruciating to watch in the best way, full of miscommunications and near-misses. I finished it in a single sitting on a rainy afternoon and then just sat there for a while. It's a short book that feels very large.",
      image_url: 'https://picsum.photos/seed/book-normalpeople/800/500', external_url: null,
    },
    {
      user_id: u[5], category: 'books', title: 'The Overstory',
      description: "Richard Powers makes you care deeply about trees, which sounds like a hard sell but I promise it works. Nine separate storylines gradually braid together around the lives of specific trees and the humans who become entangled with them. It changed how I look at every forest I walk through. The prose is stunning — occasionally the most beautiful writing I've encountered in contemporary fiction.",
      image_url: 'https://picsum.photos/seed/book-overstory/800/500', external_url: null,
    },
    {
      user_id: u[0], category: 'books', title: 'Circe',
      description: "Madeline Miller retells Greek mythology from the perspective of Circe, the witch from the Odyssey, and it's a completely reinvented take on what could have been a predictable retelling. Miller's prose is lush and assured and the character of Circe herself is genuinely compelling — someone figuring out her own power in a world designed to keep her small. The best Greek myth retelling I've read, including her own Song of Achilles.",
      image_url: 'https://picsum.photos/seed/book-circe/800/500', external_url: null,
    },
    {
      user_id: u[1], category: 'books', title: 'Educated',
      description: "Tara Westover grew up in a survivalist family in rural Idaho with no school and no birth certificate and taught herself into Cambridge. The memoir reads like a thriller but the stakes are entirely real and entirely personal. What I found most powerful is her refusal to make her family simply villainous — the ambivalence she holds is harder and more true. One of the few books that actually changed how I think.",
      image_url: 'https://picsum.photos/seed/book-educated/800/500', external_url: null,
    },

    // ── Movies ─────────────────────────────────────────────────────────────
    {
      user_id: u[2], category: 'movies', title: 'Past Lives',
      description: "Celine Song's debut is the kind of film where nothing dramatic happens and yet you leave the theater feeling turned inside out. Two childhood sweethearts separated by immigration reconnect over decades, and the whole film sits in the space between the lives we choose and the lives we leave behind. Greta Lee is extraordinary. I've thought about the final scene almost every day since I watched it.",
      image_url: 'https://picsum.photos/seed/movie-pastlives/800/500', external_url: null,
    },
    {
      user_id: u[3], category: 'movies', title: 'The Banshees of Inisherin',
      description: "Martin McDonagh made a film about the end of a friendship that somehow also functions as an allegory for the Irish Civil War and also just works as a dark comedy about two men being impossible. Colin Farrell has never been better. The whole thing is shot in this gray, windswept landscape that makes everything feel ancient and inevitable. Deeply funny and deeply sad, sometimes in the same scene.",
      image_url: 'https://picsum.photos/seed/movie-banshees/800/500', external_url: null,
    },
    {
      user_id: u[4], category: 'movies', title: 'Everything Everywhere All at Once',
      description: "I was fully prepared to find this exhausting and instead I cried three separate times. The Daniels made a genuine multiverse film that's really a story about a mother and daughter and the unbearable weight of disappointment. It moves at an insane pace but every chaotic detour earns its place. Michelle Yeoh gives the performance of her career, which is saying something. Watch it twice.",
      image_url: 'https://picsum.photos/seed/movie-eeaao/800/500', external_url: null,
    },
    {
      user_id: u[5], category: 'movies', title: 'Aftersun',
      description: "Charlotte Wells made one of the most quietly devastating debut films I've ever seen. It's ostensibly about a vacation — a daughter remembering a trip with her father — but what it's really about is the gaps in memory and all the things we don't understand about the people we love until it's too late. The final sequence is one of the most affecting things I've seen in cinema. Haunts me still.",
      image_url: 'https://picsum.photos/seed/movie-aftersun/800/500', external_url: null,
    },
    {
      user_id: u[0], category: 'movies', title: 'Decision to Leave',
      description: "Park Chan-wook made a film-noir romance that refuses to behave like either a film-noir or a romance. A detective investigates a suspicious death and becomes entangled with the prime suspect in ways that are genuinely hard to categorize. It's beautifully shot and formally inventive, with a kind of oblique emotional intensity that builds and builds. The ending is perfect in a way I couldn't see coming.",
      image_url: 'https://picsum.photos/seed/movie-decision/800/500', external_url: null,
    },
    {
      user_id: u[1], category: 'movies', title: 'The Holdovers',
      description: "Alexander Payne made the best film of his career by doing something unfashionable — a warm, funny, old-fashioned character study about a crusty prep school teacher forced to babysit a student over Christmas. Paul Giamatti is magnificent in a way that feels effortless. It looks and sounds like a 1970s film and that's absolutely intentional. The kind of movie you want to watch every December.",
      image_url: 'https://picsum.photos/seed/movie-holdovers/800/500', external_url: null,
    },
    {
      user_id: u[2], category: 'movies', title: 'Anatomy of a Fall',
      description: "Justine Triet's Palme d'Or winner is a courtroom thriller that's also a dissection of marriage and truth and the stories we tell ourselves about the people closest to us. Sandra Hüller is magnetic — you can never be sure what to think of her character, which is entirely the point. The film is over two and a half hours and I didn't look at my phone once. A genuinely great film.",
      image_url: 'https://picsum.photos/seed/movie-anatomy/800/500', external_url: null,
    },
    {
      user_id: u[3], category: 'movies', title: 'Poor Things',
      description: "Yorgos Lanthimos made a maximalist, grotesquely beautiful film about a woman's journey toward autonomy and selfhood, set in a Victoriana fever dream. Emma Stone gives a performance that should not work and is instead one of the most fully realized characters in recent film. It's bonkers and occasionally repulsive and completely its own thing. I went in skeptical and came out a convert.",
      image_url: 'https://picsum.photos/seed/movie-poorthings/800/500', external_url: null,
    },

    // ── Music ──────────────────────────────────────────────────────────────
    {
      user_id: u[4], category: 'music', title: 'SOS',
      description: "SZA's second album is one of those records you put on and forget to stop. She covers a remarkable amount of emotional ground — jealousy, grief, desire, self-doubt — with a vocal range and melodic instinct that feels almost unfair. The production moves fluidly between R&B, folk, rock, and pop without ever losing the thread. Snooze might be the best song she's ever made, and it's not even in my top five tracks here.",
      image_url: 'https://picsum.photos/seed/music-sos/800/500', external_url: null,
    },
    {
      user_id: u[5], category: 'music', title: 'Did You Know That There\'s a Tunnel Under Ocean Blvd',
      description: "Lana Del Rey's most literary and unguarded album. She stretches out across nine-minute songs about her family, her faith, her legacy, and the question of whether she'll be remembered the way she wants to be. The production with Jack Antonoff is gorgeous but never glossy — it has space and weight. The title track alone justifies the whole thing. Her best work by some distance.",
      image_url: 'https://picsum.photos/seed/music-tunnel/800/500', external_url: null,
    },
    {
      user_id: u[0], category: 'music', title: 'Javelin',
      description: "Sufjan Stevens made this album while dealing with Guillain-Barré syndrome and the grief of losing his partner, and you feel that weight in every note — but it's not a crushing listen, it's a tender one. The orchestration is staggering and the folk songwriting underneath it is some of his best since Illinois. He closes with a cover that will destroy you if you know what he was going through. A profound record.",
      image_url: 'https://picsum.photos/seed/music-javelin/800/500', external_url: null,
    },
    {
      user_id: u[1], category: 'music', title: 'The Record',
      description: "Three of the most talented singer-songwriters of their generation made an album together and somehow the whole is even better than the sum of very impressive parts. boygenius — Phoebe Bridgers, Julien Baker, Lucy Dacus — make the kind of harmonies that feel physiologically impossible to resist. Not Strong Enough and Leonard Cohen are among the best songs any of them have recorded individually. Play it loud.",
      image_url: 'https://picsum.photos/seed/music-therecord/800/500', external_url: null,
    },
    {
      user_id: u[2], category: 'music', title: 'Desire, I Want to Turn Into You',
      description: "Caroline Polachek made the most purely pleasurable album of 2023. Every track is a different flavor of art-pop ecstasy — there are flamenco guitar lines, choral arrangements, banging club beats, and through it all her extraordinary voice threading everything together. Welcome to My Island is how she opens the album and it's already a mission statement. This is what pop music sounds like when someone is genuinely ambitious with the form.",
      image_url: 'https://picsum.photos/seed/music-desire/800/500', external_url: null,
    },
    {
      user_id: u[3], category: 'music', title: 'And In the Darkness, Hearts Aglow',
      description: "Weyes Blood's second entry in her triptych about modern life is even more devastating than the first. Natalie Mering writes songs about technology, loneliness, and the collapse of shared meaning with the melodic grandeur of 1970s orchestral pop. Children of the Empire is one of the most beautiful songs I've heard in years. The kind of album that sounds like it's been around for decades already.",
      image_url: 'https://picsum.photos/seed/music-darkness/800/500', external_url: null,
    },
    {
      user_id: u[4], category: 'music', title: 'Dragon New Warm Mountain I Believe in You',
      description: "Big Thief made a double album recorded across four different sessions and it somehow coheres into one of the most generous-feeling records I own. Adrianne Lenker writes folk songs that feel both ancient and entirely present, and the band sounds like they're having the best time. There's a looseness and warmth to the whole thing that's rare in music this meticulously crafted. Certainty and Simulation are my two favorite moments.",
      image_url: 'https://picsum.photos/seed/music-dragon/800/500', external_url: null,
    },
    {
      user_id: u[5], category: 'music', title: 'The Age of Pleasure',
      description: "Janelle Monáe made the most purely fun album of the past several years — a celebration of Afrodiasporic music, queer joy, and uninhibited sensuality that dances between reggae, Afrobeats, R&B, and funk. After the conceptual weight of Dirty Computer this feels like exhaling. Lipstick Lover is an instant classic. Put it on at the start of a party and don't touch the queue.",
      image_url: 'https://picsum.photos/seed/music-agepleasure/800/500', external_url: null,
    },

    // ── Restaurants ────────────────────────────────────────────────────────
    {
      user_id: u[0], category: 'restaurants', title: 'Sushi Nakazawa',
      description: "Chef Nakazawa was Jiro's apprentice for nine years, and you understand that dedication in every piece. The omakase moves at a meditative pace — around twenty courses of pristine nigiri, each served one at a time with a brief explanation. It's expensive and worth every cent if you're going to do high-end sushi in New York. Book months in advance and go hungry.",
      image_url: 'https://picsum.photos/seed/rest-nakazawa/800/500', external_url: null,
    },
    {
      user_id: u[1], category: 'restaurants', title: 'Tartine Bakery',
      description: "Chad Robertson's sourdough country loaf is legitimately one of the best things you can eat in America — the crust shatters and the crumb is open and chewy and complex in a way that's honestly hard to describe. Get there close to when the bread comes out (late afternoon) or you'll find it sold out. The morning buns are also extraordinary. There will be a line. The line is worth it.",
      image_url: 'https://picsum.photos/seed/rest-tartine/800/500', external_url: null,
    },
    {
      user_id: u[2], category: 'restaurants', title: 'Joe\'s Pizza',
      description: "Some things don't need to be complicated to be perfect. Joe's has been making the same New York slice since 1975 and the reason the lines haven't gotten shorter is that nobody has figured out how to improve on it. The crust has the right amount of char, the sauce is bright and properly seasoned, the cheese pulls without becoming a disaster. Two slices and a Coke is still one of the great meals in New York.",
      image_url: 'https://picsum.photos/seed/rest-joespizza/800/500', external_url: null,
    },
    {
      user_id: u[3], category: 'restaurants', title: 'Bestia',
      description: "Ori Menashe built one of LA's most exciting Italian restaurants in a Arts District warehouse and somehow it hasn't slipped at all over the years. The pasta is made in-house daily and the charcuterie board alone justifies the reservation. The room is loud and buzzy in the best way — this is a place to celebrate things. The burrata with charred cherry tomatoes might be the dish I've ordered most consistently across all my restaurant meals.",
      image_url: 'https://picsum.photos/seed/rest-bestia/800/500', external_url: null,
    },
    {
      user_id: u[4], category: 'restaurants', title: 'Franklin Barbecue',
      description: "Aaron Franklin's brisket has changed how I think about what meat can taste like. You line up starting around 9am, the doors open at 11, and they sell out within a few hours — but the wait is part of the ritual. The bark on the brisket is like nothing else. Get the ribs too. Bring cash, bring folding chairs, bring people you want to spend a morning with. It's one of the great eating experiences in the country.",
      image_url: 'https://picsum.photos/seed/rest-franklin/800/500', external_url: null,
    },
    {
      user_id: u[5], category: 'restaurants', title: 'Superiority Burger',
      description: "Brooks Headley's tiny East Village spot made vegetarian food I'd choose over meat without thinking. The namesake burger has the texture and satisfaction of a smash patty but is entirely plant-based and somehow better for it. The rotating daily specials are inventive without being precious — this is real cooking. Cash only, cramped, often a wait. One of my favorite meals in New York period.",
      image_url: 'https://picsum.photos/seed/rest-superior/800/500', external_url: null,
    },
    {
      user_id: u[0], category: 'restaurants', title: 'Canlis',
      description: "Canlis has been open since 1950 and remains genuinely one of the best dining experiences in the country — not just in Seattle. The view over Lake Union is spectacular and the service is warm and unobtrusive in a way that takes enormous skill to pull off. The food is modern American done with tremendous confidence. Go for a birthday or an anniversary and dress up a little. It earns the occasion.",
      image_url: 'https://picsum.photos/seed/rest-canlis/800/500', external_url: null,
    },
    {
      user_id: u[1], category: 'restaurants', title: 'Pizzeria Bianco',
      description: "Chris Bianco's Phoenix pizzeria is genuinely in the conversation for best pizza in America, and once you've eaten there the conversation feels somewhat settled. The Wiseguy (wood-roasted onion, smoked mozzarella, fennel sausage) is remarkable. The ingredients are sourced with a level of care that's unusual even in the farm-to-table era. There will be a wait. There is always a wait. It doesn't matter.",
      image_url: 'https://picsum.photos/seed/rest-bianco/800/500', external_url: null,
    },

    // ── Podcasts ───────────────────────────────────────────────────────────
    {
      user_id: u[2], category: 'podcasts', title: 'Hardcore History',
      description: "Dan Carlin is not a historian by training and somehow produces the most deeply researched, most compelling history content I've ever encountered. His episodes run four to six hours each and I've listened to the World War I series (Blueprint for Armageddon) three times. He has a gift for making you feel the stakes of historical events as if they were happening now. Start with The Wrath of the Khans if you want a single entry point.",
      image_url: 'https://picsum.photos/seed/pod-hardcore/800/500', external_url: null,
    },
    {
      user_id: u[3], category: 'podcasts', title: 'Huberman Lab',
      description: "Andrew Huberman's long-form science episodes are genuinely educational in a way that rare for podcasts that aren't specifically academic. The episodes on sleep, stress, and neuroplasticity changed several of my daily habits. He cites the actual research and explains the mechanisms clearly without dumbing them down. Episodes run two to three hours but they're dense and worth it. The one on dopamine is a good place to start.",
      image_url: 'https://picsum.photos/seed/pod-huberman/800/500', external_url: null,
    },
    {
      user_id: u[4], category: 'podcasts', title: 'Lex Fridman Podcast',
      description: "Lex is genuinely curious in a way that isn't performed, and that makes his very long conversations with scientists, engineers, and public intellectuals feel substantive rather than promotional. The conversations with Yann LeCun, Donald Knuth, and Roger Penrose are among the best technical podcasts I've heard. He asks follow-up questions that show he actually did the reading. Good for long drives or long runs.",
      image_url: 'https://picsum.photos/seed/pod-lex/800/500', external_url: null,
    },
    {
      user_id: u[5], category: 'podcasts', title: '99% Invisible',
      description: "Roman Mars has been making the design and architecture podcast for fifteen years and it never gets old because the subject is genuinely inexhaustible. Every episode pulls back the curtain on something you pass by every day without thinking about — a font, a sound, a traffic pattern — and shows you the human decisions that made it that way. The episode on the Flag of Portland and the one on Color Money are good starting points.",
      image_url: 'https://picsum.photos/seed/pod-99pi/800/500', external_url: null,
    },
    {
      user_id: u[0], category: 'podcasts', title: 'Revisionist History',
      description: "Malcolm Gladwell's podcast is at its best when he takes a historical event or cultural artifact and turns it completely upside down. His argument about the Toyota Prius, his investigation of a failed football game, his episode about a cafeteria — he makes you genuinely reconsider things you thought were settled. Season 1 is still his best work. A good podcast for people who read his books and want more of that specific kind of thinking.",
      image_url: 'https://picsum.photos/seed/pod-revisionist/800/500', external_url: null,
    },
    {
      user_id: u[1], category: 'podcasts', title: 'The Daily',
      description: "Michael Barbaro and the NYT team have made the best short-form news podcast going. Twenty minutes, five days a week, and they actually explain the context behind what's happening rather than just headline-surfing. The production quality is high and the pacing is well-calibrated. It's become part of my morning routine in a way that's stuck for years — the episodes on long investigative pieces are especially good.",
      image_url: 'https://picsum.photos/seed/pod-thedaily/800/500', external_url: null,
    },
    {
      user_id: u[2], category: 'podcasts', title: "Conan O'Brien Needs a Friend",
      description: "Conan figured out the post-talk-show podcast format better than almost anyone who's tried it. His self-deprecating grief about his career and his genuine curiosity about his guests makes for interviews that are actually funny — not in the polished late-night sense but in the way a really funny friend is funny. The episode with Steven Yeun and the one with Jeff Goldblum are peak Conan. Put it on when you need to laugh.",
      image_url: 'https://picsum.photos/seed/pod-conan/800/500', external_url: null,
    },
    {
      user_id: u[3], category: 'podcasts', title: 'How I Built This',
      description: "Guy Raz interviews founders about building their companies and the format sounds dry but it consistently surfaces remarkable stories. The episode with Sara Blakely (Spanx), the one with the Airbnb founders, and the one with James Dyson are genuinely inspiring in a non-cheesy way because he asks about the near-death moments too, not just the wins. Good for anyone starting something or thinking about it.",
      image_url: 'https://picsum.photos/seed/pod-howibuild/800/500', external_url: null,
    },
  ]
}

// ─── Sample comments ──────────────────────────────────────────────────────────

function buildComments(userIds: string[], recIds: string[]) {
  const u = userIds
  const r = recIds
  return [
    { user_id: u[1], recommendation_id: r[0], text: 'Read this on a flight to Seoul and cried twice. The ending stayed with me for weeks.' },
    { user_id: u[2], recommendation_id: r[0], text: 'My book club picked this and it generated the best discussion we\'ve had in two years.' },
    { user_id: u[3], recommendation_id: r[1], text: 'The twist around the 60% mark — you know the one — made me put my phone down and just sit for a minute.' },
    { user_id: u[0], recommendation_id: r[2], text: 'Controversial hot take: the long middle section that people complain about is actually the best part.' },
    { user_id: u[4], recommendation_id: r[8], text: 'Saw this at a tiny arthouse theater and the person next to me was also crying in the last ten minutes. No one said anything. Perfect.' },
    { user_id: u[5], recommendation_id: r[9], text: 'Colin Farrell deserved every award. The scene at the pub early on sets up everything.' },
    { user_id: u[1], recommendation_id: r[10], text: 'I went in expecting to like it and ended up loving it. The googly eyes are a choice I still think about.' },
    { user_id: u[2], recommendation_id: r[16], text: 'The dog is the best character. That\'s all I can say without spoiling it.' },
    { user_id: u[0], recommendation_id: r[18], text: 'Snooze on repeat for an entire week. I have no regrets.' },
    { user_id: u[3], recommendation_id: r[19], text: 'The title track is nine minutes long and feels like three. That\'s how you know it\'s something special.' },
    { user_id: u[4], recommendation_id: r[24], text: 'Got the bread at exactly the right time — warm from the oven. I understood why people move to San Francisco now.' },
    { user_id: u[5], recommendation_id: r[28], text: 'Got there at 9:15 and the line was already around the corner. Back around 11:30. Best brisket I\'ve ever had. 0 regrets.' },
    { user_id: u[0], recommendation_id: r[32], text: 'The World War I series should be required listening. Six hours goes by in what feels like one.' },
    { user_id: u[1], recommendation_id: r[35], text: 'The episode that made me change my sleep schedule completely. I\'m a different person.' },
    { user_id: u[2], recommendation_id: r[38], text: 'The episode about the color of money is one of my favorite podcast episodes I\'ve ever heard.' },
  ]
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Notable seed script starting...')

  // Check if already seeded
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('handle', 'sarahk')
    .maybeSingle()

  if (existing) {
    console.log('Seed data already exists (found @sarahk). Skipping.')
    process.exit(0)
  }

  // ── Create auth users ────────────────────────────────────────────────────
  console.log('Creating fake auth users...')
  const createdUserIds: string[] = []

  for (const user of FAKE_USERS) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: 'notable-seed-password-2024',
      email_confirm: true,
    })
    if (error) {
      console.error(`Failed to create auth user ${user.email}:`, error.message)
      process.exit(1)
    }
    createdUserIds.push(data.user.id)
    console.log(`  Created auth user: ${user.email} → ${data.user.id}`)
  }

  // ── Upsert profiles ──────────────────────────────────────────────────────
  console.log('Upserting profiles...')
  const profileRows = FAKE_USERS.map((u, i) => ({
    id: createdUserIds[i],
    name: u.name,
    handle: u.handle,
    email: u.email,
    avatar_url: u.avatar_url,
    bio: u.bio,
    is_onboarded: true,
  }))

  const { error: profileError } = await supabase
    .from('profiles')
    .upsert(profileRows, { onConflict: 'id' })

  if (profileError) {
    console.error('Failed to upsert profiles:', profileError.message)
    process.exit(1)
  }
  console.log(`  Upserted ${profileRows.length} profiles`)

  // ── Insert recommendations ───────────────────────────────────────────────
  console.log('Inserting recommendations...')
  const recs = buildRecs(createdUserIds)

  const { data: insertedRecs, error: recError } = await supabase
    .from('recommendations')
    .insert(recs)
    .select('id')

  if (recError || !insertedRecs) {
    console.error('Failed to insert recommendations:', recError?.message)
    process.exit(1)
  }
  console.log(`  Inserted ${insertedRecs.length} recommendations`)

  const recIds = insertedRecs.map((r: { id: string }) => r.id)

  // ── Insert likes ─────────────────────────────────────────────────────────
  console.log('Inserting likes...')
  const likeTargets = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19]
  const likes = likeTargets.map((recIdx, i) => ({
    user_id: createdUserIds[i % createdUserIds.length],
    recommendation_id: recIds[recIdx],
  }))
  // Add some extra likes for variety
  const extraLikes = [
    { user_id: createdUserIds[2], recommendation_id: recIds[0] },
    { user_id: createdUserIds[3], recommendation_id: recIds[1] },
    { user_id: createdUserIds[4], recommendation_id: recIds[8] },
    { user_id: createdUserIds[5], recommendation_id: recIds[9] },
    { user_id: createdUserIds[0], recommendation_id: recIds[18] },
  ]
  const allLikes = [...likes, ...extraLikes]

  const { error: likeError } = await supabase.from('likes').insert(allLikes)
  if (likeError) {
    console.error('Failed to insert likes:', likeError.message)
    process.exit(1)
  }
  console.log(`  Inserted ${allLikes.length} likes`)

  // ── Insert bookmarks ─────────────────────────────────────────────────────
  console.log('Inserting bookmarks...')
  const bookmarkTargets = [0,3,8,10,16,18,24,28,32,35]
  const bookmarks = bookmarkTargets.map((recIdx, i) => ({
    user_id: createdUserIds[i % createdUserIds.length],
    recommendation_id: recIds[recIdx],
  }))

  const { error: bookmarkError } = await supabase.from('bookmarks').insert(bookmarks)
  if (bookmarkError) {
    console.error('Failed to insert bookmarks:', bookmarkError.message)
    process.exit(1)
  }
  console.log(`  Inserted ${bookmarks.length} bookmarks`)

  // ── Insert comments ──────────────────────────────────────────────────────
  console.log('Inserting comments...')
  const comments = buildComments(createdUserIds, recIds)

  const { error: commentError } = await supabase.from('comments').insert(comments)
  if (commentError) {
    console.error('Failed to insert comments:', commentError.message)
    process.exit(1)
  }
  console.log(`  Inserted ${comments.length} comments`)

  console.log('\nSeed complete!')
}

main().catch((err) => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
