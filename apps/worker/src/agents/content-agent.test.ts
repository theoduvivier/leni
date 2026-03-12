import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockPost, mockMedia, mockCallLLM } = vi.hoisted(() => ({
  mockPost: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
  mockMedia: { updateMany: vi.fn() },
  mockCallLLM: vi.fn(),
}))

vi.mock('@leni/db', () => ({ db: { post: mockPost, media: mockMedia } }))
vi.mock('../lib/llm', () => ({ callLLM: mockCallLLM }))

import { generatePost } from './content-agent'

describe('generatePost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCallLLM.mockResolvedValue('Generated LinkedIn post about real estate.')
    mockPost.create.mockResolvedValue({ id: 'post-1' })
  })

  it('creates a draft post on happy path (post_texte)', async () => {
    const result = await generatePost({
      personaSlug: 'flipio',
      type: 'post_texte',
      platform: 'linkedin',
      brief: 'Write about SaaS for real estate',
    })

    expect(result).toBe('post-1')
    expect(mockPost.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'post_texte',
        module: 'M01',
        statut: 'draft',
        platform: 'linkedin',
        contenu: 'Generated LinkedIn post about real estate.',
      }),
    })
  })

  it('uses M03 module and 2048 tokens for deal_case_study', async () => {
    await generatePost({
      personaSlug: 'mdb',
      type: 'deal_case_study',
      platform: 'linkedin',
      brief: 'Opération de division à Paris 11',
      dealCity: 'Paris 11',
      dealStrategy: 'Division',
      dealMetric: '+150k€ de plus-value',
    })

    expect(mockCallLLM).toHaveBeenCalledWith(
      'mdb',
      'deal_case_study',
      expect.stringContaining('Ville : Paris 11'),
      expect.objectContaining({ maxTokens: 2048 })
    )
    expect(mockPost.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ module: 'M03' }),
    })
  })

  it('uses 2048 tokens for ghostwriter', async () => {
    await generatePost({
      personaSlug: 'flipio',
      type: 'ghostwriter',
      platform: 'linkedin',
      brief: 'Long educational post about DPE',
    })

    expect(mockCallLLM).toHaveBeenCalledWith(
      'flipio',
      'linkedin_ghostwriter',
      expect.any(String),
      expect.objectContaining({ maxTokens: 2048 })
    )
  })

  it('rejects brief shorter than 10 chars', async () => {
    await expect(
      generatePost({
        personaSlug: 'flipio',
        type: 'post_texte',
        platform: 'linkedin',
        brief: 'too short',
      })
    ).rejects.toThrow()
  })

  it('rejects invalid persona slug', async () => {
    await expect(
      generatePost({
        personaSlug: 'invalid' as 'flipio',
        type: 'post_texte',
        platform: 'linkedin',
        brief: 'A valid brief that is long enough',
      })
    ).rejects.toThrow()
  })

  it('throws when LLM returns empty content', async () => {
    mockCallLLM.mockResolvedValue('   ')

    await expect(
      generatePost({
        personaSlug: 'flipio',
        type: 'post_texte',
        platform: 'linkedin',
        brief: 'Brief about something interesting',
      })
    ).rejects.toThrow('contenu vide')
  })

  it('links media to post when mediaIds provided', async () => {
    await generatePost({
      personaSlug: 'flipio',
      type: 'post_texte',
      platform: 'linkedin',
      brief: 'Post with media attached to it',
      mediaIds: ['media-1', 'media-2'],
    })

    expect(mockMedia.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['media-1', 'media-2'] } },
      data: { postId: 'post-1' },
    })
  })

  it('includes image credit in prompt when mediaUrl provided', async () => {
    await generatePost({
      personaSlug: 'flipio',
      type: 'post_image',
      platform: 'linkedin',
      brief: 'Post about a beautiful building',
      mediaUrl: 'https://example.com/image.jpg',
      imageCredit: 'Photo by John Doe / Pexels',
    })

    expect(mockCallLLM).toHaveBeenCalledWith(
      'flipio',
      'linkedin_post_image',
      expect.stringContaining('Photo by John Doe / Pexels'),
      expect.any(Object)
    )
  })
})
