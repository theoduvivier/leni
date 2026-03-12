import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockDb, mockCreate } = vi.hoisted(() => {
  const fn = () => vi.fn()
  const model = () => ({ findFirst: fn(), findMany: fn(), findUnique: fn(), create: fn(), update: fn(), updateMany: fn(), delete: fn(), count: fn() })
  return {
    mockDb: { skill: model(), persona: model(), contextLive: model() },
    mockCreate: vi.fn(),
  }
})

vi.mock('@leni/db', () => ({ db: mockDb }))
vi.mock('openai', () => ({
  default: class {
    chat = { completions: { create: mockCreate } }
  },
}))

import { cleanLLMOutput, callLLM } from './llm'

describe('cleanLLMOutput', () => {
  it('strips French preamble "Voici le post :"', () => {
    expect(cleanLLMOutput('Voici le post :\nActual content')).toBe('Actual content')
  })

  it('strips French preamble "Voilà un post"', () => {
    expect(cleanLLMOutput('Voilà un post\nContent here')).toBe('Content here')
  })

  it('strips English preamble "Here\'s the post:"', () => {
    expect(cleanLLMOutput("Here's the post:\nContent")).toBe('Content')
  })

  it('strips preamble "Bien sûr !"', () => {
    expect(cleanLLMOutput('Bien sûr ! Le contenu')).toBe('Le contenu')
  })

  it('strips trailing separator after 50% of content', () => {
    const content = 'A'.repeat(100) + '\n---\nNotes: this is meta'
    const result = cleanLLMOutput(content)
    expect(result).toBe('A'.repeat(100))
  })

  it('keeps separator before 50% of content', () => {
    const content = 'AB\n---\n' + 'C'.repeat(100)
    const result = cleanLLMOutput(content)
    expect(result).toContain('---')
    expect(result).toContain('C'.repeat(100))
  })

  it('strips markdown headers', () => {
    expect(cleanLLMOutput('## Titre\nCorps du texte')).toBe('Titre\nCorps du texte')
    expect(cleanLLMOutput('# Grand titre\nTexte')).toBe('Grand titre\nTexte')
    expect(cleanLLMOutput('### Sous-titre\nTexte')).toBe('Sous-titre\nTexte')
  })

  it('strips wrapping double quotes', () => {
    expect(cleanLLMOutput('"Content inside quotes"')).toBe('Content inside quotes')
  })

  it('strips wrapping guillemets', () => {
    expect(cleanLLMOutput('«Content inside guillemets»')).toBe('Content inside guillemets')
  })

  it('passes clean text through unchanged', () => {
    const text = 'This is already clean content with no artifacts.'
    expect(cleanLLMOutput(text)).toBe(text)
  })

  it('handles empty string', () => {
    expect(cleanLLMOutput('')).toBe('')
  })

  it('handles whitespace-only string', () => {
    expect(cleanLLMOutput('   \n  ')).toBe('')
  })
})

describe('callLLM', () => {
  const mockPersona = {
    id: 'persona-1',
    slug: 'flipio',
    nom: 'Flipio',
    config: { cible: 'MdB' },
    regles: 'Ton direct.',
    faq: [],
  }

  const mockSkill = {
    id: 'skill-1',
    nom: 'linkedin_post_texte',
    contenu: 'Écris un post LinkedIn.',
    actif: true,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Generated post content' } }],
    })
  })

  it('returns generated content on happy path', async () => {
    mockDb.skill.findFirst.mockResolvedValue(mockSkill)
    mockDb.persona.findUnique.mockResolvedValue(mockPersona)
    mockDb.contextLive.findUnique.mockResolvedValue(null)

    const result = await callLLM('flipio', 'linkedin_post_texte', 'Write a post about real estate')

    expect(result).toBe('Generated post content')
    expect(mockCreate).toHaveBeenCalledOnce()
  })

  it('throws when skill not found', async () => {
    mockDb.skill.findFirst.mockResolvedValue(null)

    await expect(callLLM('flipio', 'nonexistent', 'prompt'))
      .rejects.toThrow('Skill "nonexistent" not found or inactive')
  })

  it('throws when persona not found', async () => {
    mockDb.skill.findFirst.mockResolvedValue(mockSkill)
    mockDb.persona.findUnique.mockResolvedValue(null)

    await expect(callLLM('unknown', 'linkedin_post_texte', 'prompt'))
      .rejects.toThrow('Persona "unknown" not found')
  })

  it('works without context live data', async () => {
    mockDb.skill.findFirst.mockResolvedValue(mockSkill)
    mockDb.persona.findUnique.mockResolvedValue(mockPersona)
    mockDb.contextLive.findUnique.mockResolvedValue(null)

    const result = await callLLM('flipio', 'linkedin_post_texte', 'prompt')
    expect(result).toBe('Generated post content')
  })

  it('passes options to OpenAI', async () => {
    mockDb.skill.findFirst.mockResolvedValue(mockSkill)
    mockDb.persona.findUnique.mockResolvedValue(mockPersona)
    mockDb.contextLive.findUnique.mockResolvedValue(null)

    await callLLM('flipio', 'linkedin_post_texte', 'prompt', {
      maxTokens: 2048,
      temperature: 0.5,
      platform: 'linkedin',
    })

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        max_tokens: 2048,
        temperature: 0.5,
      })
    )
  })

  it('supports legacy number signature for maxTokens', async () => {
    mockDb.skill.findFirst.mockResolvedValue(mockSkill)
    mockDb.persona.findUnique.mockResolvedValue(mockPersona)
    mockDb.contextLive.findUnique.mockResolvedValue(null)

    await callLLM('flipio', 'linkedin_post_texte', 'prompt', 2048)

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        max_tokens: 2048,
      })
    )
  })
})
