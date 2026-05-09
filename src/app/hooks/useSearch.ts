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
  const searchIdRef = useRef(0)

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
      return
    }

    const id = ++searchIdRef.current
    const supabase = supabaseRef.current

    async function fetchRecs(): Promise<Recommendation[]> {
      const baseQuery = supabase
        .from('recommendations')
        .select('*')
        .ilike('title', `%${cleanQuery}%`)
        .order('created_at', { ascending: false })
        .limit(recLimit)

      const { data: recData } = category !== 'all'
        ? await baseQuery.eq('category', category)
        : await baseQuery

      const rows = (recData ?? []) as Recommendation[]
      if (rows.length === 0) return []

      const userIds = [...new Set(rows.map(r => r.user_id))]
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, name, handle, avatar_url')
        .in('id', userIds)

      const profileMap: Record<string, RecProfile> = {}
      for (const p of (profilesData ?? [])) profileMap[p.id] = p as RecProfile

      return rows.map(r => ({ ...r, profiles: profileMap[r.user_id] ?? null }))
    }

    async function fetchPeople(): Promise<SearchPerson[]> {
      const { data } = await supabase
        .from('profiles')
        .select('id, name, handle, avatar_url, bio')
        .or(`name.ilike.%${cleanQuery}%,handle.ilike.%${cleanQuery}%`)
        .limit(peopleLimit)
      return (data ?? []) as SearchPerson[]
    }

    async function doSearch() {
      setLoading(true)

      const shouldFetchRecs = !isAtSearch && category !== 'people'
      const shouldFetchPeople = isAtSearch || category === 'all' || category === 'people'

      const [newRecs, newPeople] = await Promise.all([
        shouldFetchRecs ? fetchRecs() : Promise.resolve<Recommendation[]>([]),
        shouldFetchPeople ? fetchPeople() : Promise.resolve<SearchPerson[]>([]),
      ])

      if (id !== searchIdRef.current) return
      setGroupedRecs(groupSearchResults(newRecs))
      setPeople(newPeople)
      setLoading(false)
    }

    doSearch()
  }, [debouncedQuery, category, recLimit, peopleLimit])

  return { groupedRecs, people, loading, query: rawQuery, setQuery: setRawQuery }
}
