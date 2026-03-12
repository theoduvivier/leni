import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockJobCreate } = vi.hoisted(() => ({
  mockJobCreate: vi.fn(),
}))

vi.mock('@leni/db', () => ({
  db: {
    job: { create: mockJobCreate },
  },
}))

import { POST } from './route'

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/posts/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/posts/generate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockJobCreate.mockResolvedValue({ id: 'job-1' })
  })

  it('returns 200 with jobId on valid body', async () => {
    const res = await POST(makeRequest({
      personaSlug: 'flipio',
      type: 'post_texte',
      platform: 'linkedin',
      brief: 'Un post sur le SaaS immobilier',
    }))

    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.jobId).toBe('job-1')
    expect(data.status).toBe('queued')
  })

  it('returns 400 when brief is missing', async () => {
    const res = await POST(makeRequest({
      personaSlug: 'flipio',
      type: 'post_texte',
      platform: 'linkedin',
    }))

    expect(res.status).toBe(400)
  })

  it('returns 400 when brief is too short', async () => {
    const res = await POST(makeRequest({
      personaSlug: 'flipio',
      type: 'post_texte',
      platform: 'linkedin',
      brief: 'too short',
    }))

    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid persona slug', async () => {
    const res = await POST(makeRequest({
      personaSlug: 'invalid',
      type: 'post_texte',
      platform: 'linkedin',
      brief: 'A valid brief that is long enough',
    }))

    expect(res.status).toBe(400)
  })
})
