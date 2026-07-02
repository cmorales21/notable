'use client'

// Last-resort boundary: catches errors thrown by the root layout itself.
// The root layout is not rendered here, so fonts and global CSS must be
// applied manually.

import { playfair, dmSans } from './fonts'
import ErrorPage from './error'
import './globals.css'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en" className={`${playfair.variable} ${dmSans.variable}`}>
      <body>
        <ErrorPage error={error} reset={reset} />
      </body>
    </html>
  )
}
