import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: rec } = await supabase
    .from('recommendations')
    .select('user_id')
    .eq('id', id)
    .maybeSingle()

  if (!rec) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (rec.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await supabase.from('recommendations').delete().eq('id', id)

  if (error) {
    console.error('[Notable] delete recommendation error:', error.message)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
