import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSkillFindFirst, mockSkillFindMany } = vi.hoisted(() => ({
  mockSkillFindFirst: vi.fn(),
  mockSkillFindMany: vi.fn(),
}))

vi.mock('@leni/db', () => ({
  db: {
    skill: {
      findFirst: mockSkillFindFirst,
      findMany: mockSkillFindMany,
    },
  },
}))

import { GET } from './route'

function makeRequest(params?: Record<string, string>): Request {
  const url = new URL('http://localhost/api/skills')
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v)
    }
  }
  // NextRequest needs nextUrl, simulate by using standard Request
  // The route uses req.nextUrl.searchParams which works with NextRequest
  return new Request(url.toString())
}

describe('GET /api/skills', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns all active skills when no nom param', async () => {
    const skills = [
      { id: 's1', nom: 'linkedin_post_texte', version: '1.0' },
      { id: 's2', nom: 'instagram_caption', version: '1.0' },
    ]
    mockSkillFindMany.mockResolvedValue(skills)

    // Need to use NextRequest for nextUrl support
    const { NextRequest } = await import('next/server')
    const req = new NextRequest('http://localhost/api/skills')
    const res = await GET(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.skills).toEqual(skills)
  })

  it('returns single skill when nom param provided', async () => {
    const skill = { id: 's1', nom: 'linkedin_post_texte', contenu: 'Skill content' }
    mockSkillFindFirst.mockResolvedValue(skill)

    const { NextRequest } = await import('next/server')
    const req = new NextRequest('http://localhost/api/skills?nom=linkedin_post_texte')
    const res = await GET(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.skill).toEqual(skill)
  })

  it('returns 404 when skill nom not found', async () => {
    mockSkillFindFirst.mockResolvedValue(null)

    const { NextRequest } = await import('next/server')
    const req = new NextRequest('http://localhost/api/skills?nom=nonexistent')
    const res = await GET(req)

    expect(res.status).toBe(404)
  })
})
