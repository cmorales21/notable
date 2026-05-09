'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Sign the current user out and send them to the landing page.
 *
 * Usage in any Server Component or client <form>:
 *
 *   import { logout } from '@/app/actions/auth'
 *   <form action={logout}><button type="submit">Log out</button></form>
 *
 * Or call it from a client component via a server action import.
 */
export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/')
}
