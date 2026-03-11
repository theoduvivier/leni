import { NextResponse } from 'next/server'
import { db } from '@leni/db'

export async function GET() {
  try {
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const [postsPublished, postsPending] = await Promise.all([
      db.post.count({
        where: { statut: 'published', publishedAt: { gte: weekAgo } },
      }),
      db.post.count({
        where: { statut: { in: ['draft', 'approved'] } },
      }),
    ])

    return NextResponse.json({
      postsPublished,
      postsPending,
    })
  } catch (error) {
    console.error('Stats error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
