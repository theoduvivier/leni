import { NextRequest, NextResponse } from 'next/server'
import { db } from '@leni/db'
import { z } from 'zod'

const PatchBody = z.object({
  statut: z.enum(['pending', 'approved', 'replied', 'ignored']).optional(),
  draftReply: z.string().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const body = await req.json()
  const parsed = PatchBody.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 })
  }

  const comment = await db.comment.update({
    where: { id },
    data: parsed.data,
  })

  return NextResponse.json({ comment })
}
