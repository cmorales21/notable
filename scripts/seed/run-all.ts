// Notable — Run All Seed Scripts
//
// Runs all four bulk seed scripts in sequence.
//
// Run with:
//   npm run seed:all

import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { run as runMovies }   from './seed-movies.js'
import { run as runBooks }    from './seed-books.js'
import { run as runMusic }    from './seed-music.js'
import { run as runPodcasts } from './seed-podcasts.js'

dotenv.config({ path: '.env.local' })

const CATEGORIES: Array<{ name: string; fn: () => Promise<{ inserted: number; skipped: number }> }> = [
  { name: 'Movies', fn: runMovies },
  { name: 'Books',  fn: runBooks },
  { name: 'Music',  fn: runMusic },
  { name: 'Podcasts', fn: runPodcasts },
]

async function main() {
  let totalInserted = 0
  let totalSkipped  = 0

  for (const { name, fn } of CATEGORIES) {
    console.log(`\n${'─'.repeat(50)}`)
    console.log(`Seeding ${name}...`)
    console.log('─'.repeat(50))
    const { inserted, skipped } = await fn()
    totalInserted += inserted
    totalSkipped  += skipped
    console.log(`${name}: ${inserted} inserted, ${skipped} skipped.`)
  }

  console.log(`\n${'═'.repeat(50)}`)
  console.log(`TOTAL: ${totalInserted} new items inserted across all categories, ${totalSkipped} skipped.`)
}

const __filename = fileURLToPath(import.meta.url)
if (process.argv[1] === __filename) {
  main().catch(e => { console.error(e); process.exit(1) })
}
