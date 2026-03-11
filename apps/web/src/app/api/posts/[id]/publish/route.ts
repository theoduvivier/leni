import { NextRequest, NextResponse } from 'next/server'
import { db, Prisma } from '@leni/db'

/**
 * POST /api/posts/[id]/publish
 * Creates a publish job for the given post.
 * Automatically selects the right publisher based on post.platform.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const post = await db.post.findUnique({ where: { id } })
  if (!post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  if (post.statut !== 'approved') {
    return NextResponse.json({ error: 'Post must be approved before publishing' }, { status: 400 })
  }

  const jobType = post.platform === 'instagram' ? 'publish-instagram' : 'publish-linkedin'

  const job = await db.job.create({
    data: {
      type: jobType,
      data: { postId: id } as Prisma.InputJsonValue,
    },
  })

  return NextResponse.json({ jobId: job.id, platform: post.platform })
}
