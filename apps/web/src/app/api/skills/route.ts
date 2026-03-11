import { NextResponse } from 'next/server'
import { db } from '@leni/db'

export async function GET() {
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
