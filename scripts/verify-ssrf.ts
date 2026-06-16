import { NextRequest } from 'next/server'
import { POST } from '../src/app/api/search/extract-url/route'

const urls = [
  'http://2130706433/',
  'http://[::1]/',
  'http://169.254.169.254/latest/meta-data/',
  'https://www.bbc.com/news',
]

async function main() {
  for (const url of urls) {
    console.log(`\n=== ${url} ===`)
    const req = new NextRequest('http://localhost:3000/api/search/extract-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
    const res = await POST(req)
    const body = await res.text()
    console.log(`status: ${res.status}`)
    console.log(`body:   ${body}`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
