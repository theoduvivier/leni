import Anthropic from '@anthropic-ai/sdk'
import { db } from '@leni/db'
import { buildSystemPrompt } from './context'

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const MODEL = 'claude-sonnet-4-20250514' as const

export async function callClaude(
  personaSlug: string,
  skillNom: string,
  userPrompt: string,
  maxTokens = 1024
): Promise<string> {
  const skill = await db.skill.findFirst({
    where: { nom: skillNom, actif: true },
    orderBy: { createdAt: 'desc' },
  })
  if (!skill) {
    throw new Error(`Skill "${skillNom}" not found or inactive`)
  }

  const personaData = await db.persona.findUnique({
    where: { slug: personaSlug },
  })
  if (!personaData) {
    throw new Error(`Persona "${personaSlug}" not found`)
  }

  const context = await db.contextLive.findUnique({
    where: { personaId: personaData.id },
  })

  const system = buildSystemPrompt(
    {
      slug: personaData.slug,
      nom: personaData.nom,
      config: personaData.config as Record<string, unknown>,
      regles: personaData.regles,
      faq: personaData.faq as Array<{ question: string; reponse: string }>,
    },
    skill.contenu,
    (context?.data as Record<string, unknown>) ?? {}
  )

  const response = await claude.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const textBlock = response.content.find((block) => block.type === 'text')
  return textBlock && textBlock.type === 'text' ? textBlock.text : ''
}
