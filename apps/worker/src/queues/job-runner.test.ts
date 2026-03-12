import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockJob, mockGeneratePost, mockPublishToLinkedIn, mockPublishToInstagram, mockGenerateViral, mockPollComments, mockReplyToComment, mockRunAlgoWatch } = vi.hoisted(() => ({
  mockJob: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  mockGeneratePost: vi.fn(),
  mockPublishToLinkedIn: vi.fn(),
  mockPublishToInstagram: vi.fn(),
  mockGenerateViral: vi.fn(),
  mockPollComments: vi.fn(),
  mockReplyToComment: vi.fn(),
  mockRunAlgoWatch: vi.fn(),
}))

vi.mock('@leni/db', () => ({ db: { job: mockJob }, Prisma: {} }))
vi.mock('../agents/content-agent', () => ({ generatePost: mockGeneratePost }))
vi.mock('../publishers/linkedin', () => ({ publishToLinkedIn: mockPublishToLinkedIn }))
vi.mock('../publishers/instagram', () => ({ publishToInstagram: mockPublishToInstagram }))
vi.mock('../agents/viral-agent', () => ({ generateViral: mockGenerateViral }))
vi.mock('../agents/comment-agent', () => ({
  pollComments: mockPollComments,
  replyToComment: mockReplyToComment,
}))
vi.mock('../agents/algo-watcher', () => ({ runAlgoWatch: mockRunAlgoWatch }))

import { processJobs, enqueueJob } from './job-runner'

describe('processJobs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: atomic lock succeeds
    mockJob.updateMany.mockResolvedValue({ count: 1 })
  })

  it('does nothing when no pending jobs', async () => {
    mockJob.findMany.mockResolvedValue([])

    await processJobs()

    expect(mockJob.updateMany).not.toHaveBeenCalled()
  })

  it('processes a content-generation job successfully', async () => {
    mockJob.findMany.mockResolvedValue([{
      id: 'job-1',
      type: 'content-generation',
      data: { personaSlug: 'flipio', type: 'post_texte', platform: 'linkedin', brief: 'test brief' },
      attempts: 0,
    }])
    mockGeneratePost.mockResolvedValue('post-123')

    await processJobs()

    // Should claim with atomic lock
    expect(mockJob.updateMany).toHaveBeenCalledWith({
      where: { id: 'job-1', status: 'pending' },
      data: { status: 'processing', attempts: { increment: 1 } },
    })
    // Should mark as completed
    expect(mockJob.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: { status: 'completed', result: { postId: 'post-123' } },
    })
  })

  it('skips job if another worker claimed it', async () => {
    mockJob.findMany.mockResolvedValue([{
      id: 'job-race',
      type: 'content-generation',
      data: {},
      attempts: 0,
    }])
    mockJob.updateMany.mockResolvedValue({ count: 0 }) // another worker got it

    await processJobs()

    expect(mockGeneratePost).not.toHaveBeenCalled()
    expect(mockJob.update).not.toHaveBeenCalled()
  })

  it('marks unknown job type as failed', async () => {
    mockJob.findMany.mockResolvedValue([{
      id: 'job-2',
      type: 'unknown-type',
      data: {},
      attempts: 0,
    }])

    await processJobs()

    expect(mockJob.update).toHaveBeenCalledWith({
      where: { id: 'job-2' },
      data: { status: 'failed', error: 'Unknown job type: unknown-type' },
    })
  })

  it('retries job when handler throws and attempts < 2', async () => {
    mockJob.findMany.mockResolvedValue([{
      id: 'job-3',
      type: 'content-generation',
      data: {},
      attempts: 0,
    }])
    mockGeneratePost.mockRejectedValue(new Error('LLM timeout'))
    mockJob.findUnique.mockResolvedValue({ id: 'job-3', attempts: 1 })

    await processJobs()

    expect(mockJob.update).toHaveBeenCalledWith({
      where: { id: 'job-3' },
      data: { status: 'pending', error: 'LLM timeout' },
    })
  })

  it('marks job as failed when handler throws and attempts >= 2', async () => {
    mockJob.findMany.mockResolvedValue([{
      id: 'job-4',
      type: 'content-generation',
      data: {},
      attempts: 2,
    }])
    mockGeneratePost.mockRejectedValue(new Error('Persistent failure'))
    mockJob.findUnique.mockResolvedValue({ id: 'job-4', attempts: 2 })

    await processJobs()

    expect(mockJob.update).toHaveBeenCalledWith({
      where: { id: 'job-4' },
      data: { status: 'failed', error: 'Persistent failure' },
    })
  })
})

describe('enqueueJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a job with correct data', async () => {
    mockJob.create.mockResolvedValue({ id: 'job-new' })

    await enqueueJob('content-generation', { brief: 'test' })

    expect(mockJob.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'content-generation',
        data: { brief: 'test' },
      }),
    })
  })
})
