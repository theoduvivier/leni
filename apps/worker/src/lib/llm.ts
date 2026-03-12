import OpenAI from 'openai'
import { db } from '@leni/db'
import { buildSystemPrompt } from './context'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const MODEL = 'gpt-4.1-mini' as const

interface CallLLMOptions {
  maxTokens?: number
  platform?: string
  temperature?: number
}

export async function callLLM(
  personaSlug: string,
  skillNom: string,
  userPrompt: string,
  maxTokensOrOptions?: number | CallLLMOptions
): Promise<string> {
  // Support both old signature (maxTokens number) and new (options object)
  const options: CallLLMOptions = typeof maxTokensOrOptions === 'number'
    ? { maxTokens: maxTokensOrOptions }
    : maxTokensOrOptions ?? {}

  const maxTokens = options.maxTokens ?? 1024
  const temperature = options.temperature ?? 0.8

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
    (context?.data as Record<string, unknown>) ?? {},
    options.platform
  )

  const response = await openai.chat.completions.create({
    model: MODEL,
    max_tokens: maxTokens,
    temperature,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userPrompt },
    ],
  })

  const content = response.choices[0]?.message?.content ?? ''

  // Strip common artifacts that GPT sometimes adds despite instructions
  return cleanLLMOutput(content)
}

/** Remove common LLM artifacts from generated content */
export function cleanLLMOutput(text: string): string {
  let cleaned = text.trim()

  // Remove common preambles (French and English)
  const preambles = [
    /^(voici|voilà)\s+(le|un|une|mon|ta|la)\s+\w+\s*:?\s*/i,
    /^here('s| is)\s+(the|a|your)\s+\w+\s*:?\s*/i,
    /^(bien sûr|d'accord|ok)\s*[,!.]?\s*/i,
  ]
  for (const regex of preambles) {
    cleaned = cleaned.replace(regex, '')
  }

  // Remove trailing meta-commentary after the actual post
  // Pattern: content followed by "---" and then notes/explanations
  const trailingSeparator = cleaned.lastIndexOf('\n---\n')
  if (trailingSeparator > cleaned.length * 0.5) {
    cleaned = cleaned.slice(0, trailingSeparator)
  }

  // Remove markdown headers that shouldn't be in social posts
  cleaned = cleaned.replace(/^#{1,3}\s+/gm, '')

  // Remove wrapping quotes if the entire content is quoted
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) ||
      (cleaned.startsWith('«') && cleaned.endsWith('»'))) {
    cleaned = cleaned.slice(1, -1).trim()
  }

  return cleaned.trim()
}
