import { NextRequest, NextResponse } from 'next/server'
import { db } from '@leni/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    // Default to current week (Monday to Sunday)
    const now = new Date()
    const dayOfWeek = now.getDay() // 0=Sun, 1=Mon, ...
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const defaultStart = new Date(now)
    defaultStart.setDate(now.getDate() + mondayOffset)
    defaultStart.setHours(0, 0, 0, 0)

    const startParam = searchParams.get('start')
    const start = startParam ? new Date(startParam) : defaultStart
    const end = new Date(start)
    end.setDate(start.getDate() + 7)

    // Fetch all posts that are scheduled or published in this week
    const posts = await db.post.findMany({
      where: {
        OR: [
          // Scheduled posts (approved with publishAt in range)
          {
            publishAt: { gte: start, lt: end },
            statut: { in: ['approved', 'published'] },
          },
          // Published posts in range
          {
            publishedAt: { gte: start, lt: end },
            statut: 'published',
          },
        ],
      },
      include: { persona: { select: { slug: true, nom: true } } },
      orderBy: { publishAt: 'asc' },
    })

    // Also fetch drafts not yet scheduled (for suggestion purposes)
    const drafts = await db.post.findMany({
      where: { statut: 'draft' },
      include: { persona: { select: { slug: true, nom: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    // Compute gap analysis
    const typeCount: Record<string, number> = {}
    const daySlots: Record<string, string[]> = {} // day ISO string → post types

    for (const post of posts) {
      const date = post.publishAt ?? post.publishedAt
      if (!date) continue
      const dayKey = date.toISOString().split('T')[0]
      if (!daySlots[dayKey]) daySlots[dayKey] = []
      daySlots[dayKey].push(post.type)
      typeCount[post.type] = (typeCount[post.type] ?? 0) + 1
    }

    // Find empty days and suggest content
    const suggestions: { date: string; suggestedType: string; reason: string }[] = []
    const allTypes = ['post_texte', 'comment_trigger', 'ghostwriter', 'post_image']

    for (let i = 0; i < 7; i++) {
      const day = new Date(start)
      day.setDate(start.getDate() + i)
      const dayKey = day.toISOString().split('T')[0]
      const dayPosts = daySlots[dayKey] ?? []

      if (dayPosts.length === 0) {
        // Find least used type for diversity
        const leastUsed = allTypes.reduce((min, t) =>
          (typeCount[t] ?? 0) < (typeCount[min] ?? 0) ? t : min
        , allTypes[0])
        suggestions.push({
          date: dayKey,
          suggestedType: leastUsed,
          reason: `Aucun post prévu — ${leastUsed} recommandé pour diversifier les formats`,
        })
      }
    }

    return NextResponse.json({
      posts,
      drafts,
      suggestions,
      weekStart: start.toISOString(),
      weekEnd: end.toISOString(),
      stats: {
        totalScheduled: posts.length,
        daysWithContent: Object.keys(daySlots).length,
        daysEmpty: 7 - Object.keys(daySlots).length,
        typeDistribution: typeCount,
      },
    })
  } catch (error) {
    console.error('Calendar error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
