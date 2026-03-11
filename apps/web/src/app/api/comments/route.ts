import { NextRequest, NextResponse } from 'next/server'
import { db } from '@leni/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const statut = searchParams.get('statut')
  const postId = searchParams.get('postId')
  const isQuestion = searchParams.get('isQuestion')
  const isProspect = searchParams.get('isProspect')
  const limit = parseInt(searchParams.get('limit') ?? '50', 10)

  const where: Record<string, unknown> = {}
  if (statut) where.statut = statut
  if (postId) where.postId = postId
  if (isQuestion === 'true') where.isQuestion = true
  if (isProspect === 'true') where.isProspect = true

  const comments = await db.comment.findMany({
    where,
    include: {
      post: {
        select: { id: true, type: true, contenu: true, persona: { select: { slug: true, nom: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 100),
  })

  const counts = await db.comment.groupBy({
    by: ['statut'],
    _count: true,
  })

  const countMap: Record<string, number> = {}
  let total = 0
  for (const c of counts) {
    countMap[c.statut] = c._count
    total += c._count
  }

  const pending = countMap['pending'] ?? 0
  const questions = await db.comment.count({ where: { isQuestion: true, statut: 'pending' } })
  const prospects = await db.comment.count({ where: { isProspect: true, statut: 'pending' } })

  return NextResponse.json({
    comments,
    counts: { total, pending, questions, prospects, ...countMap },
  })
}
