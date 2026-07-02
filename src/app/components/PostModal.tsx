'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { RecommendationImage } from '@/app/components/RecommendationImage'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Whisper from '@/app/components/Whisper'
import { useWhispers } from '@/app/hooks/useWhispers'
import { useToast } from '@/app/components/Toast'
import { createOrMatchItem } from '@/lib/items'
import { CATEGORY_CONFIG, CATEGORY_ORDER, type Category } from '@/app/components/feed/categoryConfig'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SearchResult {
  id: string
  title: string
  subtitle?: string
  image: string | null
  year?: string
  external_url?: string | null
  itemId?: string
  fromNotable?: boolean
}

interface ConfirmedItem extends SearchResult {
  fromExternal?: boolean
}

interface NotableItem {
  id: string
  title: string
  category: string
  image_url: string | null
  author_or_creator: string | null
  year: number | null
  outbound_url: string | null
  outbound_partner: string | null
  external_source: string | null
  similarity: number
}

const EXTERNAL_SOURCE: Record<string, string> = {
  books:    'google_books',
  movies:   'tmdb',
  music:    'itunes',
  podcasts: 'itunes',
}

interface MentionResult {
  id: string
  name: string | null
  handle: string | null
  avatar_url: string | null
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const CAT_ICON_SRC: Record<Category, string> = {
  books:       '/icons/books-small.svg',
  movies:      '/icons/movies-small.svg',
  music:       '/icons/music-small.svg',
  restaurants: '/icons/restaurants-small.svg',
  podcasts:    '/icons/podcasts-small.svg',
}

function CatIcon({ id, selected = false }: { id: Category; selected?: boolean }) {
  return (
    <Image
      src={CAT_ICON_SRC[id]}
      alt={id}
      width={16}
      height={16}
      style={{
        filter: selected ? 'brightness(0) invert(1)' : 'brightness(0)',
        opacity: selected ? 1 : 0.45,
        width: '16px',
        height: '16px',
      }}
    />
  )
}

// ─── Result row ───────────────────────────────────────────────────────────────

function ResultRow({ item, category, onSelect }: { item: SearchResult; category: string; onSelect: (r: SearchResult) => void }) {
  return (
    <button
      onClick={() => onSelect(item)}
      className="post-modal-row font-body"
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: '11px',
        background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
        borderBottom: '1px solid rgba(0,0,0,0.03)',
        padding: '10px 14px',
      }}
    >
      <RecommendationImage src={item.image} category={category} alt={item.title} width={40} height={40} style={{ borderRadius: '7px' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          color: 'var(--color-text)', fontSize: '13px', fontWeight: 500,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {item.title}
        </p>
        {(item.subtitle || item.year) && (
          <p style={{
            color: 'var(--color-muted)', fontSize: '11px', marginTop: '2px',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {item.subtitle ?? ''}{item.subtitle && item.year ? ` · ${item.year}` : item.year ?? ''}
          </p>
        )}
      </div>
    </button>
  )
}

// ─── URL helpers ──────────────────────────────────────────────────────────────

function detectCategoryFromUrl(url: string): Category | null {
  if (/spotify\.com|apple\.com\/music|apple\.com\/album/.test(url)) return 'music'
  if (/podcasts\.apple\.com|apple\.com\/podcast/.test(url)) return 'podcasts'
  if (/imdb\.com|themoviedb\.org|letterboxd\.com/.test(url)) return 'movies'
  if (/goodreads\.com|books\.google\.com/.test(url)) return 'books'
  if (/yelp\.com|tripadvisor\.com|maps\.google\.com/.test(url)) return 'restaurants'
  return null
}

const URL_RE = /https?:\/\/[^\s]+/i

const TRIGGER_VERBS = /\b(?:loved|finished|watched|read|heard|recommend(?:ed)?|started|listening|reading|watching)\b/i

let _nlp: typeof import('compromise')['default'] | null = null

async function extractTitle(text: string): Promise<string | null> {
  if (!_nlp) _nlp = (await import('compromise')).default
  const doc = _nlp(text)

  // Try proper nouns first
  const properNouns = doc.match('#ProperNoun+').out('array') as string[]
  if (properNouns.length) return properNouns[0]

  // Try noun after trigger verb
  const sentences = doc.sentences().json() as Array<{ text: string }>
  for (const { text: sent } of sentences) {
    const match = sent.match(TRIGGER_VERBS)
    if (!match) continue
    const after = sent.slice(sent.search(TRIGGER_VERBS) + match[0].length).trim()
    const noun = _nlp(after).match('#Noun+').out('text') as string
    if (noun.trim().length >= 2) return noun.trim()
  }

  return null
}

function getCaretOffset(el: HTMLElement): number {
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount) return 0
  const r = sel.getRangeAt(0)
  const pre = r.cloneRange()
  pre.selectNodeContents(el)
  pre.setEnd(r.endContainer, r.endOffset)
  return pre.toString().length
}

function cleanMentionSpans(el: HTMLDivElement) {
  const sel = window.getSelection()
  let savedNode: Node | null = null
  let savedOffset = 0
  if (sel && sel.rangeCount) {
    const r = sel.getRangeAt(0)
    savedNode = r.startContainer
    savedOffset = r.startOffset
  }

  const spans = Array.from(el.querySelectorAll<HTMLSpanElement>('span[data-mention]'))
  for (const span of spans) {
    if (/^@[a-zA-Z0-9_]+$/.test(span.textContent ?? '')) continue
    const text = span.textContent ?? ''
    const textNode = document.createTextNode(text)
    const cursorWasInside = savedNode != null && span.contains(savedNode)
    span.replaceWith(textNode)
    if (cursorWasInside && sel) {
      const newRange = document.createRange()
      newRange.setStart(textNode, Math.min(savedOffset, text.length))
      newRange.collapse(true)
      sel.removeAllRanges()
      sel.addRange(newRange)
    }
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PostModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const supabase = useRef(createClient())

  const [category, setCategory] = useState<Category | null>(null)
  const [text, setText] = useState('')
  const [confirmedItem, setConfirmedItem] = useState<ConfirmedItem | null>(null)
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)

  const [dropdownItems, setDropdownItems] = useState<SearchResult[]>([])
  const [notableItems, setNotableItems] = useState<SearchResult[]>([])
  const [dropdownVisible, setDropdownVisible] = useState(false)
  const [searching, setSearching] = useState(false)
  const [searchEmpty, setSearchEmpty] = useState(false)

  const [manualMode, setManualMode] = useState(false)
  const [manualQuery, setManualQuery] = useState('')
  const [manualSearching, setManualSearching] = useState(false)

  const [posting, setPosting] = useState(false)
  const [postSuccess, setPostSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [podcastSearchType, setPodcastSearchType] = useState<'show' | 'episode'>('show')
  const [discardConfirm, setDiscardConfirm] = useState(false)
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null)

  // @ mention state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionResults, setMentionResults] = useState<MentionResult[]>([])

  const editorRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const urlTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const manualTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const emptyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const noSignalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchIdRef = useRef(0)
  const categoryRef = useRef<Category | null>(null)
  const podcastTypeRef = useRef<'show' | 'episode'>('show')
  const mentionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mentionAtPosRef = useRef(-1)
  const skipDupRef = useRef(false)

  const { dismiss: dismissWhisper } = useWhispers()
  const toast = useToast()

  const accentColor = category ? CATEGORY_CONFIG[category].color : '#6b9fd4'
  const canPost = !!category && (!!confirmedItem || !!uploadedImage || text.replace(URL_RE, '').trim().length > 5)
  const mentionActive = mentionQuery !== null && mentionQuery.length >= 1 && mentionResults.length > 0

  const syncCategory = (cat: Category | null) => {
    categoryRef.current = cat
    setCategory(cat)
  }

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  const requestClose = useCallback(() => {
    const hasProgress = !!confirmedItem || !!uploadedImage || text.replace(URL_RE, '').trim().length > 0
    if (hasProgress) { setDiscardConfirm(true); return }
    onClose()
  }, [confirmedItem, uploadedImage, text, onClose])

  // ESC key handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (discardConfirm) { setDiscardConfirm(false); return }
      if (duplicateWarning) { setDuplicateWarning(null); return }
      requestClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [discardConfirm, duplicateWarning, requestClose])

  // Clear all debounce timers on unmount
  useEffect(() => {
    return () => {
      if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current)
      if (urlTimerRef.current) clearTimeout(urlTimerRef.current)
      if (manualTimerRef.current) clearTimeout(manualTimerRef.current)
      if (emptyTimerRef.current) clearTimeout(emptyTimerRef.current)
      if (noSignalTimerRef.current) clearTimeout(noSignalTimerRef.current)
      if (mentionTimerRef.current) clearTimeout(mentionTimerRef.current)
    }
  }, [])

  // ── Search ────────────────────────────────────────────────────────────────

  const searchCategory = useCallback(async (query: string, cat: Category | null) => {
    if (cat === 'restaurants') return
    const id = ++searchIdRef.current
    setSearching(true)
    setNotableItems([])
    try {
      const notableUrl = cat
        ? `/api/search/items?q=${encodeURIComponent(query)}&category=${cat}&limit=4`
        : `/api/search/items?q=${encodeURIComponent(query)}&limit=8`
      const externalFetch = cat
        ? (() => { let u = `/api/search/${cat}?q=${encodeURIComponent(query)}`; if (cat === 'podcasts') u += `&type=${podcastTypeRef.current}`; return fetch(u).then(r => r.json()) })()
        : Promise.reject('no-category')

      const [notableResult, externalResult] = await Promise.allSettled([
        fetch(notableUrl).then(r => r.json()),
        externalFetch,
      ])

      if (id !== searchIdRef.current) return

      const notable: SearchResult[] = notableResult.status === 'fulfilled'
        ? ((notableResult.value.items ?? []) as NotableItem[]).map(item => ({
            id: item.id,
            title: item.title,
            subtitle: item.author_or_creator ?? undefined,
            image: item.image_url,
            year: item.year != null ? String(item.year) : undefined,
            external_url: item.outbound_url ?? null,
            itemId: item.id,
            fromNotable: true,
          }))
        : []

      const external: SearchResult[] = externalResult.status === 'fulfilled'
        ? ((externalResult.value.items ?? []) as SearchResult[]).slice(0, 8)
        : []

      if (notable.length > 0 || external.length > 0) {
        setNotableItems(notable)
        setDropdownItems(external)
        setDropdownVisible(true)
        setSearchEmpty(false)
      } else {
        if (emptyTimerRef.current) clearTimeout(emptyTimerRef.current)
        setSearchEmpty(true)
        emptyTimerRef.current = setTimeout(() => setSearchEmpty(false), 400)
      }
    } catch { /* silent */ }
    finally { if (id === searchIdRef.current) setSearching(false) }
  }, [])

  const extractUrl = useCallback(async (url: string) => {
    const id = ++searchIdRef.current
    setSearching(true)
    try {
      const res = await fetch('/api/search/extract-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      if (id !== searchIdRef.current) return
      if (!res.ok) {
        toast(`Couldn't load a preview for that link`)
        return
      }
      const data = await res.json() as { title: string; image_url: string | null }
      if (id !== searchIdRef.current) return
      if (data.title) {
        const detected = detectCategoryFromUrl(url)
        if (detected && !categoryRef.current) syncCategory(detected)
        setConfirmedItem({
          id: crypto.randomUUID(),
          title: data.title,
          image: data.image_url,
          external_url: url,
          fromExternal: false,
        })
        setDropdownVisible(false)
      }
    } catch { /* silent */ }
    finally { if (id === searchIdRef.current) setSearching(false) }
  }, [toast])

  // ── @ mention search ─────────────────────────────────────────────────────

  const searchMentions = useCallback(async (query: string) => {
    const { data } = await supabase.current
      .from('profiles')
      .select('id, name, handle, avatar_url')
      .or(`handle.ilike.${query}%,name.ilike.${query}%`)
      .limit(5)
    setMentionResults((data as MentionResult[]) ?? [])
  }, [])

  const insertMention = useCallback((handle: string) => {
    const el = editorRef.current
    if (!el) return

    const sel = window.getSelection()
    if (!sel || !sel.rangeCount) { setMentionQuery(null); setMentionResults([]); return }

    const { endContainer, endOffset } = sel.getRangeAt(0)
    if (endContainer.nodeType !== Node.TEXT_NODE) { setMentionQuery(null); setMentionResults([]); return }

    const before = (endContainer.textContent ?? '').slice(0, endOffset)
    const atIndex = before.lastIndexOf('@')
    if (atIndex < 0) { setMentionQuery(null); setMentionResults([]); return }

    const replaceRange = document.createRange()
    replaceRange.setStart(endContainer, atIndex)
    replaceRange.setEnd(endContainer, endOffset)
    replaceRange.deleteContents()

    const span = document.createElement('span')
    const color = categoryRef.current ? CATEGORY_CONFIG[categoryRef.current].color : '#6b9fd4'
    span.style.color = color
    span.style.fontWeight = '500'
    span.dataset.mention = ''
    span.textContent = `@${handle}`

    const spaceNode = document.createTextNode(' ')
    replaceRange.insertNode(spaceNode)
    replaceRange.insertNode(span)

    const newRange = document.createRange()
    newRange.setStartAfter(spaceNode)
    newRange.collapse(true)
    sel.removeAllRanges()
    sel.addRange(newRange)

    const raw = el.innerText
    setText(raw === '\n' ? '' : raw)
    setMentionQuery(null)
    setMentionResults([])
  }, [])

  // ── Paste detection ───────────────────────────────────────────────────────

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const pasted = e.clipboardData.getData('text')

    if (pasted.includes('<iframe') || pasted.includes('iframe')) {
      const iframeChunk = pasted.includes('</iframe>')
        ? pasted.slice(0, pasted.indexOf('</iframe>') + '</iframe>'.length)
        : pasted
      const PLATFORMS = [
        'open.spotify.com', 'youtube.com', 'youtu.be',
        'player.vimeo.com', 'vimeo.com',
        'w.soundcloud.com', 'soundcloud.com',
        'bandcamp.com',
        'embed.music.apple.com', 'music.apple.com',
      ]
      if (PLATFORMS.some(p => iframeChunk.includes(p))) {
        const srcMatch = iframeChunk.match(/src=["']([^"']+)["']/)
        if (srcMatch) {
          e.preventDefault()
          let url = srcMatch[1]
          if (url.includes('open.spotify.com/embed/')) {
            url = url.replace('/embed/', '/').split('?')[0]
          } else if (url.includes('youtube.com/embed/')) {
            const id = url.split('/embed/')[1]?.split(/[?#]/)[0]
            if (id) url = `https://www.youtube.com/watch?v=${id}`
          } else if (url.includes('player.vimeo.com/video/')) {
            const id = url.split('/video/')[1]?.split(/[?#]/)[0]
            if (id) url = `https://vimeo.com/${id}`
          } else if (url.includes('embed.music.apple.com/')) {
            url = url.replace('embed.music.apple.com/', 'music.apple.com/').split('?')[0]
          }
          extractUrl(url)
          return
        }
      }
    }

    // Prevent HTML paste — always insert as plain text
    e.preventDefault()
    document.execCommand('insertText', false, pasted)
    // onInput fires automatically after execCommand and syncs text state
  }

  // ── Text change ───────────────────────────────────────────────────────────

  const handleInput = () => {
    const el = editorRef.current
    if (!el) return

    cleanMentionSpans(el)

    const raw = el.innerText
    const val = raw === '\n' ? '' : raw
    setText(val)

    // @ mention detection — runs even when confirmedItem is set
    const cursorPos = getCaretOffset(el)
    const beforeCursor = val.slice(0, cursorPos)
    const mentionMatch = beforeCursor.match(/(^|[\s])@([a-zA-Z0-9_]*)$/)
    if (mentionMatch) {
      const query = mentionMatch[2]
      mentionAtPosRef.current = beforeCursor.lastIndexOf('@')
      setMentionQuery(query)
      if (query.length >= 1) {
        if (mentionTimerRef.current) clearTimeout(mentionTimerRef.current)
        mentionTimerRef.current = setTimeout(() => searchMentions(query), 200)
      } else {
        setMentionResults([])
      }
    } else {
      if (mentionQuery !== null) {
        setMentionQuery(null)
        setMentionResults([])
      }
    }

    if (confirmedItem) return

    if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current)
    if (urlTimerRef.current) clearTimeout(urlTimerRef.current)
    if (noSignalTimerRef.current) { clearTimeout(noSignalTimerRef.current); noSignalTimerRef.current = null }

    const urlMatch = val.match(/https?:\/\/[^\s]+/i)
    if (urlMatch) {
      urlTimerRef.current = setTimeout(() => extractUrl(urlMatch[0]), 400)
      return
    }

    const cat = categoryRef.current
    if (cat !== 'restaurants') {
      pauseTimerRef.current = setTimeout(async () => {
        const trimmed = val.trim()
        if (trimmed.length < 3) return

        const wordCount = trimmed.split(/\s+/).length
        const hasTriggerVerb = TRIGGER_VERBS.test(trimmed)
        const query = (wordCount < 6 && !hasTriggerVerb)
          ? trimmed
          : await extractTitle(trimmed)

        if (!query) {
          if (emptyTimerRef.current) clearTimeout(emptyTimerRef.current)
          setSearching(true)
          noSignalTimerRef.current = setTimeout(() => {
            noSignalTimerRef.current = null
            setSearching(false)
            setSearchEmpty(true)
            emptyTimerRef.current = setTimeout(() => setSearchEmpty(false), 400)
          }, 400)
          return
        }

        searchCategory(query, cat)
      }, 600)
    }
  }

  // ── Category ──────────────────────────────────────────────────────────────

  const handleCategorySelect = async (cat: Category) => {
    const next = category === cat ? null : cat
    syncCategory(next)
    if (next) dismissWhisper('post-category-hint')
    if (!next) { setDropdownItems([]); setNotableItems([]); setDropdownVisible(false); return }
    if (!confirmedItem && next !== 'restaurants') {
      const trimmed = text.replace(URL_RE, '').trim()
      if (trimmed) {
        if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current)
        const wordCount = trimmed.split(/\s+/).length
        const hasTriggerVerb = TRIGGER_VERBS.test(trimmed)
        const query = (wordCount < 6 && !hasTriggerVerb)
          ? trimmed
          : ((await extractTitle(trimmed)) ?? trimmed)
        searchCategory(query, next)
      }
    }
  }

  // ── Confirm result ────────────────────────────────────────────────────────

  const handleConfirm = (item: SearchResult) => {
    setConfirmedItem({ ...item, fromExternal: !item.fromNotable })
    setDropdownVisible(false)
    setManualMode(false)
    setManualQuery('')
    setDropdownItems([])
    setNotableItems([])
  }

  // ── Manual search ─────────────────────────────────────────────────────────

  const handleManualQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setManualQuery(val)
    if (manualTimerRef.current) clearTimeout(manualTimerRef.current)
    const cat = categoryRef.current
    if (!val.trim() || !cat || cat === 'restaurants') { setDropdownItems([]); setNotableItems([]); return }
    manualTimerRef.current = setTimeout(async () => {
      const query = val.trim().split(/\s+/).length >= 4 ? ((await extractTitle(val)) ?? val) : val
      setManualSearching(true)
      try {
        let externalUrl = `/api/search/${cat}?q=${encodeURIComponent(query)}`
        if (cat === 'podcasts') externalUrl += `&type=${podcastTypeRef.current}`
        const notableUrl = `/api/search/items?q=${encodeURIComponent(query)}&category=${cat}&limit=4`

        const [notableResult, externalResult] = await Promise.allSettled([
          fetch(notableUrl).then(r => r.json()),
          fetch(externalUrl).then(r => r.json()),
        ])

        const notable: SearchResult[] = notableResult.status === 'fulfilled'
          ? ((notableResult.value.items ?? []) as NotableItem[]).map(item => ({
              id: item.id,
              title: item.title,
              subtitle: item.author_or_creator ?? undefined,
              image: item.image_url,
              year: item.year != null ? String(item.year) : undefined,
              external_url: item.outbound_url ?? null,
              itemId: item.id,
              fromNotable: true,
            }))
          : []

        const external: SearchResult[] = externalResult.status === 'fulfilled'
          ? ((externalResult.value.items ?? []) as SearchResult[]).slice(0, 8)
          : []

        setNotableItems(notable)
        setDropdownItems(external)
      } catch { setDropdownItems([]); setNotableItems([]) }
      finally { setManualSearching(false) }
    }, 300)
  }

  // ── File upload ───────────────────────────────────────────────────────────

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setUploadedImage(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  // ── Post ──────────────────────────────────────────────────────────────────

  const handlePost = async () => {
    if (!canPost || posting || postSuccess) return
    setPosting(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.current.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const rawText = editorRef.current?.innerText ?? text
      const cleanedText = rawText
        .replace(/https?:\/\/[^\s]+/gi, '')
        .replace(/\s{2,}/g, ' ')
        .trim()
        .slice(0, 1000)

      const title = confirmedItem?.title
        ?? (cleanedText.split('\n')[0].trim().slice(0, 100) || 'Untitled')

      if (!skipDupRef.current) {
        const { data: existing } = await supabase.current
          .from('recommendations')
          .select('id, title')
          .eq('user_id', user.id)
          .ilike('title', title)
          .maybeSingle()
        if (existing) {
          setDuplicateWarning(existing.title as string)
          setPosting(false)
          return
        }
      }
      skipDupRef.current = false

      // Create or match item in Notable DB (fire before insert; non-blocking on failure)
      let recItemId: string | null = null
      if (category !== 'restaurants') {
        try {
          if (confirmedItem?.itemId) {
            recItemId = confirmedItem.itemId
          } else {
            recItemId = await createOrMatchItem({
              title,
              category: category!,
              imageUrl:        confirmedItem?.image ?? undefined,
              authorOrCreator: confirmedItem?.subtitle ?? undefined,
              year:            confirmedItem?.year ? parseInt(confirmedItem.year, 10) : undefined,
              externalId:      confirmedItem?.fromNotable ? undefined : (confirmedItem?.id ?? undefined),
              externalSource:  EXTERNAL_SOURCE[category!] ?? undefined,
              externalUrl:     confirmedItem?.external_url ?? undefined,
            })
          }
        } catch { /* non-fatal */ }
      }

      const { error: insertError } = await supabase.current
        .from('recommendations')
        .insert({
          user_id: user.id,
          category: category!,
          title,
          description: cleanedText || null,
          image_url: uploadedImage ?? confirmedItem?.image ?? null,
          external_url: confirmedItem?.external_url ?? null,
          item_id: recItemId,
        })
        .select('id')
        .single()

      if (insertError) throw insertError

      setPostSuccess(true)
      toast('Recommendation posted!')
      const postedCategory = category!
      window.dispatchEvent(new CustomEvent('notable:new-post', { detail: { category: postedCategory } }))
      setTimeout(() => {
        onClose()
        router.refresh()
        router.push(`/${postedCategory}`)
      }, 1000)
    } catch (err) {
      console.error('[Notable] post failed:', err)
      setError('Something went wrong posting your recommendation — please try again.')
      setPosting(false)
    }
  }

  const mouseDownTarget = useRef<EventTarget | null>(null)

  const handleBackdropMouseDown = (e: React.MouseEvent) => {
    mouseDownTarget.current = e.target
  }

  const handleBackdropMouseUp = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && mouseDownTarget.current === e.currentTarget) requestClose()
  }

  const openManualSearch = () => {
    setManualMode(true)
    setDropdownVisible(true)
    setDropdownItems([])
  }

  const closeManualSearch = () => {
    setManualMode(false)
    setDropdownVisible(false)
    setManualQuery('')
    setDropdownItems([])
    setNotableItems([])
  }

  const handlePodcastTypeToggle = async (type: 'show' | 'episode') => {
    if (podcastSearchType === type) return
    podcastTypeRef.current = type
    setPodcastSearchType(type)
    if (manualMode && manualQuery.trim()) {
      setManualSearching(true)
      fetch(`/api/search/podcasts?q=${encodeURIComponent(manualQuery)}&type=${type}`)
        .then(r => r.json() as Promise<{ items: SearchResult[] }>)
        .then(data => setDropdownItems(data.items?.slice(0, 8) ?? []))
        .catch(() => setDropdownItems([]))
        .finally(() => setManualSearching(false))
    } else if (!manualMode) {
      const query = await extractTitle(text)
      if (query) searchCategory(query, 'podcasts')
    }
  }


  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes modal-backdrop-in { from{opacity:0} to{opacity:1} }
        @keyframes modal-card-in { from{opacity:0;transform:scale(0.96) translateY(10px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes dropdown-in { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:translateY(0)} }
        @keyframes confirmed-in { from{opacity:0;transform:scale(0.94)} to{opacity:1;transform:scale(1)} }
        @keyframes border-pulse { 0%,100%{box-shadow:0 0 0 0 transparent} 50%{box-shadow:0 0 0 2px ${accentColor}40} }
        @keyframes spin { to{transform:rotate(360deg)} }
        .pm-backdrop { animation: modal-backdrop-in 0.18s ease; }
        .pm-card { animation: modal-card-in 0.26s cubic-bezier(0.16,1,0.3,1); }
        .pm-dropdown { animation: dropdown-in 0.16s cubic-bezier(0.16,1,0.3,1); }
        .pm-confirmed { animation: confirmed-in 0.22s cubic-bezier(0.16,1,0.3,1); }
        .pm-pill { transition: background 0.13s, color 0.13s, border-color 0.13s, box-shadow 0.13s, transform 0.1s; }
        .pm-pill:active { transform: scale(0.92); }
        .pm-row { transition: background 0.08s; }
        .pm-row:hover { background: rgba(0,0,0,0.03) !important; }
        .post-modal-row { transition: background 0.08s; }
        .post-modal-row:hover { background: rgba(0,0,0,0.03); }
        .pm-textarea-searching { animation: border-pulse 1.1s ease-in-out infinite; }
      `}</style>

      {/* Backdrop */}
      <div
        className="pm-backdrop"
        onMouseDown={handleBackdropMouseDown}
        onMouseUp={handleBackdropMouseUp}
        style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: 'rgba(0,0,0,0.62)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '16px',
        }}
      >
        {/* Card */}
        <div
          className="pm-card modal-sheet"
          style={{
            width: '100%', maxWidth: '520px',
            maxHeight: 'calc(100dvh - 32px)',
            background: '#faf8f4',
            borderRadius: '16px',
            border: '1px solid rgba(0,0,0,0.08)',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative',
            boxShadow: '0 32px 80px rgba(58,42,26,0.18), 0 0 0 1px rgba(0,0,0,0.04)',
          }}
        >
          {/* Discard confirmation overlay */}
          {discardConfirm && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 10, borderRadius: '16px',
              background: 'rgba(250,248,244,0.92)', backdropFilter: 'blur(6px)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: '12px', padding: '24px',
            }}>
              <p className="font-display" style={{ fontSize: '17px', fontWeight: 700, color: '#33261a', textAlign: 'center' }}>
                Discard post?
              </p>
              <p className="font-body" style={{ fontSize: '14px', color: '#6b5d4f', textAlign: 'center', marginTop: '-4px' }}>
                Your progress will be lost.
              </p>
              <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                <button onClick={onClose} className="font-body" style={{
                  padding: '10px 22px', borderRadius: '999px',
                  background: '#e05555', border: 'none', cursor: 'pointer',
                  color: 'white', fontSize: '14px', fontWeight: 600,
                }}>
                  Discard
                </button>
                <button onClick={() => setDiscardConfirm(false)} className="font-body" style={{
                  padding: '10px 22px', borderRadius: '999px',
                  background: 'transparent', border: '1.5px solid rgba(0,0,0,0.12)',
                  cursor: 'pointer', color: '#33261a', fontSize: '14px', fontWeight: 500,
                }}>
                  Keep editing
                </button>
              </div>
            </div>
          )}

          {/* Duplicate warning overlay */}
          {duplicateWarning && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 10, borderRadius: '16px',
              background: 'rgba(250,248,244,0.92)', backdropFilter: 'blur(6px)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: '12px', padding: '24px',
            }}>
              <p className="font-display" style={{ fontSize: '17px', fontWeight: 700, color: '#33261a', textAlign: 'center' }}>
                Already recommended
              </p>
              <p className="font-body" style={{ fontSize: '14px', color: '#6b5d4f', textAlign: 'center', marginTop: '-4px' }}>
                You&apos;ve already recommended &ldquo;{duplicateWarning}&rdquo;.
              </p>
              <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                <button
                  onClick={() => { skipDupRef.current = true; setDuplicateWarning(null); handlePost() }}
                  className="font-body"
                  style={{
                    padding: '10px 22px', borderRadius: '999px',
                    background: accentColor, border: 'none', cursor: 'pointer',
                    color: 'white', fontSize: '14px', fontWeight: 600,
                  }}
                >
                  Post anyway
                </button>
                <button onClick={() => setDuplicateWarning(null)} className="font-body" style={{
                  padding: '10px 22px', borderRadius: '999px',
                  background: 'transparent', border: '1.5px solid rgba(0,0,0,0.12)',
                  cursor: 'pointer', color: '#33261a', fontSize: '14px', fontWeight: 500,
                }}>
                  Go back
                </button>
              </div>
            </div>
          )}

          {/* ── Top bar ─────────────────────────────────────────────── */}
          <div style={{
            flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 16px 13px',
            borderBottom: '1px solid rgba(0,0,0,0.06)',
          }}>
            <button
              onClick={requestClose}
              aria-label="Close"
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--color-muted)', padding: '6px', margin: '-6px',
                display: 'flex', alignItems: 'center', borderRadius: '8px',
                transition: 'color 0.15s',
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>

            <button
              onClick={handlePost}
              disabled={!canPost || posting || postSuccess}
              className="font-body"
              style={{
                background: postSuccess ? '#4aad4e' : canPost ? accentColor : 'transparent',
                color: postSuccess ? 'white' : canPost ? 'white' : 'var(--color-muted)',
                border: canPost || postSuccess ? 'none' : '1.5px solid rgba(0,0,0,0.1)',
                borderRadius: '20px',
                padding: '7px 18px',
                fontSize: '14px', fontWeight: 600,
                cursor: canPost && !posting && !postSuccess ? 'pointer' : 'default',
                transition: 'background 0.2s, color 0.2s, box-shadow 0.2s',
                display: 'flex', alignItems: 'center', gap: '6px',
                boxShadow: canPost && !posting && !postSuccess ? `0 3px 14px ${accentColor}45` : 'none',
              }}
            >
              {postSuccess ? 'Posted ✓' : posting ? (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"
                    style={{ animation: 'spin 0.8s linear infinite' }}>
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                  Posting…
                </>
              ) : 'Post'}
            </button>
          </div>

          {/* ── Scrollable body ──────────────────────────────────────── */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 20px' }}>

            {/* Category pills */}
            <div style={{
              display: 'flex', gap: '6px',
              overflowX: 'auto', scrollbarWidth: 'none',
              margin: '0 -16px 18px',
              padding: '0 16px',
            }}>
              {CATEGORY_ORDER.map(id => {
                const { label, color } = CATEGORY_CONFIG[id]
                const sel = category === id
                return (
                  <button
                    key={id}
                    onClick={() => handleCategorySelect(id)}
                    className="pm-pill font-body"
                    style={{
                      background: sel ? color : 'transparent',
                      color: sel ? 'white' : 'var(--color-muted)',
                      border: `1.5px solid ${sel ? color : 'rgba(0,0,0,0.1)'}`,
                      borderRadius: '20px',
                      padding: '5px 10px 5px 8px',
                      fontSize: '12px', fontWeight: sel ? 600 : 400,
                      cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                      boxShadow: sel ? `0 2px 10px ${color}45` : 'none',
                      display: 'flex', alignItems: 'center', gap: '5px',
                    }}
                  >
                    <CatIcon id={id} selected={sel} />
                    {label}
                  </button>
                )
              })}
            </div>

            {/* Category hint whisper */}
            <div style={{ marginTop: '-10px', marginBottom: '14px' }}>
              <Whisper id="post-category-hint" message="Select the topic for your recommendation." />
            </div>

            {/* Compose area */}
            <div style={{ position: 'relative' }}>
              {!text.trim() && (
                <span
                  className="font-body"
                  style={{
                    position: 'absolute', top: '16px', left: '16px',
                    color: '#6b5d4f', fontSize: '16px', lineHeight: 1.7,
                    pointerEvents: 'none', userSelect: 'none',
                  }}
                >
                  What have you loved lately?
                </span>
              )}
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={handleInput}
                onPaste={handlePaste}
                className={`font-body ${searching ? 'pm-textarea-searching' : ''}`}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'var(--color-background)',
                  border: '1px solid rgba(0,0,0,0.08)',
                  borderRadius: '12px',
                  padding: '16px',
                  color: '#33261a',
                  fontSize: '16px', lineHeight: 1.7,
                  outline: 'none',
                  minHeight: '148px',
                  transition: 'box-shadow 0.5s ease-out, border-color 0.2s',
                  boxShadow: searching
                    ? `0 0 0 2px ${accentColor}30`
                    : searchEmpty
                      ? `0 0 0 2px ${accentColor}30`
                      : '0 2px 12px rgba(0,0,0,0.15)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  overflowWrap: 'break-word',
                }}
              />
            </div>


            {/* @ mention dropdown — immediately below textarea */}
            {mentionActive && (
              <div className="pm-dropdown" style={{
                marginTop: '6px',
                background: '#faf8f4',
                border: '1px solid rgba(0,0,0,0.1)',
                borderRadius: '12px', overflow: 'hidden',
                boxShadow: '0 16px 48px rgba(58,42,26,0.18)',
              }}>
                {mentionResults.map(p => (
                  <button
                    key={p.id}
                    onMouseDown={e => { e.preventDefault(); insertMention(p.handle ?? '') }}
                    className="post-modal-row font-body"
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                      background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
                      borderBottom: '1px solid rgba(0,0,0,0.03)', padding: '9px 14px',
                    }}
                  >
                    {p.avatar_url ? (
                      <Image src={p.avatar_url} alt={p.name ?? ''} width={32} height={32}
                        style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                    ) : (
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                        background: 'rgba(0,0,0,0.08)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '12px', color: '#6b5d4f',
                      }}>
                        {p.name?.charAt(0).toUpperCase() ?? '?'}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ color: '#33261a', fontSize: '13px', fontWeight: 500, marginBottom: '1px' }}>
                        {p.name ?? p.handle}
                      </p>
                      {p.handle && (
                        <p style={{ color: '#6b5d4f', fontSize: '11px' }}>@{p.handle}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Auto-search dropdown — immediately below textarea */}
            {dropdownVisible && !manualMode && (notableItems.length > 0 || dropdownItems.length > 0) && !mentionActive && (
              <div className="pm-dropdown" style={{
                marginTop: '6px',
                background: '#faf8f4',
                border: '1px solid rgba(0,0,0,0.1)',
                borderRadius: '12px', overflow: 'hidden',
                boxShadow: '0 16px 48px rgba(58,42,26,0.18)',
              }}>
                {/* Dropdown header: podcast toggle + X dismiss */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderBottom: '1px solid rgba(0,0,0,0.04)',
                }}>
                  {category === 'podcasts' ? (
                    <div style={{ display: 'flex', gap: '5px' }}>
                      {(['show', 'episode'] as const).map(t => (
                        <button
                          key={t}
                          onClick={() => handlePodcastTypeToggle(t)}
                          className="font-body"
                          style={{
                            background: podcastSearchType === t ? '#e5a517' : 'transparent',
                            color: podcastSearchType === t ? '#ffffff' : '#6b5d4f',
                            border: `1px solid ${podcastSearchType === t ? '#e5a517' : 'rgba(0,0,0,0.1)'}`,
                            borderRadius: '12px',
                            padding: '3px 10px',
                            fontSize: '11px', fontWeight: podcastSearchType === t ? 600 : 400,
                            cursor: 'pointer',
                            transition: 'background 0.13s, color 0.13s, border-color 0.13s',
                          }}
                        >
                          {t === 'show' ? 'Shows' : 'Episodes'}
                        </button>
                      ))}
                    </div>
                  ) : <span />}
                  <button
                    onClick={() => { setDropdownVisible(false); setNotableItems([]); editorRef.current?.focus() }}
                    aria-label="Close suggestions"
                    style={{
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      color: '#6b5d4f', display: 'flex', padding: '3px',
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" width="13" height="13">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Notable items section */}
                {notableItems.length > 0 && (
                  <>
                    <div style={{ padding: '6px 14px 4px', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                      <span className="font-body" style={{
                        fontSize: '10px', color: '#9a8d7f',
                        letterSpacing: '0.07em', textTransform: 'uppercase', fontWeight: 500,
                      }}>
                        From Notable
                      </span>
                    </div>
                    {notableItems.map(item => (
                      <ResultRow key={item.id} item={item} category={category ?? ''} onSelect={handleConfirm} />
                    ))}
                  </>
                )}

                {/* Divider between sections */}
                {notableItems.length > 0 && dropdownItems.length > 0 && (
                  <div style={{ height: '1px', background: 'rgba(0,0,0,0.06)' }} />
                )}

                {/* External items */}
                {dropdownItems.map(item => (
                  <ResultRow key={item.id} item={item} category={category ?? ''} onSelect={handleConfirm} />
                ))}

                <p className="font-body" style={{
                  color: '#6b5d4f', fontSize: '12px', textAlign: 'center',
                  padding: '10px 14px',
                }}>
                  Not here? Paste a URL instead
                </p>
              </div>
            )}

            {/* Confirmed item — below textarea */}
            {confirmedItem && (
              <div className="pm-confirmed" style={{
                marginTop: '12px', borderRadius: '12px', overflow: 'hidden',
                background: '#faf8f4', position: 'relative',
                border: '1px solid rgba(0,0,0,0.08)',
              }}>
                <div style={{ position: 'relative', width: '100%', height: '200px', background: '#faf8f4' }}>
                  <RecommendationImage fill src={confirmedItem.image} category={category ?? ''} alt={confirmedItem.title} sizes="(max-width: 768px) 100vw, 600px" style={{ objectFit: 'contain' }} />
                </div>
                <div style={{ padding: '12px 14px 14px' }}>
                  <p className="font-display" style={{
                    color: 'var(--color-text)', fontSize: '15px', fontWeight: 700,
                    letterSpacing: '-0.02em', lineHeight: 1.35,
                  }}>
                    {confirmedItem.title}
                  </p>
                  {(confirmedItem.subtitle || confirmedItem.year) && (
                    <p className="font-body" style={{
                      color: 'var(--color-muted)', fontSize: '12px', marginTop: '3px',
                    }}>
                      {confirmedItem.subtitle ?? ''}
                      {confirmedItem.subtitle && confirmedItem.year ? ` · ${confirmedItem.year}` : confirmedItem.year ?? ''}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setConfirmedItem(null)}
                  aria-label="Remove"
                  style={{
                    position: 'absolute', top: '8px', right: '8px',
                    background: 'rgba(0,0,0,0.55)', border: 'none', cursor: 'pointer',
                    borderRadius: '50%', width: '26px', height: '26px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white', backdropFilter: 'blur(4px)',
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" width="12" height="12">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}

            {/* Uploaded photo — below textarea (when no confirmed item) */}
            {uploadedImage && !confirmedItem && (
              <div style={{
                marginTop: '12px', borderRadius: '12px', overflow: 'hidden',
                background: '#faf8f4', position: 'relative',
                border: '1px solid rgba(0,0,0,0.08)',
              }}>
                <div style={{ position: 'relative', width: '100%', height: '200px', background: '#faf8f4' }}>
                  <Image src={uploadedImage} alt="Photo" fill sizes="(max-width: 768px) 100vw, 600px" style={{ objectFit: 'contain' }} />
                </div>
                <button
                  onClick={() => setUploadedImage(null)}
                  aria-label="Remove photo"
                  style={{
                    position: 'absolute', top: '8px', right: '8px',
                    background: 'rgba(0,0,0,0.55)', border: 'none', cursor: 'pointer',
                    borderRadius: '50%', width: '26px', height: '26px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white',
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" width="12" height="12">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}

            {/* Manual search trigger + camera */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginTop: '8px', padding: '0 2px',
            }}>
              {category !== 'restaurants' ? (
                <button
                  onClick={openManualSearch}
                  className="font-body"
                  style={{
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: '#6b5d4f', fontSize: '12px', padding: '2px 0',
                    textDecoration: 'underline',
                    textUnderlineOffset: '3px',
                    textDecorationColor: 'rgba(122,114,96,0.4)',
                  }}
                >
                  Can&apos;t find it? Search manually
                </button>
              ) : (
                <span />
              )}

              <button
                onClick={() => fileInputRef.current?.click()}
                aria-label="Upload photo"
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: '#6b5d4f', padding: '4px',
                  display: 'flex', alignItems: 'center',
                  transition: 'color 0.15s',
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="17" height="17">
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />

            {/* Manual search dropdown */}
            {dropdownVisible && manualMode && (
              <div className="pm-dropdown" style={{
                marginTop: '6px',
                background: '#faf8f4',
                border: '1px solid rgba(0,0,0,0.1)',
                borderRadius: '12px', overflow: 'hidden',
                boxShadow: '0 16px 48px rgba(58,42,26,0.18)',
              }}>
                {/* Search input row */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 14px',
                  borderBottom: '1px solid rgba(0,0,0,0.06)',
                }}>
                  {manualSearching ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2" width="14" height="14"
                      style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }}>
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="#6b5d4f" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="14" height="14" style={{ flexShrink: 0 }}>
                      <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                    </svg>
                  )}
                  <input
                    autoFocus
                    value={manualQuery}
                    onChange={handleManualQueryChange}
                    placeholder={category ? `Search ${CATEGORY_CONFIG[category].label.toLowerCase()}…` : 'Search…'}
                    className="font-body"
                    style={{
                      flex: 1, background: 'transparent', border: 'none', outline: 'none',
                      color: 'var(--color-text)', fontSize: '14px',
                    }}
                  />
                  <button
                    onClick={closeManualSearch}
                    style={{
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      color: '#6b5d4f', display: 'flex', padding: '2px',
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" width="13" height="13">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Podcast type toggle — below search input */}
                {category === 'podcasts' && (
                  <div style={{
                    display: 'flex', gap: '5px', padding: '8px 14px',
                    borderBottom: '1px solid rgba(0,0,0,0.04)',
                  }}>
                    {(['show', 'episode'] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => handlePodcastTypeToggle(t)}
                        className="font-body"
                        style={{
                          background: podcastSearchType === t ? '#e5a517' : 'transparent',
                          color: podcastSearchType === t ? '#ffffff' : '#6b5d4f',
                          border: `1px solid ${podcastSearchType === t ? '#e5a517' : 'rgba(0,0,0,0.1)'}`,
                          borderRadius: '12px',
                          padding: '3px 10px',
                          fontSize: '11px', fontWeight: podcastSearchType === t ? 600 : 400,
                          cursor: 'pointer',
                          transition: 'background 0.13s, color 0.13s, border-color 0.13s',
                        }}
                      >
                        {t === 'show' ? 'Shows' : 'Episodes'}
                      </button>
                    ))}
                  </div>
                )}


                {/* Notable items section */}
                {notableItems.length > 0 && (
                  <>
                    <div style={{ padding: '6px 14px 4px', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                      <span className="font-body" style={{
                        fontSize: '10px', color: '#9a8d7f',
                        letterSpacing: '0.07em', textTransform: 'uppercase', fontWeight: 500,
                      }}>
                        From Notable
                      </span>
                    </div>
                    {notableItems.map(item => (
                      <ResultRow key={item.id} item={item} category={category ?? ''} onSelect={handleConfirm} />
                    ))}
                  </>
                )}

                {/* Divider */}
                {notableItems.length > 0 && dropdownItems.length > 0 && (
                  <div style={{ height: '1px', background: 'rgba(0,0,0,0.06)' }} />
                )}

                {/* External items */}
                {dropdownItems.length > 0 && dropdownItems.map(item => (
                  <ResultRow key={item.id} item={item} category={category ?? ''} onSelect={handleConfirm} />
                ))}

                {manualQuery.length > 0 && !manualSearching && dropdownItems.length === 0 && notableItems.length === 0 && (
                  <div style={{ padding: '18px 16px', textAlign: 'center' }}>
                    <p className="font-body" style={{ color: '#6b5d4f', fontSize: '12px' }}>No results found</p>
                  </div>
                )}

              </div>
            )}

            {/* Error */}
            {error && (
              <button
                onClick={() => setError(null)}
                className="font-body"
                style={{
                  marginTop: '12px', width: '100%',
                  background: 'rgba(212,99,107,0.12)',
                  border: '1px solid rgba(212,99,107,0.3)',
                  borderRadius: '10px', padding: '10px 14px',
                  color: '#e05555', fontSize: '13px', cursor: 'pointer', textAlign: 'left',
                }}
              >
                {error}
              </button>
            )}

          </div>
        </div>
      </div>
    </>
  )
}
