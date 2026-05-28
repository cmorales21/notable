import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { fileURLToPath } from 'url'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const fixes = [
  {
    title: 'War and Peace',
    image_url: 'https://m.media-amazon.com/images/I/81W6BFaJJWL._SL1500_.jpg',
  },
  {
    title: 'Cien Años de Soledad',
    image_url: 'https://images3.penguinrandomhouse.com/cover/9780525562443',
  },
  {
    title: 'Pedro Páramo',
    image_url: 'https://imagessl6.casadellibro.com/a/l/s7/06/9788493442606.webp',
  },
]

async function run() {
  for (const fix of fixes) {
    const { data, error } = await supabase
      .from('items')
      .update({ image_url: fix.image_url })
      .eq('title', fix.title)
      .eq('category', 'books')
      .select('id, title')

    if (error) {
      console.error(`  Error updating "${fix.title}": ${error.message}`)
    } else if (!data || data.length === 0) {
      console.warn(`  Not found in DB: "${fix.title}"`)
    } else {
      console.log(`  Updated: "${fix.title}" (id: ${data[0].id})`)
    }
  }

  const { count } = await supabase
    .from('items')
    .select('*', { count: 'exact', head: true })

  console.log(`\nTotal items in database: ${count}`)
}

const __filename = fileURLToPath(import.meta.url)
if (process.argv[1] === __filename) {
  run().catch(e => { console.error(e); process.exit(1) })
}
