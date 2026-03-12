import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockPost, mockCallLLM } = vi.hoisted(() => ({
  mockPost: { create: vi.fn() },
  mockCallLLM: vi.fn(),
}))

vi.mock('@leni/db', () => ({ db: { post: mockPost } }))
vi.mock('../lib/llm', () => ({ callLLM: mockCallLLM }))

import { generateViral } from './viral-agent'

const validJson = JSON.stringify({
  variantes: [
    { style: 'polémique', contenu: 'Post polémique', score_viralite: 7, mot_cle: 'GUIDE', livrable_promis: 'Un guide PDF' },
    { style: 'storytelling', contenu: 'Post storytelling', score_viralite: 9, mot_cle: 'STORY', livrable_promis: 'Un template' },
    { style: 'chiffre_choc', contenu: 'Post chiffre choc', score_viralite: 5, mot_cle: 'CHIFFRE', livrable_promis: 'Une analyse' },
  ],
})

describe('generateViral', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    let postCounter = 0
    mockPost.create.mockImplementation(() => {
      postCounter++
      return Promise.resolve({ id: `post-${postCounter}` })
    })
  })

  it('creates 3 posts sorted by virality score descending', async () => {
    mockCallLLM.mockResolvedValue(validJson)

    const result = await generateViral({
      personaSlug: 'flipio',
      platform: 'linkedin',
      brief: 'Comment attirer des marchands de biens',
    })

    expect(result).toHaveLength(3)
    // First post created should be storytelling (score 9)
    expect(mockPost.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({
        contenu: 'Post storytelling',
        module: 'M09',
        type: 'comment_trigger',
        statut: 'draft',
      }),
    })
  })

  it('rejects brief shorter than 10 chars', async () => {
    await expect(
      generateViral({
        personaSlug: 'flipio',
        platform: 'linkedin',
        brief: 'too short',
      })
    ).rejects.toThrow()
  })

  it('throws when LLM returns empty content', async () => {
    mockCallLLM.mockResolvedValue('   ')

    await expect(
      generateViral({
        personaSlug: 'flipio',
        platform: 'linkedin',
        brief: 'A valid brief here',
      })
    ).rejects.toThrow('contenu vide')
  })

  it('throws when LLM returns no JSON', async () => {
    mockCallLLM.mockResolvedValue('Just some plain text without any JSON structure')

    await expect(
      generateViral({
        personaSlug: 'flipio',
        platform: 'linkedin',
        brief: 'A valid brief here',
      })
    ).rejects.toThrow('LLM did not return valid JSON')
  })

  it('falls back to raw content when JSON schema is invalid', async () => {
    mockCallLLM.mockResolvedValue('{"variantes": [{"wrong_field": true}]}')

    const result = await generateViral({
      personaSlug: 'flipio',
      platform: 'linkedin',
      brief: 'A valid brief here',
    })

    expect(result).toHaveLength(1)
    expect(mockPost.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        contenu: '{"variantes": [{"wrong_field": true}]}',
        module: 'M09',
      }),
    })
  })

  it('extracts JSON embedded in surrounding text', async () => {
    mockCallLLM.mockResolvedValue(`Voici les variantes :\n${validJson}\n\nBonne chance !`)

    const result = await generateViral({
      personaSlug: 'flipio',
      platform: 'linkedin',
      brief: 'A valid brief for extraction',
    })

    expect(result).toHaveLength(3)
  })
})
