import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'

export async function generateMetadata(
  { params }: { params: Promise<{ handle: string }> }
): Promise<Metadata> {
  const { handle } = await params
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('name, avatar_url')
    .eq('handle', handle)
    .maybeSingle()

  const name = profile?.name ?? `@${handle}`
  const title = `${name} — Notable`
  const description = `See what ${name} recommends on Notable`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      ...(profile?.avatar_url ? { images: [profile.avatar_url] } : {}),
      type: 'profile',
      siteName: 'Notable',
    },
    twitter: {
      card: 'summary',
      title,
      description,
      ...(profile?.avatar_url ? { images: [profile.avatar_url] } : {}),
    },
  }
}

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
