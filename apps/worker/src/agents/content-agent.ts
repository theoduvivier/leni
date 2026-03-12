import { db } from '@leni/db'
import { callLLM } from '../lib/llm'
import { z } from 'zod'

const GeneratePostInput = z.object({
  personaSlug: z.enum(['flipio', 'mdb']),
  type: z.enum(['post_texte', 'comment_trigger', 'ghostwriter', 'post_image', 'deal_case_study', 'instagram_caption', 'instagram_story']),
  platform: z.enum(['linkedin', 'instagram']),
  brief: z.string().min(10),
  // Deal case study fields (optional, required when type = deal_case_study)
  dealCity: z.string().optional(),
  dealStrategy: z.string().optional(),
  dealMetric: z.string().optional(),
  mediaIds: z.array(z.string()).optional(),
})

type GeneratePostInput = z.infer<typeof GeneratePostInput>

const skillMap: Record<string, string> = {
  post_texte: 'linkedin_post_texte',
  comment_trigger: 'linkedin_comment_trigger',
  ghostwriter: 'linkedin_ghostwriter',
  post_image: 'linkedin_post_image',
  deal_case_study: 'deal_case_study',
  instagram_caption: 'instagram_caption',
  instagram_story: 'instagram_story',
}

function buildDealBrief(input: GeneratePostInput): string {
  const parts = [`Brief : ${input.brief}`]
  if (input.dealCity) parts.push(`Ville : ${input.dealCity}`)
  if (input.dealStrategy) parts.push(`Stratégie : ${input.dealStrategy}`)
  if (input.dealMetric) parts.push(`Chiffre clé : ${input.dealMetric}`)
  if (input.mediaIds && input.mediaIds.length > 0) {
    parts.push(`Photos : ${input.mediaIds.length} photo(s) avant/après uploadée(s)`)
  }
  return parts.join('\n')
}

export async function generatePost(input: GeneratePostInput): Promise<string> {
  const validated = GeneratePostInput.parse(input)

  const skillNom = skillMap[validated.type]
  if (!skillNom) {
    throw new Error(`Unknown post type: ${validated.type}`)
  }

  const isDeal = validated.type === 'deal_case_study'
  const prompt = isDeal
    ? `${buildDealBrief(validated)}\n\nGénère un post case study pour ${validated.platform}.`
    : `Brief : ${validated.brief}\n\nGénère un post ${validated.type} pour ${validated.platform}.`

  const maxTokens = isDeal || validated.type === 'ghostwriter' ? 2048 : 1024
  const module = isDeal ? 'M03' : 'M01'

  const contenu = await callLLM(
    validated.personaSlug,
    skillNom,
    prompt,
    maxTokens
  )

  if (!contenu.trim()) {
    throw new Error('Le modèle a retourné un contenu vide — post non enregistré')
  }

  const post = await db.post.create({
    data: {
      persona: { connect: { slug: validated.personaSlug } },
      type: validated.type,
      module,
      contenu,
      statut: 'draft',
      platform: validated.platform,
    },
  })

  // Link media to post if provided
  if (validated.mediaIds && validated.mediaIds.length > 0) {
    await db.media.updateMany({
      where: { id: { in: validated.mediaIds } },
      data: { postId: post.id },
    })
  }

  console.log(JSON.stringify({
    level: 'info',
    message: `Post generated: ${post.id}`,
    timestamp: new Date().toISOString(),
    service: 'content-agent',
    postId: post.id,
    persona: validated.personaSlug,
    type: validated.type,
  }))

  return post.id
}
