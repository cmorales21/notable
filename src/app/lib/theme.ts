// Design system note: Pure white (#ffffff) is intentionally used for text
// on category-colored backgrounds (pills, buttons, toggles). The warm
// linen #f5f0e8 reads yellowish on saturated colors like #5271FF or #dc4f5c,
// so #ffffff is the correct choice in those contexts. This is an intentional
// exception to the "no pure white" rule.

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
    podcasts: '#e5a517',
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
