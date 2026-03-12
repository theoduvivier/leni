import { describe, it, expect } from 'vitest'
import { buildSystemPrompt } from './context'

const basePersona = {
  slug: 'flipio',
  nom: 'Flipio',
  config: { cible: 'marchands de biens', produit: 'SaaS' },
  regles: 'Ton direct et expert.',
  faq: [] as Array<{ question: string; reponse: string }>,
}

describe('buildSystemPrompt', () => {
  it('includes persona name, config, rules and skill content', () => {
    const result = buildSystemPrompt(basePersona, 'Écris un post LinkedIn.', {})

    expect(result).toContain('Flipio')
    expect(result).toContain('"cible"')
    expect(result).toContain('marchands de biens')
    expect(result).toContain('Ton direct et expert.')
    expect(result).toContain('Écris un post LinkedIn.')
  })

  it('includes FAQ block when FAQ is provided', () => {
    const persona = {
      ...basePersona,
      faq: [
        { question: 'Quel est le prix ?', reponse: 'Gratuit en bêta.' },
        { question: 'Comment ça marche ?', reponse: 'On gère tout.' },
      ],
    }
    const result = buildSystemPrompt(persona, 'skill content', {})

    expect(result).toContain('## FAQ')
    expect(result).toContain('Q: Quel est le prix ?')
    expect(result).toContain('R: Gratuit en bêta.')
    expect(result).toContain('Q: Comment ça marche ?')
    expect(result).toContain('R: On gère tout.')
  })

  it('omits FAQ block when FAQ is empty', () => {
    const result = buildSystemPrompt(basePersona, 'skill content', {})
    expect(result).not.toContain('## FAQ')
  })

  it('includes live data block when data is provided', () => {
    const result = buildSystemPrompt(basePersona, 'skill content', {
      places_beta: 12,
      promo: 'early bird -30%',
    })

    expect(result).toContain('## Données live')
    expect(result).toContain('"places_beta": 12')
    expect(result).toContain('"promo": "early bird -30%"')
  })

  it('omits live data block when data is empty', () => {
    const result = buildSystemPrompt(basePersona, 'skill content', {})
    expect(result).not.toContain('## Données live')
  })

  it('maps platform name correctly', () => {
    const linkedin = buildSystemPrompt(basePersona, 'skill', {}, 'linkedin')
    expect(linkedin).toContain('LinkedIn')
    expect(linkedin).not.toContain('les réseaux sociaux')

    const instagram = buildSystemPrompt(basePersona, 'skill', {}, 'instagram')
    expect(instagram).toContain('Instagram')

    const none = buildSystemPrompt(basePersona, 'skill', {})
    expect(none).toContain('les réseaux sociaux')
  })
})
