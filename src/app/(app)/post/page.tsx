'use client'

import { useState, useRef, useEffect } from 'react'
import { RecommendationImage } from '@/app/components/RecommendationImage'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/app/components/Toast'

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = 'books' | 'movies' | 'music' | 'restaurants' | 'podcasts'
type ApiCategory = Exclude<Category, 'restaurants'>

interface SearchResult {
  id: string
  title: string
  subtitle?: string
  image: string | null
  year?: string
  category: Category
  isNotable?: boolean
  external_url?: string | null
}

interface SelectedItem {
  id: string
  title: string
  subtitle?: string
  image: string | null
  year?: string
  category: Category
  external_url?: string | null
  fromExternalApi: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: { id: Category; label: string; emoji: string; color: string }[] = [
  { id: 'books',       label: 'Books',       emoji: '📖', color: '#5271FF' },
  { id: 'movies',      label: 'Movies & TV', emoji: '🎬', color: '#dc4f5c' },
  { id: 'music',       label: 'Music',       emoji: '🎵', color: '#4aad4e' },
  { id: 'restaurants', label: 'Restaurants', emoji: '🍽️', color: '#9055d0' },
  { id: 'podcasts',    label: 'Podcasts',    emoji: '🎙️', color: '#e5a517' },
]

const CAT = Object.fromEntries(CATEGORIES.map(c => [c.id, c])) as Record<Category, typeof CATEGORIES[0]>
const API_CATEGORIES: ApiCategory[] = ['books', 'movies', 'music', 'podcasts']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function detectCategoryFromUrl(url: string): Category | null {
  if (/spotify\.com/.test(url)) return 'music'
  if (/apple\.com\/music|apple\.com\/album/.test(url)) return 'music'
  if (/podcasts\.apple\.com|apple\.com\/podcast/.test(url)) return 'podcasts'
  if (/imdb\.com|themoviedb\.org/.test(url)) return 'movies'
  if (/goodreads\.com|amazon\.com\/dp|books\.google\.com/.test(url)) return 'books'
  if (/yelp\.com|tripadvisor\.com|maps\.google\.com/.test(url)) return 'restaurants'
  return null
}

function looksLikeUrl(value: string): boolean {
  return /^https?:\/\//i.test(value) ||
    /(?:spotify|youtube|amazon|imdb|themoviedb|apple|goodreads|yelp|tripadvisor)\.com/.test(value)
}

function extractTitle(text: string): string {
  const firstLine = text.trim().split('\n')[0].trim()
  const raw = firstLine.slice(0, 100)
  if (raw.length < 100) return raw
  const lastSpace = raw.lastIndexOf(' ')
  return lastSpace > 20 ? raw.slice(0, lastSpace) : raw
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <div style={{ padding: '10px 16px 7px', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
      <span className="font-body" style={{
        color: 'var(--color-muted)', fontSize: '10px',
        letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600,
      }}>
        {label}
      </span>
    </div>
  )
}

function ResultRow({ result, onSelect, showBadge }: {
  result: SearchResult
  onSelect: (r: SearchResult) => void
  showBadge?: boolean
}) {
  return (
    <button
      onClick={() => onSelect(result)}
      className="res-row font-body"
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
        background: 'transparent', border: 'none',
        borderBottom: '1px solid rgba(0,0,0,0.03)',
        padding: '11px 16px', cursor: 'pointer', textAlign: 'left',
      }}
    >
      <RecommendationImage src={result.image} category={result.category} alt={result.title} width={52} height={52} style={{ borderRadius: '8px', boxShadow: '0 2px 8px rgba(58,42,26,0.1)' }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <p style={{
            color: 'var(--color-text)', fontSize: '14px', fontWeight: 500,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1,
          }}>
            {result.title}
          </p>
          {showBadge && (
            <span style={{
              background: (CAT[result.category]?.color ?? '#6b5d4f') + '28',
              color: CAT[result.category]?.color ?? '#6b5d4f',
              fontSize: '10px', fontWeight: 700,
              padding: '2px 7px', borderRadius: '6px', flexShrink: 0, letterSpacing: '0.04em',
            }}>
              Notable
            </span>
          )}
        </div>
        {(result.subtitle || result.year) && (
          <p style={{
            color: 'var(--color-muted)', fontSize: '12px',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px',
          }}>
            {result.subtitle ?? ''}{result.subtitle && result.year ? ` · ${result.year}` : (result.year ?? '')}
          </p>
        )}
      </div>
    </button>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PostPage() {
  const router = useRouter()
  const toast = useToast()
  const supabase = useRef(createClient())

  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [showResults, setShowResults] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null)
  const [urlLoading, setUrlLoading] = useState(false)
  const [description, setDescription] = useState('')
  const [posting, setPosting] = useState(false)
  const [postSuccess, setPostSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [catShake, setCatShake] = useState(false)
  const [showCatMsg, setShowCatMsg] = useState(false)

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textareaTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchIdRef = useRef(0)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const selectedCategoryRef = useRef<Category | null>(null)

  useEffect(() => {
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current)
      if (textareaTimer.current) clearTimeout(textareaTimer.current)
    }
  }, [])

  const accentColor = selectedCategory ? CAT[selectedCategory].color : '#33261a'
  const canPost = !!selectedCategory && (!!selectedItem || description.trim().length > 0)

  const setCat = (cat: Category | null) => {
    selectedCategoryRef.current = cat
    setSelectedCategory(cat)
  }

  const performSearch = async (query: string, cat: Category | null) => {
    if (!query.trim()) {
      setResults([])
      setShowResults(false)
      setSearchLoading(false)
      return
    }

    const searchId = ++searchIdRef.current
    setSearchLoading(true)
    setShowResults(true)

    const notablePromise: Promise<SearchResult[]> = Promise.resolve(
      supabase.current
        .from('recommendations')
        .select('id, category, title, image_url, external_url')
        .ilike('title', `%${query}%`)
    ).then(({ data }) => {
      if (!data) return []
      const rows = data as Record<string, unknown>[]
      const filtered = cat ? rows.filter(r => r.category === cat) : rows
      return filtered.slice(0, 5).map(r => ({
        id: r.id as string,
        title: r.title as string,
        image: (r.image_url ?? null) as string | null,
        category: r.category as Category,
        isNotable: true,
        external_url: (r.external_url ?? null) as string | null,
      } as SearchResult))
    }).catch(() => [])

    const catsToSearch: ApiCategory[] = cat
      ? (API_CATEGORIES.includes(cat as ApiCategory) ? [cat as ApiCategory] : [])
      : API_CATEGORIES

    const apiPromises = catsToSearch.map(apiCat =>
      fetch(`/api/search/${apiCat}?q=${encodeURIComponent(query)}`)
        .then(r => r.json())
        .then((data: { items: Omit<SearchResult, 'category'>[] }) =>
          (data.items ?? []).slice(0, 5).map(item => ({ ...item, category: apiCat } as SearchResult))
        )
        .catch(() => [] as SearchResult[])
    )

    const [notable, ...apiResults] = await Promise.all([notablePromise, ...apiPromises])

    if (searchId !== searchIdRef.current) return

    setResults([...notable, ...apiResults.flat()])
    setSearchLoading(false)
  }

  const extractUrl = async (url: string) => {
    setUrlLoading(true)
    setSearchQuery('')
    setShowResults(false)
    try {
      const res = await fetch('/api/search/extract-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json() as { title: string; description: string; image_url: string | null; url: string }
      const detectedCat = detectCategoryFromUrl(url)
      const currentCat = selectedCategoryRef.current
      if (detectedCat && !currentCat) setCat(detectedCat)
      setSelectedItem({
        id: crypto.randomUUID(),
        title: data.title || url,
        image: data.image_url,
        category: detectedCat ?? currentCat ?? 'books',
        external_url: url,
        fromExternalApi: true,
      })
    } catch {
      // silently ignore
    } finally {
      setUrlLoading(false)
    }
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setSearchQuery(val)
    if (searchTimer.current) clearTimeout(searchTimer.current)

    if (!val.trim()) {
      setResults([])
      setShowResults(false)
      return
    }

    if (looksLikeUrl(val)) {
      searchTimer.current = setTimeout(() => extractUrl(val), 500)
      return
    }

    searchTimer.current = setTimeout(() => performSearch(val, selectedCategoryRef.current), 400)
  }

  const handleCategoryToggle = (cat: Category) => {
    const next = selectedCategoryRef.current === cat ? null : cat
    setCat(next)
    if (searchQuery && !looksLikeUrl(searchQuery)) {
      if (searchTimer.current) clearTimeout(searchTimer.current)
      searchTimer.current = setTimeout(() => performSearch(searchQuery, next), 100)
    }
  }

  const handleSelectResult = (result: SearchResult) => {
    setSelectedItem({
      id: result.id,
      title: result.title,
      subtitle: result.subtitle,
      image: result.image,
      year: result.year,
      category: result.category,
      external_url: result.external_url ?? null,
      fromExternalApi: !result.isNotable,
    })
    setCat(result.category)
    setShowResults(false)
    setSearchQuery('')
  }

  const handleClearSelection = () => {
    setSelectedItem(null)
    setShowResults(false)
    setTimeout(() => searchInputRef.current?.focus(), 50)
  }

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setDescription(val)

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }

    if (!selectedItem) {
      if (textareaTimer.current) clearTimeout(textareaTimer.current)
      textareaTimer.current = setTimeout(() => {
        const match = val.match(/https?:\/\/[^\s]+/)
        if (match) {
          const foundUrl = match[0]
          const cleaned = val.replace(foundUrl, '').replace(/\s{2,}/g, ' ').trim()
          setDescription(cleaned)
          extractUrl(foundUrl)
        }
      }, 800)
    }
  }

  const handlePost = async () => {
    if (!selectedCategory) {
      setCatShake(true)
      setShowCatMsg(true)
      setTimeout(() => setCatShake(false), 600)
      setTimeout(() => setShowCatMsg(false), 2000)
      return
    }
    if (!canPost || posting || postSuccess) return

    setPosting(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.current.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const title = selectedItem?.title ?? extractTitle(description)

      const { error: insertError } = await supabase.current.from('recommendations').insert({
        user_id: user.id,
        category: selectedCategory,
        title,
        subtitle: selectedItem?.subtitle ?? null,
        image_url: selectedItem?.image ?? null,
        external_url: selectedItem?.external_url ?? null,
        external_id: selectedItem?.fromExternalApi ? selectedItem.id : null,
        year: selectedItem?.year ?? null,
        description: description.trim() || null,
      })

      if (insertError) throw insertError

      setPosting(false)
      setPostSuccess(true)
      toast('Recommendation posted!')
      setTimeout(() => router.push(`/${selectedCategory}`), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setPosting(false)
    }
  }

  // Derived display data
  const notableResults = results.filter(r => r.isNotable)
  const catsWithResults = (selectedCategory
    ? (API_CATEGORIES.includes(selectedCategory as ApiCategory) ? [selectedCategory as ApiCategory] : [])
    : API_CATEGORIES
  ).map(cat => ({
    cat,
    items: results.filter(r => r.category === cat && !r.isNotable),
  })).filter(g => g.items.length > 0)

  const hasAnyResults = results.length > 0

  return (
    <>
      <style>{`
        @keyframes spin     { to { transform: rotate(360deg); } }
        @keyframes shake    { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-5px)} 40%,80%{transform:translateX(5px)} }
        @keyframes fadeUp   { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeInOut { 0%{opacity:0;transform:translateY(3px)} 12%{opacity:1;transform:translateY(0)} 78%{opacity:1} 100%{opacity:0} }
        @keyframes popIn    { from{opacity:0;transform:scale(0.82)} to{opacity:1;transform:scale(1)} }
        .pill       { transition: transform 0.14s cubic-bezier(0.16,1,0.3,1), background 0.14s, color 0.14s, border-color 0.14s, box-shadow 0.14s; }
        .pill:active { transform: scale(0.94); }
        .res-row    { transition: background 0.08s; }
        .res-row:hover { background: rgba(0,0,0,0.03); }
        .preview-card { animation: fadeUp 0.24s cubic-bezier(0.16,1,0.3,1); }
        .results-panel { animation: fadeUp 0.18s cubic-bezier(0.16,1,0.3,1); }
        .cat-shake  { animation: shake 0.52s cubic-bezier(0.16,1,0.3,1); }
        .cat-msg    { animation: fadeInOut 2s ease forwards; }
        .posted-label { animation: popIn 0.38s cubic-bezier(0.16,1,0.3,1); }
        .post-btn   { transition: background 0.22s ease, color 0.22s ease, box-shadow 0.22s ease, transform 0.1s; }
        .post-btn:not(:disabled):active { transform: scale(0.983); }
        .change-btn { transition: background 0.1s; }
        .change-btn:hover { background: rgba(0,0,0,0.1) !important; }
      `}</style>

      {/* Full-screen overlay */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'var(--color-background)',
        display: 'flex', flexDirection: 'column',
      }}>

        {/* ── Header ─────────────────────────────────────────────── */}
        <div style={{
          flexShrink: 0, height: '56px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 20px',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
        }}>
          <button
            onClick={() => router.back()}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--color-text)', padding: '10px', margin: '-10px',
              display: 'flex', alignItems: 'center',
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>

          <button
            onClick={() => router.push('/lobby')}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--color-muted)', padding: '10px', margin: '-10px',
              display: 'flex', alignItems: 'center',
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Scrollable content ──────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          <div style={{
            maxWidth: '500px', width: '100%', margin: '0 auto',
            padding: '24px 20px 16px',
            display: 'flex', flexDirection: 'column', gap: '20px',
          }}>

            {/* Search / Preview */}
            <div style={{ position: 'relative' }}>
              {!selectedItem ? (
                <>
                  {/* Search input */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    background: 'var(--color-surface)',
                    borderRadius: '8px', padding: '0 14px',
                    border: '1px solid rgba(0,0,0,0.08)',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
                  }}>
                    {urlLoading || searchLoading ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2" width="17" height="17"
                        style={{ flexShrink: 0, animation: 'spin 0.8s linear infinite' }}>
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-muted)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="17" height="17"
                        style={{ flexShrink: 0, opacity: 0.6 }}>
                        <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                      </svg>
                    )}
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={urlLoading ? 'Extracting link preview…' : searchQuery}
                      onChange={handleSearchChange}
                      disabled={urlLoading}
                      placeholder={
                        selectedCategory === 'restaurants'
                          ? 'Restaurant name or paste a URL…'
                          : selectedCategory
                            ? `Search for a ${CAT[selectedCategory].label.toLowerCase().replace(/s$/, '')}…`
                            : 'Search for a book, movie, album, podcast…'
                      }
                      className="font-body"
                      style={{
                        flex: 1, background: 'transparent', border: 'none', outline: 'none',
                        color: urlLoading ? 'var(--color-muted)' : 'var(--color-text)',
                        fontSize: '15px', padding: '13px 0',
                      }}
                    />
                    {searchQuery && !urlLoading && (
                      <button
                        onClick={() => { setSearchQuery(''); setResults([]); setShowResults(false) }}
                        style={{
                          background: 'transparent', border: 'none', cursor: 'pointer',
                          color: 'var(--color-muted)', padding: '4px', display: 'flex', opacity: 0.7,
                        }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Hint text */}
                  {!searchQuery && (
                    <p className="font-body" style={{
                      color: 'var(--color-muted)', fontSize: '12px',
                      marginTop: '9px', textAlign: 'center', opacity: 0.5,
                    }}>
                      or paste a URL to extract details
                    </p>
                  )}
                  {selectedCategory === 'restaurants' && searchQuery && notableResults.length === 0 && !searchLoading && (
                    <p className="font-body" style={{
                      color: 'var(--color-muted)', fontSize: '13px',
                      marginTop: '7px', textAlign: 'center',
                    }}>
                      Type a name and add your thoughts below
                    </p>
                  )}

                  {/* Results dropdown */}
                  {showResults && (
                    <div className="results-panel" style={{
                      position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
                      background: '#faf8f4',
                      border: '1px solid rgba(0,0,0,0.08)',
                      borderRadius: '12px',
                      maxHeight: '280px', overflowY: 'auto',
                      zIndex: 30,
                      boxShadow: '0 24px 72px rgba(58,42,26,0.15), 0 0 0 1px rgba(0,0,0,0.03)',
                    }}>
                      {notableResults.length > 0 && (
                        <>
                          <SectionHeader label="On Notable" />
                          {notableResults.map(r => (
                            <ResultRow key={`n-${r.id}`} result={r} onSelect={handleSelectResult} showBadge />
                          ))}
                        </>
                      )}
                      {catsWithResults.map(({ cat, items }) => (
                        <div key={cat}>
                          {!selectedCategory && <SectionHeader label={`${CAT[cat].emoji} ${CAT[cat].label}`} />}
                          {items.map(r => (
                            <ResultRow key={`${cat}-${r.id}`} result={r} onSelect={handleSelectResult} />
                          ))}
                        </div>
                      ))}
                      {!hasAnyResults && !searchLoading && (
                        <div style={{ padding: '28px', textAlign: 'center' }}>
                          <p className="font-body" style={{ color: 'var(--color-muted)', fontSize: '14px' }}>
                            No results found
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                /* Preview card */
                <div className="preview-card" style={{
                  background: 'var(--color-surface)',
                  borderRadius: '12px', overflow: 'hidden',
                  border: '1px solid rgba(0,0,0,0.08)',
                  boxShadow: '0 8px 40px rgba(58,42,26,0.1), 0 0 0 1px rgba(0,0,0,0.03)',
                }}>
                  <div style={{ position: 'relative', width: '100%', height: '160px' }}>
                    <RecommendationImage fill src={selectedItem.image} category={selectedItem.category} alt={selectedItem.title} sizes="(max-width: 768px) 100vw, 600px" style={{ objectFit: 'cover' }} />
                  </div>
                  <div style={{
                    padding: '14px 16px 16px',
                    display: 'flex', alignItems: 'flex-start', gap: '12px',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="font-display" style={{
                        color: 'var(--color-text)', fontSize: '15px', fontWeight: 700,
                        letterSpacing: '-0.02em', lineHeight: 1.35,
                        marginBottom: selectedItem.subtitle ? '3px' : 0,
                      }}>
                        {selectedItem.title}
                      </p>
                      {selectedItem.subtitle && (
                        <p className="font-body" style={{ color: 'var(--color-muted)', fontSize: '13px' }}>
                          {selectedItem.subtitle}{selectedItem.year ? ` · ${selectedItem.year}` : ''}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={handleClearSelection}
                      className="change-btn font-body"
                      style={{
                        background: 'rgba(0,0,0,0.08)', border: 'none', borderRadius: '8px',
                        padding: '5px 10px', color: 'var(--color-muted)', fontSize: '12px',
                        cursor: 'pointer', flexShrink: 0,
                        display: 'flex', alignItems: 'center', gap: '4px',
                      }}
                    >
                      <span>✕</span><span>Change</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Textarea — the hero */}
            <div style={{ position: 'relative' }}>
              <textarea
                ref={textareaRef}
                value={description}
                onChange={handleTextareaChange}
                placeholder="What made it special?"
                rows={6}
                maxLength={2000}
                disabled={postSuccess}
                className="font-body"
                style={{
                  width: '100%',
                  background: 'var(--color-surface)',
                  border: '1px solid rgba(0,0,0,0.08)',
                  borderRadius: '12px',
                  padding: '18px 18px',
                  color: postSuccess ? accentColor : 'var(--color-text)',
                  fontSize: '16px',
                  outline: 'none', resize: 'none',
                  boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.75,
                  minHeight: '148px',
                  transition: 'color 0.55s ease, border-color 0.2s',
                  boxShadow: '0 2px 16px rgba(0,0,0,0.18)',
                }}
              />
              {postSuccess && (
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: '12px',
                  pointerEvents: 'none',
                }}>
                  <span className="posted-label font-body" style={{
                    color: accentColor,
                    fontSize: '17px', fontWeight: 600,
                    background: 'var(--color-background)',
                    padding: '8px 22px', borderRadius: '24px',
                    border: `1px solid ${accentColor}38`,
                    boxShadow: `0 4px 24px ${accentColor}28`,
                  }}>
                    Posted ✓
                  </span>
                </div>
              )}
            </div>
            {description.length > 0 && (
              <p className="font-body" style={{
                textAlign: 'right', fontSize: '11px', marginTop: '5px',
                color: description.length >= 1800 ? '#e05555' : '#6b5d4f',
              }}>
                {description.length} / 2000
              </p>
            )}

          </div>
        </div>

        {/* ── Bottom bar — pills + button, anchored above keyboard ──── */}
        <div style={{
          flexShrink: 0,
          background: 'var(--color-background)',
          borderTop: '1px solid rgba(0,0,0,0.06)',
          padding: '14px 20px 20px',
        }}>
          <div style={{ maxWidth: '500px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>

            {/* Category pills */}
            <div className={catShake ? 'cat-shake' : ''}>
              <div style={{
                display: 'flex', gap: '7px',
                justifyContent: 'center',
                overflowX: 'auto',
                scrollbarWidth: 'none',
                paddingBottom: '2px',
              }}>
                {CATEGORIES.map(({ id, label, emoji, color }) => {
                  const sel = selectedCategory === id
                  return (
                    <button
                      key={id}
                      onClick={() => handleCategoryToggle(id)}
                      className="pill font-body"
                      style={{
                        background: sel ? color : 'transparent',
                        color: sel ? 'white' : 'var(--color-muted)',
                        border: `1.5px solid ${sel ? color : 'rgba(0,0,0,0.1)'}`,
                        borderRadius: '24px',
                        padding: '6px 12px',
                        fontSize: '13px',
                        fontWeight: sel ? 600 : 400,
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '5px',
                        whiteSpace: 'nowrap', flexShrink: 0,
                        boxShadow: sel ? `0 2px 14px ${color}50` : 'none',
                      }}
                    >
                      <span>{emoji}</span>
                      <span>{label}</span>
                    </button>
                  )
                })}
              </div>
              {showCatMsg && (
                <p className="cat-msg font-body" style={{
                  color: '#e05555', fontSize: '12px',
                  textAlign: 'center', marginTop: '8px',
                }}>
                  Pick a category
                </p>
              )}
            </div>

            {/* Post button */}
            <button
              onClick={handlePost}
              disabled={posting || postSuccess}
              className="post-btn font-body"
              style={{
                width: '100%',
                background: postSuccess ? '#4aad4e' : canPost ? accentColor : 'rgba(0,0,0,0.04)',
                color: postSuccess ? 'white' : canPost ? 'white' : 'var(--color-muted)',
                border: 'none',
                borderRadius: '12px',
                padding: '15px',
                fontSize: '15px', fontWeight: 600,
                cursor: canPost && !posting && !postSuccess ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                boxShadow: canPost && !posting && !postSuccess ? `0 4px 24px ${accentColor}45` : 'none',
              }}
            >
              {postSuccess ? (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="17" height="17">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  Posted!
                </>
              ) : posting ? (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"
                    style={{ animation: 'spin 0.8s linear infinite' }}>
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                  Posting…
                </>
              ) : (
                'Post'
              )}
            </button>

          </div>
        </div>

        {/* Error toast */}
        {error && (
          <div
            onClick={() => setError(null)}
            style={{
              position: 'absolute', bottom: '200px', left: '50%', transform: 'translateX(-50%)',
              background: '#e05555', color: 'white', borderRadius: '10px',
              padding: '10px 16px', fontSize: '14px', maxWidth: '320px', width: '90%',
              textAlign: 'center', zIndex: 400, cursor: 'pointer',
              boxShadow: '0 8px 28px rgba(212,99,107,0.5)',
              animation: 'fadeUp 0.2s ease',
            }}
          >
            {error}
          </div>
        )}

      </div>
    </>
  )
}
