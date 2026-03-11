import { db } from '@leni/db'
import { generatePost } from '../agents/content-agent'
import { publishToLinkedIn } from '../publishers/linkedin'

type JobHandler = (data: Record<string, unknown>) => Promise<unknown>

const handlers: Record<string, JobHandler> = {
  'content-generation': async (data) => {
    const postId = await generatePost(data as Parameters<typeof generatePost>[0])
    return { postId }
  },
  'publish-linkedin': async (data) => {
    const externalId = await publishToLinkedIn(data.postId as string)
    return { externalId }
  },
}

function log(level: string, message: string, extra?: Record<string, unknown>) {
  console.log(JSON.stringify({
    level,
    message,
    timestamp: new Date().toISOString(),
    service: 'job-runner',
    ...extra,
  }))
}

export async function processJobs() {
  const jobs = await db.job.findMany({
    where: {
      status: 'pending',
      runAt: { lte: new Date() },
    },
    orderBy: { createdAt: 'asc' },
    take: 5,
  })

  for (const job of jobs) {
    const handler = handlers[job.type]
    if (!handler) {
      await db.job.update({
        where: { id: job.id },
        data: { status: 'failed', error: `Unknown job type: ${job.type}` },
      })
      continue
    }

    await db.job.update({
      where: { id: job.id },
      data: { status: 'processing', attempts: { increment: 1 } },
    })

    try {
      const result = await handler(job.data as Record<string, unknown>)
      await db.job.update({
        where: { id: job.id },
        data: { status: 'completed', result: result as object },
      })
      log('info', `Job completed`, { jobId: job.id, type: job.type })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      const newStatus = job.attempts >= 2 ? 'failed' : 'pending'
      await db.job.update({
        where: { id: job.id },
        data: { status: newStatus, error: message },
      })
      log('error', `Job failed: ${message}`, { jobId: job.id, type: job.type })
    }
  }
}

export async function enqueueJob(type: string, data: Record<string, unknown>, runAt?: Date) {
  return db.job.create({
    data: { type, data, runAt: runAt ?? new Date() },
  })
}
