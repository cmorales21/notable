import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { friendlyError } from '@/lib/friendlyError'

export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json({ error: 'Account deletion unavailable: service role key not configured' }, { status: 500 })
  }

  const { error } = await admin.auth.admin.deleteUser(user.id)
  if (error) return NextResponse.json({ error: friendlyError(error) }, { status: 500 })
  return NextResponse.json({ ok: true })
}
