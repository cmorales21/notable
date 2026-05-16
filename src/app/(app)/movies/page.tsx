import type { Metadata } from 'next'
import CategoryFeed from '@/app/components/CategoryFeed'

export const metadata: Metadata = {
  title: 'Movies & TV — Notable',
  description: 'Film recommendations from people with taste. Discover what to watch next on Notable.',
  openGraph: {
    title: 'Movies & TV — Notable',
    description: 'Film recommendations from people with taste. Discover what to watch next on Notable.',
    siteName: 'Notable',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Movies & TV — Notable',
    description: 'Film recommendations from people with taste. Discover what to watch next on Notable.',
  },
}

export default function MoviesPage() {
  return <CategoryFeed category="movies" />
}
