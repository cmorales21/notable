'use client'

export type Category = 'books' | 'movies' | 'music' | 'restaurants' | 'podcasts'

export const CATEGORY_CONFIG: Record<Category, { label: string; color: string; Icon: () => React.ReactElement }> = {
  books: {
    label: 'Books',
    color: '#5271FF',
    Icon: () => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
        <path d="M12 20V5" />
        <path d="M3 4a2 2 0 012-2h4a2 2 0 012 2v15a2 2 0 00-2-2H5a2 2 0 01-2-2V4z" />
        <path d="M21 4a2 2 0 00-2-2h-4a2 2 0 00-2 2v15a2 2 0 012-2h4a2 2 0 002-2V4z" />
      </svg>
    ),
  },
  movies: {
    label: 'Movies & TV',
    color: '#dc4f5c',
    Icon: () => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
        <rect x="2" y="8" width="14" height="10" rx="2" />
        <path d="M16 11l5-3v8l-5-3V11z" />
      </svg>
    ),
  },
  music: {
    label: 'Music',
    color: '#4aad4e',
    Icon: () => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
        <path d="M3 18v-6a9 9 0 0118 0v6" />
        <path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3z" />
        <path d="M3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z" />
      </svg>
    ),
  },
  restaurants: {
    label: 'Restaurants',
    color: '#9055d0',
    Icon: () => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
        <path d="M8 3v5a3 3 0 006 0V3" />
        <path d="M11 8v13" />
        <path d="M16 3a5 5 0 015 5c0 3-2 4.5-5 5v8" />
      </svg>
    ),
  },
  podcasts: {
    label: 'Podcasts',
    color: '#e5a517',
    Icon: () => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
        <rect x="9" y="2" width="6" height="12" rx="3" />
        <path d="M5 10v2a7 7 0 0014 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </svg>
    ),
  },
}
