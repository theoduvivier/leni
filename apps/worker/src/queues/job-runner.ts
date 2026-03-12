import { db, Prisma } from '@leni/db'
import { generatePost } from '../agents/content-agent'
import { publishToLinkedIn } from '../publishers/linkedin'
import { publishToInstagram } from '../publishers/instagram'
import { generateViral } from '../agents/viral-agent'
import { pollComments, replyToComment } from '../agents/comment-agent'
import { runAlgoWatch } from '../agents/algo-watcher'

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
  'publish-instagram': async (data) => {
    const externalId = await publishToInstagram(data.postId as string)
    return { externalId }
  },
  'viral-generation': async (data) => {
    const postIds = await generateViral(data as Parameters<typeof generateViral>[0])
    return { postIds }
  },
  'comment-poll': async () => {
    const result = await pollComments()
    return result
  },
  'comment-reply': async (data) => {
    const commentId = await replyToComment(data.commentId as string)
    return { commentId }
  },
  'algo-watch': async () => {
    const result = await runAlgoWatch()
    return result
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

    // Atomic lock: only claim the job if it's still pending (prevents duplicate processing)
    const claimed = await db.job.updateMany({
      where: { id: job.id, status: 'pending' },
      data: { status: 'processing', attempts: { increment: 1 } },
    })
    if (claimed.count === 0) continue // another worker already claimed it

    try {
      const result = await handler(job.data as Record<string, unknown>)
      await db.job.update({
        where: { id: job.id },
        data: { status: 'completed', result: result as object },
      })
      log('info', `Job completed`, { jobId: job.id, type: job.type })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      const currentJob = await db.job.findUnique({ where: { id: job.id } })
      const newStatus = (currentJob?.attempts ?? 1) >= 2 ? 'failed' : 'pending'
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
    data: { type, data: data as Prisma.InputJsonValue, runAt: runAt ?? new Date() },
  })
}
