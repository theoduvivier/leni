import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@leni/db'

const SavePreferenceBody = z.object({
  pexelsId: z.number(),
  url: z.string().url(),
  thumbUrl: z.string().url(),
  photographer: z.string(),
  query: z.string(),
  selected: z.boolean(),
  tags: z.array(z.string()).default([]),
  width: z.number(),
  height: z.number(),
})

const BatchPreferenceBody = z.object({
  selectedId: z.string(),
  images: z.array(z.object({
    pexelsId: z.number(),
    url: z.string().url(),
    thumbUrl: z.string().url(),
    photographer: z.string(),
    query: z.string(),
    tags: z.array(z.string()).default([]),
    width: z.number(),
    height: z.number(),
  })),
})

// POST — batch save: one selected, rest rejected
export async function POST(req: NextRequest) {
  const body = await req.json()

  // Support batch mode: save all images as preferences, mark one as selected
  const batchParsed = BatchPreferenceBody.safeParse(body)
  if (batchParsed.success) {
    const { selectedId, images } = batchParsed.data

    const records = images.map((img) => ({
      pexelsId: img.pexelsId,
      url: img.url,
      thumbUrl: img.thumbUrl,
      photographer: img.photographer,
      query: img.query,
      selected: img.pexelsId.toString() === selectedId || `pexels-${img.pexelsId}` === selectedId || `unsplash-${img.pexelsId}` === selectedId,
      tags: img.tags,
      width: img.width,
      height: img.height,
    }))

    await db.imagePreference.createMany({ data: records })

    return NextResponse.json({ saved: records.length })
  }

  // Single preference mode
  const parsed = SavePreferenceBody.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 })
  }

  const pref = await db.imagePreference.create({ data: parsed.data })
  return NextResponse.json({ preference: pref })
}

// GET — fetch preference stats (top tags, selection history)
export async function GET() {
  const selected = await db.imagePreference.findMany({
    where: { selected: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  const tagCounts: Record<string, number> = {}
  for (const pref of selected) {
    const tags = pref.tags as string[]
    for (const tag of tags) {
      tagCounts[tag] = (tagCounts[tag] ?? 0) + 1
    }
  }

  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag, count]) => ({ tag, count }))

  return NextResponse.json({
    totalSelections: selected.length,
    topTags,
    recentSelections: selected.slice(0, 5).map((s) => ({
      thumbUrl: s.thumbUrl,
      query: s.query,
      tags: s.tags,
    })),
  })
}
