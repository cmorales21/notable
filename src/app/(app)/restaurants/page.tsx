import type { Metadata } from 'next'
import CategoryFeed from '@/app/components/CategoryFeed'

export const metadata: Metadata = {
  title: 'Restaurants — Notable',
  description: 'Restaurant recommendations from people with taste. Discover where to eat next on Notable.',
  openGraph: {
    title: 'Restaurants — Notable',
    description: 'Restaurant recommendations from people with taste. Discover where to eat next on Notable.',
    siteName: 'Notable',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Restaurants — Notable',
    description: 'Restaurant recommendations from people with taste. Discover where to eat next on Notable.',
  },
}

export default function RestaurantsPage() {
  return <CategoryFeed category="restaurants" />
}
