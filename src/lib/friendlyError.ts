// Map known Supabase / Postgres error patterns to warm, human copy.
// Callers should never render raw provider strings; use this at the boundary.
//
// Deliberately no em dashes: the product copy style uses plain punctuation.

interface ErrorFields {
  message?: string | null
  code?: string | number | null
  status?: number | null
  details?: string | null
  name?: string | null
}

const GENERIC = 'Something went wrong on our side. Please try again.'

interface Rule {
  test: (message: string, code: string, status: number, details: string) => boolean
  copy: string
}

const RULES: Rule[] = [
  // Handle already taken (unique_violation on profiles.handle)
  {
    test: (m, c, _s, d) =>
      (c === '23505' && (d.includes('(handle)') || m.includes('handle'))) ||
      m.includes('handle is already taken') ||
      m.includes('handle_key'),
    copy: 'That handle is already taken. Please choose another.',
  },
  // Email already registered (Supabase auth signUp)
  {
    test: (m) =>
      m.includes('user already registered') ||
      m.includes('email already registered') ||
      m.includes('already exists') ||
      m.includes('already been registered') ||
      m.includes('email address is already in use'),
    copy: 'That email is already registered. Try signing in instead.',
  },
  // Invalid email format
  {
    test: (m) =>
      m.includes('invalid email') ||
      m.includes('invalid format') ||
      m.includes('unable to validate email address') ||
      m.includes('email address') && m.includes('invalid'),
    copy: "That email address doesn't look right. Please check and try again.",
  },
  // Invalid login credentials (wrong password / unknown email)
  {
    test: (m) =>
      m.includes('invalid login credentials') ||
      m.includes('invalid credentials') ||
      m.includes('invalid_grant'),
    copy: "That email and password don't match. Please try again.",
  },
  // Email not confirmed
  {
    test: (m) =>
      m.includes('email not confirmed') ||
      m.includes('confirm your email') ||
      m.includes('email link is invalid'),
    copy: 'Please confirm your email first. Check your inbox for the link we sent.',
  },
  // New password same as old
  {
    test: (m) =>
      m.includes('new password should be different') ||
      m.includes('same as the old') ||
      m.includes('should be different from the old'),
    copy: 'Your new password needs to be different from the old one.',
  },
  // Password too short / weak
  {
    test: (m) =>
      m.includes('password should be at least') ||
      m.includes('password is too short') ||
      m.includes('password must be at least') ||
      m.includes('weak password') ||
      m.includes('password too short'),
    copy: 'Password must be at least 8 characters.',
  },
  // Signup requires a valid password
  {
    test: (m) =>
      m.includes('signup requires a valid password') ||
      m.includes('password is required'),
    copy: 'Please enter a password.',
  },
  // Rate limited
  {
    test: (m, _c, s) =>
      s === 429 ||
      m.includes('rate limit') ||
      m.includes('too many requests') ||
      m.includes('over_email_send_rate_limit'),
    copy: "You're going a bit fast. Please wait a moment and try again.",
  },
  // File too large (avatar upload)
  {
    test: (m) =>
      m.includes('payload too large') ||
      m.includes('file size') ||
      m.includes('exceeds') && m.includes('limit') ||
      m.includes('the object exceeded the maximum allowed size'),
    copy: 'That file is too large. Please pick one smaller than 5 MB.',
  },
  // Unsupported file type
  {
    test: (m) =>
      m.includes('mime type') ||
      m.includes('invalid_mime_type') ||
      m.includes('unsupported file'),
    copy: 'That file type is not supported. Please use JPEG, PNG, WebP, or GIF.',
  },
  // Network / offline
  {
    test: (m) =>
      m.includes('failed to fetch') ||
      m.includes('networkerror') ||
      m.includes('network request failed'),
    copy: "Couldn't reach the server. Check your connection and try again.",
  },
]

export function friendlyError(error: unknown): string {
  if (!error) return GENERIC

  const e: ErrorFields = typeof error === 'string' ? { message: error } : (error as ErrorFields)
  const raw = e.message ?? ''
  const code = String(e.code ?? '')
  const status = Number(e.status ?? 0) || 0
  const details = String(e.details ?? '')

  const m = raw.toLowerCase()
  const d = details.toLowerCase()

  for (const rule of RULES) {
    if (rule.test(m, code, status, d)) return rule.copy
  }

  return GENERIC
}
