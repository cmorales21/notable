import type { Metadata } from 'next'
import CategoryFeed from '@/app/components/CategoryFeed'

export const metadata: Metadata = {
  title: 'Podcasts — Notable',
  description: 'Podcast recommendations from people with taste. Discover what to listen to next on Notable.',
  openGraph: {
    title: 'Podcasts — Notable',
    description: 'Podcast recommendations from people with taste. Discover what to listen to next on Notable.',
    siteName: 'Notable',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Podcasts — Notable',
    description: 'Podcast recommendations from people with taste. Discover what to listen to next on Notable.',
  },
}

export default function PodcastsPage() {
  return <CategoryFeed category="podcasts" />
}
