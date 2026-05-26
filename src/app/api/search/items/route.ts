import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const q = searchParams.get('q')?.trim()
  if (!q) return NextResponse.json({ items: [] })

  const category = searchParams.get('category') || undefined
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '8', 10), 20)

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('search_items', {
    p_query: q,
    p_category: category ?? null,
    p_limit: limit,
  })

  if (error) return NextResponse.json({ items: [] })

  return NextResponse.json({ items: data ?? [] }, {
    headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=120' },
  })
}
