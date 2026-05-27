function requireEnv(name: string, val: string | undefined): string {
  if (!val) throw new Error(`Missing ${name} — check your .env.local file`)
  return val
}

export const supabaseUrl = requireEnv(
  'NEXT_PUBLIC_SUPABASE_URL',
  process.env.NEXT_PUBLIC_SUPABASE_URL
)

export const supabaseAnonKey = requireEnv(
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
