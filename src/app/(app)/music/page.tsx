import type { Metadata } from 'next'
import CategoryFeed from '@/app/components/CategoryFeed'

export const metadata: Metadata = {
  title: 'Music — Notable',
  description: 'Music recommendations from people with taste. Discover what to listen to next on Notable.',
  openGraph: {
    title: 'Music — Notable',
    description: 'Music recommendations from people with taste. Discover what to listen to next on Notable.',
    siteName: 'Notable',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Music — Notable',
    description: 'Music recommendations from people with taste. Discover what to listen to next on Notable.',
  },
}

export default function MusicPage() {
  return <CategoryFeed category="music" />
}
