import { db } from '@leni/db'
import { processJobs } from './queues/job-runner'

const POLL_INTERVAL = 10_000 // 10 secondes

function log(level: string, message: string) {
  console.log(JSON.stringify({
    level,
    message,
    timestamp: new Date().toISOString(),
    service: 'worker',
  }))
}

async function main() {
  log('info', 'Leni worker starting...')

  await db.$connect()
  log('info', 'Database connected')

  // Poll jobs toutes les 10s
  setInterval(async () => {
    try {
      await processJobs()
    } catch (err) {
      log('error', err instanceof Error ? err.message : 'Job processing error')
    }
  }, POLL_INTERVAL)

  log('info', `Job runner started — polling every ${POLL_INTERVAL / 1000}s`)
}

main().catch((err) => {
  console.error(JSON.stringify({
    level: 'error',
    message: err instanceof Error ? err.message : 'Unknown error',
    timestamp: new Date().toISOString(),
    service: 'worker',
  }))
  process.exit(1)
})
