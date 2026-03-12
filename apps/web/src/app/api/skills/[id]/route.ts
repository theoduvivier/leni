import { NextResponse } from 'next/server'
import { db } from '@leni/db'

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
