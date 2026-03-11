import { NextResponse } from 'next/server'
import { db } from '@leni/db'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const job = await db.job.findUnique({ where: { id } })

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    return NextResponse.json({
      id: job.id,
      type: job.type,
      status: job.status,
      result: job.result,
      error: job.error,
      createdAt: job.createdAt,
    })
  } catch (error) {
    console.error('Job error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
