import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockVerifyPassword, mockSave } = vi.hoisted(() => ({
  mockVerifyPassword: vi.fn(),
  mockSave: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  verifyPassword: mockVerifyPassword,
  getSession: () => Promise.resolve({ isLoggedIn: false, save: mockSave }),
}))

import { POST } from './route'

function makeRequest(body: unknown, ip = '127.0.0.1'): Request {
  return new Request('http://localhost/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': ip,
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 on valid password', async () => {
    mockVerifyPassword.mockResolvedValue(true)

    const res = await POST(makeRequest({ password: 'correct' }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(mockSave).toHaveBeenCalled()
  })

  it('returns 401 on invalid password', async () => {
    mockVerifyPassword.mockResolvedValue(false)

    const res = await POST(makeRequest({ password: 'wrong' }))

    expect(res.status).toBe(401)
  })

  it('returns 400 when body is missing password', async () => {
    const res = await POST(makeRequest({}))

    expect(res.status).toBe(400)
  })

  it('returns 429 after too many attempts from same IP', async () => {
    mockVerifyPassword.mockResolvedValue(false)
    const ip = '10.0.0.99'

    // Make 6 attempts (limit is 5)
    for (let i = 0; i < 6; i++) {
      await POST(makeRequest({ password: 'wrong' }, ip))
    }

    const res = await POST(makeRequest({ password: 'wrong' }, ip))
    expect(res.status).toBe(429)
  })
})
