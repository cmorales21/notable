import { Playfair_Display, DM_Sans, Climate_Crisis } from 'next/font/google'

export const playfair = Playfair_Display({
  variable: '--font-playfair',
  subsets: ['latin'],
  display: 'swap',
})

export const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
  display: 'swap',
})

export const climateCrisis = Climate_Crisis({
  variable: '--font-climate-crisis',
  subsets: ['latin'],
  display: 'swap',
})
