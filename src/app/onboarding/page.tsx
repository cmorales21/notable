import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Recovery gate between signup and the lobby.
 *
 * If the client-side profile insert in signup/page.tsx failed for any reason
 * (Supabase trigger conflict, RLS, network blip), this server component reads
 * user_metadata — where name and handle were stored during signUp() — and
 * upserts the profile before the user ever reaches the lobby.
 *
 * For landing-page signups (no handle in metadata) this is a no-op and the
 * WelcomeOverlay will collect the handle instead.
 */
export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('handle')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.handle) {
    const meta = user.user_metadata ?? {}
    const handle = (meta.handle as string | undefined) ?? ''
    const name   = (meta.full_name as string | undefined) ?? ''

    if (handle) {
      await supabase
        .from('profiles')
        .upsert(
          { id: user.id, name, handle, email: user.email ?? '' },
          { onConflict: 'id' }
        )
    }
  }

  redirect('/lobby')
}
