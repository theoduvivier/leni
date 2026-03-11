import { NextResponse } from 'next/server'
import { db, Prisma } from '@leni/db'

export async function POST() {
  const job = await db.job.create({
    data: {
      type: 'comment-poll',
      data: {} as Prisma.InputJsonValue,
    },
  })

  return NextResponse.json({ jobId: job.id })
}
