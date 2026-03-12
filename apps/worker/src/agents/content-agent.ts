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
  // Image from picker (optional, for post_image / instagram types)
  mediaUrl: z.string().optional(),
  imageCredit: z.string().optional(),
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

const typeLabels: Record<string, string> = {
  post_texte: 'post texte LinkedIn',
  comment_trigger: 'post viral comment trigger LinkedIn',
  ghostwriter: 'post long format pédagogique LinkedIn',
  post_image: 'post avec image LinkedIn',
  deal_case_study: 'case study deal immobilier',
  instagram_caption: 'caption Instagram',
  instagram_story: 'texte pour Story Instagram',
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

function buildPrompt(validated: GeneratePostInput): string {
  const isDeal = validated.type === 'deal_case_study'
  const typeLabel = typeLabels[validated.type] ?? validated.type

  const parts: string[] = []

  if (isDeal) {
    parts.push(buildDealBrief(validated))
    parts.push(`\nRédige un ${typeLabel} pour ${validated.platform}.`)
  } else {
    parts.push(`Brief : ${validated.brief}`)

    if (validated.mediaUrl) {
      parts.push(`\nUne image accompagne ce post (crédit : ${validated.imageCredit ?? 'non renseigné'}).`)
      parts.push('Le texte doit compléter et contextualiser l\'image, pas la décrire.')
    }

    parts.push(`\nRédige un ${typeLabel}.`)
    parts.push('Retourne UNIQUEMENT le texte du post, prêt à publier.')
  }

  return parts.join('\n')
}

export async function generatePost(input: GeneratePostInput): Promise<string> {
  const validated = GeneratePostInput.parse(input)

  const skillNom = skillMap[validated.type]
  if (!skillNom) {
    throw new Error(`Unknown post type: ${validated.type}`)
  }

  const prompt = buildPrompt(validated)
  const isDeal = validated.type === 'deal_case_study'
  const maxTokens = isDeal || validated.type === 'ghostwriter' ? 2048 : 1024
  const module = isDeal ? 'M03' : 'M01'

  const contenu = await callLLM(
    validated.personaSlug,
    skillNom,
    prompt,
    { maxTokens, platform: validated.platform }
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
      mediaUrl: validated.mediaUrl ?? null,
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
