import { NextRequest, NextResponse } from 'next/server'
import { db, Prisma } from '@leni/db'
import { z } from 'zod'

const UpdatePersonaBody = z.object({
  config: z.record(z.unknown()).optional(),
  regles: z.string().optional(),
  faq: z.array(z.object({ question: z.string(), reponse: z.string() })).optional(),
})

export async function PUT(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const body = await req.json()
  const parsed = UpdatePersonaBody.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 })
  }

  const persona = await db.persona.findUnique({ where: { slug } })
  if (!persona) {
    return NextResponse.json({ error: 'Persona not found' }, { status: 404 })
  }

  const updateData: Record<string, unknown> = {}
  if (parsed.data.config !== undefined) updateData.config = parsed.data.config as Prisma.InputJsonValue
  if (parsed.data.regles !== undefined) updateData.regles = parsed.data.regles
  if (parsed.data.faq !== undefined) updateData.faq = parsed.data.faq as unknown as Prisma.InputJsonValue

  const updated = await db.persona.update({
    where: { slug },
    data: updateData,
  })

  return NextResponse.json({ persona: updated })
}
