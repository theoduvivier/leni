import { NextRequest, NextResponse } from 'next/server'
import { db } from '@leni/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const statut = searchParams.get('statut')
    const persona = searchParams.get('persona')
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 50)

    const posts = await db.post.findMany({
      where: {
        ...(statut ? { statut } : {}),
        ...(persona ? { persona: { slug: persona } } : {}),
      },
      include: {
        persona: { select: { slug: true, nom: true } },
        _count: { select: { comments: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return NextResponse.json({ posts })
  } catch (error) {
    console.error('Posts error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
