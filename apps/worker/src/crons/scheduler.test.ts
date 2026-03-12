import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockPost, mockJob, mockEnqueueJob } = vi.hoisted(() => ({
  mockPost: { findMany: vi.fn() },
  mockJob: { findFirst: vi.fn() },
  mockEnqueueJob: vi.fn(),
}))

vi.mock('@leni/db', () => ({ db: { post: mockPost, job: mockJob }, Prisma: {} }))
vi.mock('../queues/job-runner', () => ({ enqueueJob: mockEnqueueJob }))

import { checkScheduledTasks, publishScheduledPosts } from './scheduler'

describe('publishScheduledPosts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('enqueues publish jobs for approved posts with past publishAt', async () => {
    const pastDate = new Date(Date.now() - 60000)
    mockPost.findMany.mockResolvedValue([
      { id: 'post-1', platform: 'linkedin', publishAt: pastDate, statut: 'approved' },
      { id: 'post-2', platform: 'instagram', publishAt: pastDate, statut: 'approved' },
    ])
    mockJob.findFirst.mockResolvedValue(null) // no existing jobs

    await publishScheduledPosts()

    expect(mockEnqueueJob).toHaveBeenCalledTimes(2)
    expect(mockEnqueueJob).toHaveBeenCalledWith('publish-linkedin', { postId: 'post-1' })
    expect(mockEnqueueJob).toHaveBeenCalledWith('publish-instagram', { postId: 'post-2' })
  })

  it('skips posts that already have a pending publish job', async () => {
    mockPost.findMany.mockResolvedValue([
      { id: 'post-1', platform: 'linkedin', publishAt: new Date(Date.now() - 60000), statut: 'approved' },
    ])
    mockJob.findFirst.mockResolvedValue({ id: 'existing-job', status: 'pending' })

    await publishScheduledPosts()

    expect(mockEnqueueJob).not.toHaveBeenCalled()
  })

  it('does nothing when no posts are ready', async () => {
    mockPost.findMany.mockResolvedValue([])

    await publishScheduledPosts()

    expect(mockEnqueueJob).not.toHaveBeenCalled()
  })
})

describe('checkScheduledTasks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPost.findMany.mockResolvedValue([])
  })

  it('calls publishScheduledPosts even when no cron tasks are registered', async () => {
    await checkScheduledTasks()
    // publishScheduledPosts queries approved posts
    expect(mockPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          statut: 'approved',
        }),
      })
    )
  })
})
