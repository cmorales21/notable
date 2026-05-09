export const theme = {
  colors: {
    bg: '#f5f0e8',
    surface: '#faf8f4',
    input: '#efe9e0',
    avatarFallback: '#e8e0d4',
    textPrimary: '#33261a',
    textMuted: '#6b5d4f',
    textTertiary: '#4a4438',
    error: '#e05555',
    border: 'rgba(0,0,0,0.08)',
  },
  categoryColors: {
    books: '#5271FF',
    movies: '#dc4f5c',
    music: '#4aad4e',
    restaurants: '#9055d0',
    podcasts: '#d4920a',
  },
  fonts: {
    display: 'var(--font-display, "Playfair Display", serif)',
    body: 'var(--font-body, "DM Sans", sans-serif)',
  },
  shadows: {
    modal: '0 -20px 60px rgba(58,42,26,0.15)',
    menu: '0 8px 24px rgba(58,42,26,0.15)',
    menuSmall: '0 6px 20px rgba(58,42,26,0.12)',
    card: '0 16px 48px rgba(58,42,26,0.18)',
  },
  radii: {
    card: '16px',
    modalSheet: '20px 20px 0 0',
    pill: '999px',
  },
} as const

export type CategoryId = keyof typeof theme.categoryColors

export function getCategoryColor(category: string): string {
  return theme.categoryColors[category as CategoryId] ?? theme.colors.textMuted
}
