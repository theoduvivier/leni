import { NextRequest, NextResponse } from 'next/server'
import { db } from '@leni/db'

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

async function searchPexels(query: string, perPage: number): Promise<ImageResult[]> {
  const apiKey = process.env.PEXELS_API_KEY
  if (!apiKey) return []

  const res = await fetch(
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=landscape`,
    { headers: { Authorization: apiKey } }
  )
  if (!res.ok) return []

  const data = await res.json()
  return (data.photos ?? []).map((p: Record<string, unknown>) => ({
    id: `pexels-${p.id}`,
    source: 'pexels' as const,
    url: (p.src as Record<string, string>).large,
    thumbUrl: (p.src as Record<string, string>).medium,
    fullUrl: (p.src as Record<string, string>).original,
    photographer: p.photographer as string,
    photographerUrl: p.photographer_url as string,
    width: p.width as number,
    height: p.height as number,
    alt: (p.alt as string) || query,
  }))
}

async function searchUnsplash(query: string, perPage: number): Promise<ImageResult[]> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY
  if (!accessKey) return []

  const res = await fetch(
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=landscape`,
    { headers: { Authorization: `Client-ID ${accessKey}` } }
  )
  if (!res.ok) return []

  const data = await res.json()
  return (data.results ?? []).map((p: Record<string, unknown>) => ({
    id: `unsplash-${p.id}`,
    source: 'unsplash' as const,
    url: (p.urls as Record<string, string>).regular,
    thumbUrl: (p.urls as Record<string, string>).small,
    fullUrl: (p.urls as Record<string, string>).full,
    photographer: (p.user as Record<string, string>).name,
    photographerUrl: (p.user as Record<string, unknown>).links
      ? ((p.user as Record<string, unknown>).links as Record<string, string>).html
      : '',
    width: p.width as number,
    height: p.height as number,
    alt: (p.alt_description as string) || query,
  }))
}

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q')
  if (!query) {
    return NextResponse.json({ error: 'Missing query parameter' }, { status: 400 })
  }

  // Load user preferences to build smarter queries (non-blocking if table doesn't exist yet)
  let topTags: string[] = []
  try {
    const preferences = await db.imagePreference.findMany({
      where: { selected: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    const tagCounts: Record<string, number> = {}
    for (const pref of preferences) {
      const tags = pref.tags as string[]
      for (const tag of tags) {
        tagCounts[tag] = (tagCounts[tag] ?? 0) + 1
      }
    }

    topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([tag]) => tag)
  } catch {
    // Table may not exist yet — proceed without preferences
  }

  const enrichedQuery = topTags.length > 0
    ? `${query} ${topTags.join(' ')}`
    : query

  // Search both sources in parallel
  const [pexelsResults, unsplashResults] = await Promise.all([
    searchPexels(enrichedQuery, 12),
    searchUnsplash(enrichedQuery, 12),
  ])

  // Interleave results: alternate sources for variety
  const combined: ImageResult[] = []
  const maxLen = Math.max(pexelsResults.length, unsplashResults.length)
  for (let i = 0; i < maxLen; i++) {
    if (i < unsplashResults.length) combined.push(unsplashResults[i])
    if (i < pexelsResults.length) combined.push(pexelsResults[i])
  }

  // Limit to 20 results
  const results = combined.slice(0, 20)

  return NextResponse.json({
    results,
    query: enrichedQuery,
    preferredTags: topTags,
  })
}
