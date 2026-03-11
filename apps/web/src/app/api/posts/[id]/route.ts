import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@leni/db'

const UpdateBody = z.object({
  statut: z.enum(['draft', 'approved', 'published', 'archived']).optional(),
  contenu: z.string().min(1).optional(),
  publishAt: z.string().datetime().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'Au moins un champ à modifier',
})

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const post = await db.post.findUnique({
      where: { id },
      include: { persona: { select: { slug: true, nom: true } } },
    })

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    return NextResponse.json({ post })
  } catch (error) {
    console.error('Post GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const data = UpdateBody.parse(body)

    const post = await db.post.update({
      where: { id },
      data: {
        ...(data.statut ? { statut: data.statut } : {}),
        ...(data.contenu ? { contenu: data.contenu } : {}),
        ...(data.publishAt ? { publishAt: new Date(data.publishAt) } : {}),
      },
    })

    return NextResponse.json({ post })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('Post PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
