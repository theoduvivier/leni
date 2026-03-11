import { db } from '@leni/db'
import { callClaude } from '../lib/claude'
import { z } from 'zod'

const GeneratePostInput = z.object({
  personaSlug: z.enum(['flipio', 'mdb']),
  type: z.enum(['post_texte', 'comment_trigger', 'ghostwriter', 'post_image']),
  platform: z.enum(['linkedin', 'instagram']),
  brief: z.string().min(10),
})

type GeneratePostInput = z.infer<typeof GeneratePostInput>

const skillMap: Record<string, string> = {
  post_texte: 'linkedin_post_texte',
  comment_trigger: 'linkedin_comment_trigger',
  ghostwriter: 'linkedin_ghostwriter',
  post_image: 'linkedin_post_image',
}

export async function generatePost(input: GeneratePostInput): Promise<string> {
  const validated = GeneratePostInput.parse(input)

  const skillNom = skillMap[validated.type]
  if (!skillNom) {
    throw new Error(`Unknown post type: ${validated.type}`)
  }

  const contenu = await callClaude(
    validated.personaSlug,
    skillNom,
    `Brief : ${validated.brief}\n\nGénère un post ${validated.type} pour ${validated.platform}.`,
    validated.type === 'ghostwriter' ? 2048 : 1024
  )

  const post = await db.post.create({
    data: {
      persona: { connect: { slug: validated.personaSlug } },
      type: validated.type,
      module: 'M01',
      contenu,
      statut: 'draft',
      platform: validated.platform,
    },
  })

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
