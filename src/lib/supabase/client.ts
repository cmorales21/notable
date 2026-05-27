import { createBrowserClient } from '@supabase/ssr'
import { supabaseUrl, supabaseAnonKey } from '@/lib/env'

/**
 * Browser-side Supabase client.
 * Use this in 'use client' components — it reads/writes auth cookies
 * automatically so the session stays in sync with the server.
 */
export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
