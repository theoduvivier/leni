import { NextRequest, NextResponse } from 'next/server'
import { db } from '@leni/db'
import { z } from 'zod'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const skill = await db.skill.findUnique({ where: { id } })
  if (!skill) {
    return NextResponse.json({ error: 'Skill not found' }, { status: 404 })
  }
  return NextResponse.json({ skill })
}

const UpdateSkillBody = z.object({
  contenu: z.string().min(1),
})

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const body = await req.json()
  const parsed = UpdateSkillBody.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 })
  }

  const skill = await db.skill.findUnique({ where: { id } })
  if (!skill) {
    return NextResponse.json({ error: 'Skill not found' }, { status: 404 })
  }

  // Bump version
  const parts = skill.version.split('.')
  const minor = parseInt(parts[1] ?? '0', 10) + 1
  const newVersion = `${parts[0]}.${minor}`

  const updated = await db.skill.update({
    where: { id },
    data: {
      contenu: parsed.data.contenu,
      version: newVersion,
      updatedBy: 'dashboard',
    },
  })

  return NextResponse.json({ skill: updated })
}
