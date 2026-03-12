import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockPost, mockComment, mockCallLLM, mockGetLinkedInAccessToken, mockGetLinkedInPersonId, mockFetch } = vi.hoisted(() => ({
  mockPost: { findMany: vi.fn() },
  mockComment: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  mockCallLLM: vi.fn(),
  mockGetLinkedInAccessToken: vi.fn(),
  mockGetLinkedInPersonId: vi.fn(),
  mockFetch: vi.fn(),
}))

vi.mock('@leni/db', () => ({ db: { post: mockPost, comment: mockComment } }))
vi.mock('../lib/llm', () => ({ callLLM: mockCallLLM }))
vi.mock('../publishers/linkedin', () => ({
  getLinkedInAccessToken: mockGetLinkedInAccessToken,
  getLinkedInPersonId: mockGetLinkedInPersonId,
}))
vi.stubGlobal('fetch', mockFetch)

import { processComment, pollComments, replyToComment } from './comment-agent'

const sampleComment = {
  id: 'urn:li:comment:123',
  authorName: 'Jean Dupont',
  authorHeadline: 'CEO at Startup',
  text: 'Super article, merci pour le partage !',
}

describe('processComment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('parses valid LLM JSON response', async () => {
    mockCallLLM.mockResolvedValue(JSON.stringify({
      classification: 'prospect',
      isQuestion: false,
      isProspect: true,
      reply: 'Merci Jean ! On en parle en DM ?',
      shouldDM: true,
    }))

    const result = await processComment(sampleComment, 'Post content here', 'flipio')

    expect(result.classification).toBe('prospect')
    expect(result.isProspect).toBe(true)
    expect(result.reply).toBe('Merci Jean ! On en parle en DM ?')
  })

  it('returns fallback when LLM returns no JSON', async () => {
    mockCallLLM.mockResolvedValue('No JSON here, just text.')

    const result = await processComment(sampleComment, 'Post content', 'flipio')

    expect(result.classification).toBe('compliment')
    expect(result.isQuestion).toBe(false)
    expect(result.isProspect).toBe(false)
    expect(result.reply).toBeNull()
  })

  it('returns fallback on invalid JSON schema', async () => {
    mockCallLLM.mockResolvedValue('{"classification": "invalid_value", "isQuestion": "not_bool"}')

    const result = await processComment(sampleComment, 'Post content', 'flipio')

    expect(result.classification).toBe('compliment')
    expect(result.reply).toBeNull()
  })
})

describe('pollComments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetLinkedInAccessToken.mockResolvedValue('test-token')
  })

  it('returns zeros when no published posts', async () => {
    mockPost.findMany.mockResolvedValue([])

    const result = await pollComments()

    expect(result).toEqual({ scanned: 0, newComments: 0, drafted: 0 })
  })

  it('skips existing comments (deduplication)', async () => {
    mockPost.findMany.mockResolvedValue([{
      id: 'post-1',
      externalId: 'urn:li:share:456',
      contenu: 'Post content',
      persona: { slug: 'flipio' },
    }])
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        elements: [{
          '$URN': 'urn:li:comment:existing',
          message: { text: 'Already seen' },
        }],
      }),
    })
    mockComment.findUnique.mockResolvedValue({ id: 'existing-comment' })

    const result = await pollComments()

    expect(result.newComments).toBe(0)
    expect(mockCallLLM).not.toHaveBeenCalled()
  })
})

describe('replyToComment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetLinkedInAccessToken.mockResolvedValue('test-token')
    mockGetLinkedInPersonId.mockResolvedValue('person-123')
  })

  it('posts reply and updates status to replied', async () => {
    mockComment.findUnique.mockResolvedValue({
      id: 'comment-1',
      statut: 'approved',
      draftReply: 'Merci pour votre commentaire !',
      externalId: 'urn:li:comment:789',
      postId: 'post-1',
      post: { externalId: 'urn:li:share:456' },
    })
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) })

    const result = await replyToComment('comment-1')

    expect(result).toBe('comment-1')
    expect(mockComment.update).toHaveBeenCalledWith({
      where: { id: 'comment-1' },
      data: { statut: 'replied' },
    })
  })

  it('throws when comment not found', async () => {
    mockComment.findUnique.mockResolvedValue(null)
    await expect(replyToComment('missing')).rejects.toThrow('not found')
  })

  it('throws when comment not approved', async () => {
    mockComment.findUnique.mockResolvedValue({
      id: 'comment-1',
      statut: 'pending',
      draftReply: 'Reply text',
      post: { externalId: 'urn:li:share:456' },
    })
    await expect(replyToComment('comment-1')).rejects.toThrow('not approved')
  })

  it('throws when no draft reply', async () => {
    mockComment.findUnique.mockResolvedValue({
      id: 'comment-1',
      statut: 'approved',
      draftReply: null,
      post: { externalId: 'urn:li:share:456' },
    })
    await expect(replyToComment('comment-1')).rejects.toThrow('no draft reply')
  })
})
