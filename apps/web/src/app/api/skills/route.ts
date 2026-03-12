import { NextRequest, NextResponse } from 'next/server'
import { db } from '@leni/db'

export async function GET(req: NextRequest) {
  const nom = req.nextUrl.searchParams.get('nom')

  if (nom) {
    const skill = await db.skill.findFirst({
      where: { nom, actif: true },
    })
    if (!skill) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 })
    }
    return NextResponse.json({ skill })
  }

  const skills = await db.skill.findMany({
    where: { actif: true },
    orderBy: { nom: 'asc' },
    select: {
      id: true,
      nom: true,
      version: true,
      plateforme: true,
      actif: true,
      updatedAt: true,
      updatedBy: true,
    },
  })

  return NextResponse.json({ skills })
}
