import OpenAI from 'openai'
import { db } from '@leni/db'
import { buildSystemPrompt } from './context'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const MODEL = 'gpt-4.1-mini' as const

export async function callLLM(
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

  const response = await openai.chat.completions.create({
    model: MODEL,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userPrompt },
    ],
  })

  return response.choices[0]?.message?.content ?? ''
}
