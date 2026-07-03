'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { groupSearchResults, type SearchGroupedRec } from '@/lib/groupRecommendations'
import type { Recommendation, RecProfile } from '@/app/components/CategoryFeed'

export interface SearchPerson {
  id: string
  name: string | null
  handle: string | null
  avatar_url: string | null
  bio: string | null
  profile_private: boolean | null
}

export function useSearch({
  recLimit = 5,
  peopleLimit = 5,
  category = 'all',
  debounceMs = 300,
}: {
  recLimit?: number
  peopleLimit?: number
  category?: string
  debounceMs?: number
} = {}) {
  const supabaseRef = useRef(createClient())
  const [rawQuery, setRawQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [groupedRecs, setGroupedRecs] = useState<SearchGroupedRec[]>([])
  const [people, setPeople] = useState<SearchPerson[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const searchIdRef = useRef(0)
  const blockedIdsRef = useRef(new Set<string>())

  useEffect(() => {
    const supabase = supabaseRef.current
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('user_blocks')
        .select('blocked_id, blocker_id')
        .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`)
      const ids = new Set<string>()
      for (const r of (data ?? []) as { blocker_id: string; blocked_id: string }[]) {
        ids.add(r.blocker_id === user.id ? r.blocked_id : r.blocker_id)
      }
      blockedIdsRef.current = ids
    })()
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(rawQuery), debounceMs)
    return () => clearTimeout(t)
  }, [rawQuery, debounceMs])

  useEffect(() => {
    const trimmed = debouncedQuery.trim()
    const isAtSearch = trimmed.startsWith('@')
    const cleanQuery = isAtSearch ? trimmed.slice(1) : trimmed

    if (cleanQuery.length < (isAtSearch ? 1 : 2)) {
      setGroupedRecs([])
      setPeople([])
      setLoading(false)
      setError(false)
      return
    }

    const id = ++searchIdRef.current
    const supabase = supabaseRef.current

    async function fetchRecs(): Promise<{ rows: Recommendation[]; failed: boolean }> {
      const baseQuery = supabase
        .from('recommendations')
        .select('*')
        .ilike('title', `%${cleanQuery}%`)
        .order('created_at', { ascending: false })
        .limit(recLimit)

      const { data: recData, error: recErr } = category !== 'all'
        ? await baseQuery.eq('category', category)
        : await baseQuery

      if (recErr) {
        if (process.env.NODE_ENV !== 'production') console.error('[Notable] rec search failed:', recErr.message)
        return { rows: [], failed: true }
      }

      const rows = (recData ?? []) as Recommendation[]
      if (rows.length === 0) return { rows: [], failed: false }

      const userIds = [...new Set(rows.map(r => r.user_id))]
      const { data: profilesData, error: profErr } = await supabase
        .from('profiles')
        .select('id, name, handle, avatar_url')
        .in('id', userIds)

      if (profErr && process.env.NODE_ENV !== 'production') console.error('[Notable] rec search profiles failed:', profErr.message)

      const profileMap: Record<string, RecProfile> = {}
      for (const p of (profilesData ?? [])) profileMap[p.id] = p as RecProfile

      return {
        rows: rows
          .filter(r => !blockedIdsRef.current.has(r.user_id))
          .map(r => ({ ...r, profiles: profileMap[r.user_id] ?? null })),
        failed: false,
      }
    }

    // Note: Private profiles intentionally appear in search results so users
    // can find them and send follow requests. The profile page handles the
    // privacy gate — non-followers see only name, avatar, bio, and a Follow
    // button. Content is hidden until the follow request is accepted.
    async function fetchPeople(): Promise<{ rows: SearchPerson[]; failed: boolean }> {
      // Values embedded in .or() must be double-quoted (with " and \ escaped),
      // otherwise commas/parentheses in the query break PostgREST's filter parser.
      const quoted = '"%' + cleanQuery.replace(/[\\"]/g, m => '\\' + m) + '%"'
      const { data, error: pplErr } = await supabase
        .from('profiles')
        .select('id, name, handle, avatar_url, bio, profile_private')
        .or(`name.ilike.${quoted},handle.ilike.${quoted}`)
        .limit(peopleLimit)
      if (pplErr) {
        if (process.env.NODE_ENV !== 'production') console.error('[Notable] people search failed:', pplErr.message)
        return { rows: [], failed: true }
      }
      return { rows: ((data ?? []) as SearchPerson[]).filter(p => !blockedIdsRef.current.has(p.id)), failed: false }
    }

    async function doSearch() {
      setLoading(true)

      const shouldFetchRecs = !isAtSearch && category !== 'people'
      const shouldFetchPeople = isAtSearch || category === 'all' || category === 'people'

      const [recsRes, peopleRes] = await Promise.all([
        shouldFetchRecs ? fetchRecs() : Promise.resolve({ rows: [] as Recommendation[], failed: false }),
        shouldFetchPeople ? fetchPeople() : Promise.resolve({ rows: [] as SearchPerson[], failed: false }),
      ])

      if (id !== searchIdRef.current) return
      setGroupedRecs(groupSearchResults(recsRes.rows))
      setPeople(peopleRes.rows)
      setError(recsRes.failed || peopleRes.failed)
      setLoading(false)
    }

    doSearch()
  }, [debouncedQuery, category, recLimit, peopleLimit])

  return { groupedRecs, people, loading, error, query: rawQuery, setQuery: setRawQuery }
}
