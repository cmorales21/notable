'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useWhispers() {
  const supabase = useRef(createClient()).current
  const [hintsSeen, setHintsSeen] = useState<string[] | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return
      setUserId(user.id)
      const { data } = await supabase
        .from('profiles')
        .select('hints_seen')
        .eq('id', user.id)
        .maybeSingle()
      if (!cancelled) setHintsSeen(data?.hints_seen ?? [])
    }
    load()
    return () => { cancelled = true }
  }, [supabase])

  const dismiss = useCallback(
    async (whisperId: string) => {
      if (!userId) return
      const next = [...(hintsSeen ?? []), whisperId]
      setHintsSeen(next)
      await supabase
        .from('profiles')
        .update({ hints_seen: next })
        .eq('id', userId)
    },
    [userId, hintsSeen, supabase]
  )

  const shouldShow = useCallback(
    (whisperId: string) => {
      if (hintsSeen === null) return false
      return !hintsSeen.includes(whisperId)
    },
    [hintsSeen]
  )

  return { shouldShow, dismiss, loading: hintsSeen === null }
}
