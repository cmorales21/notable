import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import OnboardingClient from './OnboardingClient'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, handle, is_onboarded')
    .eq('id', user.id)
    .maybeSingle()

  // Already fully onboarded → lobby
  if (profile?.is_onboarded) redirect('/lobby')

  // Use || not ?? so empty strings are treated the same as null.
  // An empty-string handle can exist if the client-side INSERT raced and
  // wrote handle:'' before the auth cookie was ready.
  const profileHandle = profile?.handle || null
  const metaHandle    = (user.user_metadata?.handle    as string | undefined) || null
  const metaName      = (user.user_metadata?.full_name as string | undefined) || null

  let resolvedHandle = profileHandle
  const resolvedName = profile?.name || metaName || ''

  // Recovery: profile row has no handle but user_metadata has one.
  // Covers (a) missing profile row or (b) row with null/empty handle —
  // both happen when the client-side INSERT loses the race with the
  // auth-cookie write during signup.
  if (!resolvedHandle && metaHandle) {
    if (!profile) {
      const { error } = await supabase.from('profiles').insert({
        id:     user.id,
        name:   metaName ?? '',
        handle: metaHandle,
        email:  user.email ?? '',
      })
      if (!error) resolvedHandle = metaHandle
    } else {
      const { error } = await supabase
        .from('profiles')
        .update({ handle: metaHandle })
        .eq('id', user.id)
      if (!error) resolvedHandle = metaHandle
    }
  }

  // User has a handle — send to lobby where the welcome overlay will show
  if (resolvedHandle) redirect('/lobby')

  // No handle yet (Google OAuth users) — show handle-collection UI
  return (
    <OnboardingClient
      userId={user.id}
      userEmail={user.email ?? ''}
      initialName={resolvedName}
    />
  )
}
