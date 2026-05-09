import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from '../components/AppShell'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, handle, avatar_url')
    .eq('id', user.id)
    .maybeSingle()

  return (
    <AppShell profile={profile} userId={user.id}>
      {children}
    </AppShell>
  )
}
