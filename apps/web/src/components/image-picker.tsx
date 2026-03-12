'use client'

import { useState, useCallback } from 'react'
import { Search, Loader2, Check, Camera, Sparkles } from 'lucide-react'

interface ImageResult {
  id: string
  source: 'pexels' | 'unsplash'
  url: string
  thumbUrl: string
  fullUrl: string
  photographer: string
  photographerUrl: string
  width: number
  height: number
  alt: string
}

interface ImagePickerProps {
  onSelect: (image: ImageResult) => void
  defaultQuery?: string
}

const SUGGESTED_QUERIES = [
  'luxury apartment interior',
  'modern real estate',
  'paris apartment renovation',
  'building facade architecture',
  'real estate investment',
  'home renovation before after',
  'minimalist interior design',
  'coworking space modern',
]

export function ImagePicker({ onSelect, defaultQuery = '' }: ImagePickerProps) {
  const [query, setQuery] = useState(defaultQuery)
  const [results, setResults] = useState<ImageResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [preferredTags, setPreferredTags] = useState<string[]>([])

  const search = useCallback(async (q: string) => {
    if (!q.trim()) return
    setLoading(true)
    setSelectedId(null)
    try {
      const res = await fetch(`/api/images/search?q=${encodeURIComponent(q)}`)
      if (res.ok) {
        const data = await res.json()
        setResults(data.results ?? [])
        setPreferredTags(data.preferredTags ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    search(query)
  }

  async function confirmSelection() {
    const selected = results.find((r) => r.id === selectedId)
    if (!selected) return

    setConfirming(true)
    try {
      // Save all shown images as preferences (selected + rejected)
      await fetch('/api/images/preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedId: selected.id,
          images: results.map((r) => ({
            pexelsId: parseInt(r.id.replace(/^(pexels|unsplash)-/, ''), 10) || 0,
            url: r.url,
            thumbUrl: r.thumbUrl,
            photographer: r.photographer,
            query: query,
            tags: extractTags(r),
            width: r.width,
            height: r.height,
          })),
        }),
      })

      onSelect(selected)
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher des images..."
            className="w-full rounded-xl bg-white/[0.06] border border-white/[0.1] pl-10 pr-4 py-2.5 text-[13px] text-white placeholder:text-white/20 focus:outline-none focus:border-accent-blue/40 transition-all"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="rounded-xl bg-accent-blue/10 border border-accent-blue/20 px-5 py-2.5 text-[12px] font-bold text-accent-blue hover:bg-accent-blue/15 transition-all disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Chercher'}
        </button>
      </form>

      {/* Preferred tags hint */}
      {preferredTags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Sparkles className="h-3 w-3 text-accent-teal" />
          <span className="text-[10px] text-white/25">Tes goûts :</span>
          {preferredTags.map((tag) => (
            <span key={tag} className="rounded-full bg-accent-teal/10 px-2 py-0.5 text-[10px] font-bold text-accent-teal">{tag}</span>
          ))}
        </div>
      )}

      {/* Suggested queries */}
      {results.length === 0 && !loading && (
        <div className="space-y-3">
          <p className="text-[11px] text-white/25 uppercase font-bold tracking-wider">Suggestions</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_QUERIES.map((q) => (
              <button
                key={q}
                onClick={() => { setQuery(q); search(q) }}
                className="rounded-full bg-white/[0.04] border border-white/[0.06] px-3 py-1.5 text-[11px] text-white/40 hover:text-white/60 hover:border-white/[0.1] transition-all"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 text-white/30 animate-spin" />
        </div>
      )}

      {/* Image grid */}
      {results.length > 0 && !loading && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {results.map((img) => {
              const isSelected = selectedId === img.id
              return (
                <button
                  key={img.id}
                  onClick={() => setSelectedId(isSelected ? null : img.id)}
                  className={`group relative rounded-xl overflow-hidden aspect-[4/3] transition-all ${
                    isSelected
                      ? 'ring-2 ring-accent-blue shadow-lg shadow-accent-blue/20 scale-[1.02]'
                      : 'hover:ring-1 hover:ring-white/20'
                  }`}
                >
                  <img
                    src={img.thumbUrl}
                    alt={img.alt}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  {/* Overlay */}
                  <div className={`absolute inset-0 transition-all ${
                    isSelected
                      ? 'bg-accent-blue/20'
                      : 'bg-black/0 group-hover:bg-black/20'
                  }`} />
                  {/* Selected check */}
                  {isSelected && (
                    <div className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-accent-blue text-white shadow-lg">
                      <Check className="h-3.5 w-3.5" />
                    </div>
                  )}
                  {/* Source badge */}
                  <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-md bg-black/50 backdrop-blur-sm px-1.5 py-0.5">
                    <Camera className="h-2.5 w-2.5 text-white/60" />
                    <span className="text-[8px] text-white/60 font-medium">{img.source === 'unsplash' ? 'Unsplash' : 'Pexels'}</span>
                  </div>
                  {/* Photographer */}
                  <div className="absolute bottom-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="rounded-md bg-black/50 backdrop-blur-sm px-1.5 py-0.5 text-[8px] text-white/60">{img.photographer}</span>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Confirm selection */}
          {selectedId && (
            <div className="flex items-center justify-between glass rounded-xl px-4 py-3 animate-fade-up">
              <div className="flex items-center gap-3">
                <img
                  src={results.find((r) => r.id === selectedId)?.thumbUrl}
                  alt=""
                  className="h-10 w-14 rounded-lg object-cover"
                />
                <div>
                  <p className="text-[12px] font-bold text-white/70">Image sélectionnée</p>
                  <p className="text-[10px] text-white/30">{results.find((r) => r.id === selectedId)?.photographer}</p>
                </div>
              </div>
              <button
                onClick={confirmSelection}
                disabled={confirming}
                className="flex items-center gap-1.5 rounded-xl bg-accent-blue px-5 py-2.5 text-[12px] font-bold text-white transition-all hover:brightness-110 disabled:opacity-50"
              >
                {confirming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Utiliser cette image
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function extractTags(img: ImageResult): string[] {
  const tags: string[] = []
  const words = img.alt.toLowerCase().split(/\s+/)
  const relevant = ['luxury', 'modern', 'interior', 'apartment', 'house', 'building', 'architecture',
    'renovation', 'design', 'minimal', 'classic', 'paris', 'urban', 'bright', 'dark', 'wood',
    'marble', 'concrete', 'garden', 'terrace', 'kitchen', 'bedroom', 'living', 'bathroom',
    'facade', 'real estate', 'property', 'investment', 'cozy', 'elegant', 'spacious']
  for (const word of words) {
    if (relevant.includes(word) && !tags.includes(word)) {
      tags.push(word)
    }
  }
  if (img.width > img.height * 1.5) tags.push('landscape')
  if (img.height > img.width * 1.2) tags.push('portrait')
  return tags
}
