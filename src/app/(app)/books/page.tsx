import type { Metadata } from 'next'
import CategoryFeed from '@/app/components/CategoryFeed'

export const metadata: Metadata = {
  title: 'Books — Notable',
  description: 'Book recommendations from people with taste. Discover your next great read on Notable.',
  openGraph: {
    title: 'Books — Notable',
    description: 'Book recommendations from people with taste. Discover your next great read on Notable.',
    siteName: 'Notable',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Books — Notable',
    description: 'Book recommendations from people with taste. Discover your next great read on Notable.',
  },
}

export default function BooksPage() {
  return <CategoryFeed category="books" />
}
