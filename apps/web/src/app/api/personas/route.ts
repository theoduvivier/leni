import { NextResponse } from 'next/server'
import { db } from '@leni/db'

export async function GET() {
  const personas = await db.persona.findMany({
    include: { contextLive: true },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json({ personas })
}
