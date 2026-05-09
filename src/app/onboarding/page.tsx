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

  if (profile?.is_onboarded) redirect('/lobby')

  // Use || not ?? so that empty strings are treated the same as null.
  // An empty-string handle can exist if the client-side INSERT raced and
  // wrote handle:'' before the auth cookie was ready.
  const profileHandle = profile?.handle || null
  const metaHandle    = (user.user_metadata?.handle    as string | undefined) || null
  const metaName      = (user.user_metadata?.full_name as string | undefined) || null

  let resolvedHandle = profileHandle
  const resolvedName   = profile?.name || metaName || ''

  // Recovery: profile row has no handle (or doesn't exist yet) but we have
  // the handle in user_metadata (stored during signUp). This covers:
  //  a) No profile row — client INSERT lost a race with the auth-cookie write
  //  b) Profile row exists but handle is null/'' — same root cause
  // In both cases we fix the row here on the server where the session is
  // always available via request cookies, so RLS passes reliably.
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
      // Row exists but handle is missing — patch it
      const { error } = await supabase
        .from('profiles')
        .update({ handle: metaHandle })
        .eq('id', user.id)
      if (!error) resolvedHandle = metaHandle
    }
  }

  return (
    <OnboardingClient
      userId={user.id}
      userEmail={user.email ?? ''}
      initialName={resolvedName}
      hasHandle={!!resolvedHandle}
    />
  )
}
