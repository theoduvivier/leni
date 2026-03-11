import { NextRequest, NextResponse } from 'next/server'
import { db, Prisma } from '@leni/db'
import { z } from 'zod'

const CreateJobBody = z.object({
  type: z.string().min(1),
  data: z.record(z.unknown()).default({}),
})

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = CreateJobBody.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 })
  }

  const job = await db.job.create({
    data: {
      type: parsed.data.type,
      data: parsed.data.data as Prisma.InputJsonValue,
    },
  })

  return NextResponse.json({ jobId: job.id })
}
