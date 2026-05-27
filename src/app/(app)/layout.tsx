import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from '../components/AppShell'
import ClientProviders from '../components/ClientProviders'
import ErrorBoundary from '../components/ErrorBoundary'

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
    <ClientProviders>
      <AppShell profile={profile} userId={user.id}>
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </AppShell>
    </ClientProviders>
  )
}
