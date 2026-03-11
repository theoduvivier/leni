import { NextRequest, NextResponse } from 'next/server'
import { db, Prisma } from '@leni/db'
import { z } from 'zod'

const UpdateContextBody = z.object({
  data: z.record(z.unknown()),
})

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const persona = await db.persona.findUnique({
    where: { slug },
    include: { contextLive: true },
  })

  if (!persona) {
    return NextResponse.json({ error: 'Persona not found' }, { status: 404 })
  }

  return NextResponse.json({
    persona: {
      id: persona.id,
      slug: persona.slug,
      nom: persona.nom,
      config: persona.config,
      regles: persona.regles,
      faq: persona.faq,
    },
    contextLive: persona.contextLive?.data ?? {},
  })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const body = await req.json()
  const parsed = UpdateContextBody.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 })
  }

  const persona = await db.persona.findUnique({ where: { slug } })
  if (!persona) {
    return NextResponse.json({ error: 'Persona not found' }, { status: 404 })
  }

  const contextLive = await db.contextLive.upsert({
    where: { personaId: persona.id },
    create: { personaId: persona.id, data: parsed.data.data as Prisma.InputJsonValue },
    update: { data: parsed.data.data as Prisma.InputJsonValue },
  })

  return NextResponse.json({ contextLive })
}
