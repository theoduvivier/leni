import { db, Prisma } from '@leni/db'
import { enqueueJob } from '../queues/job-runner'

interface CronTask {
  name: string
  jobType: string
  data: Record<string, unknown>
  /** Check if this task should run now */
  shouldRun: (now: Date) => boolean
}

function log(level: string, message: string, extra?: Record<string, unknown>) {
  console.log(JSON.stringify({
    level,
    message,
    timestamp: new Date().toISOString(),
    service: 'scheduler',
    ...extra,
  }))
}

const tasks: CronTask[] = []

/** Track which tasks already ran this hour to avoid duplicates */
const lastRun = new Map<string, string>()

function getRunKey(name: string, now: Date): string {
  return `${name}-${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}`
}

/** Auto-publish approved posts whose publishAt time has passed */
export async function publishScheduledPosts() {
  const now = new Date()

  const readyPosts = await db.post.findMany({
    where: {
      statut: 'approved',
      publishAt: { lte: now },
    },
    take: 10,
  })

  for (const post of readyPosts) {
    const jobType = post.platform === 'instagram' ? 'publish-instagram' : 'publish-linkedin'

    // Check there's no existing pending/processing job for this post
    const existingJob = await db.job.findFirst({
      where: {
        type: jobType,
        status: { in: ['pending', 'processing'] },
        data: { path: ['postId'], equals: post.id },
      },
    })

    if (existingJob) continue

    try {
      await enqueueJob(jobType, { postId: post.id })
      log('info', `Auto-publish enqueued for post ${post.id}`, {
        platform: post.platform,
        publishAt: post.publishAt?.toISOString(),
      })
    } catch (err) {
      log('error', `Failed to enqueue auto-publish for post ${post.id}`, {
        error: err instanceof Error ? err.message : 'unknown',
      })
    }
  }
}

/** Check and enqueue scheduled tasks — called every minute */
export async function checkScheduledTasks() {
  const now = new Date()

  // Auto-publish scheduled posts
  try {
    await publishScheduledPosts()
  } catch (err) {
    log('error', `publishScheduledPosts error: ${err instanceof Error ? err.message : 'unknown'}`)
  }

  for (const task of tasks) {
    if (!task.shouldRun(now)) continue

    const key = getRunKey(task.name, now)
    if (lastRun.get(task.name) === key) continue

    lastRun.set(task.name, key)

    try {
      await enqueueJob(task.jobType, task.data)
      log('info', `Scheduled task enqueued: ${task.name}`, { jobType: task.jobType })
    } catch (err) {
      log('error', `Failed to enqueue task: ${task.name}`, {
        error: err instanceof Error ? err.message : 'unknown',
      })
    }
  }
}

/** Start the cron checker — runs every 60 seconds */
export function startScheduler() {
  log('info', 'Cron scheduler started')

  // Log next scheduled tasks
  for (const task of tasks) {
    log('info', `Registered cron: ${task.name} → job: ${task.jobType}`)
  }

  setInterval(async () => {
    try {
      await checkScheduledTasks()
    } catch (err) {
      log('error', `Scheduler error: ${err instanceof Error ? err.message : 'unknown'}`)
    }
  }, 60_000)
}
