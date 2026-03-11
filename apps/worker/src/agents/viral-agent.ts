import { db } from '@leni/db'
import { callClaude } from '../lib/claude'
import { z } from 'zod'

const ViralInput = z.object({
  personaSlug: z.enum(['flipio', 'mdb']),
  platform: z.enum(['linkedin', 'instagram']),
  brief: z.string().min(10),
})

type ViralInput = z.infer<typeof ViralInput>

const ViralOutput = z.object({
  variantes: z.array(z.object({
    style: z.enum(['polémique', 'storytelling', 'chiffre_choc']),
    contenu: z.string(),
    score_viralite: z.number().min(0).max(10),
    mot_cle: z.string(),
    livrable_promis: z.string(),
  })),
})

function log(level: string, message: string, extra?: Record<string, unknown>) {
  console.log(JSON.stringify({
    level,
    message,
    timestamp: new Date().toISOString(),
    service: 'viral-agent',
    ...extra,
  }))
}

/** Generate 3 viral comment-trigger variants */
export async function generateViral(input: ViralInput): Promise<string[]> {
  const validated = ViralInput.parse(input)

  const prompt = `Brief : ${validated.brief}

Génère exactement 3 variantes de post comment trigger pour ${validated.platform}.

Chaque variante doit suivre un style différent :
1. Polémique douce — commence par une affirmation forte et contestable
2. Storytelling — commence par "J'ai..." avec une situation réelle
3. Chiffre choc — commence par un nombre surprenant

Pour chaque variante, évalue le score de viralité (0-10) basé sur :
- Force de l'accroche (3 pts)
- Clarté de la promesse (3 pts)
- Urgence / FOMO (2 pts)
- Simplicité du CTA (2 pts)

Réponds UNIQUEMENT en JSON valide :
{
  "variantes": [
    {
      "style": "polémique",
      "contenu": "<post complet>",
      "score_viralite": <0-10>,
      "mot_cle": "<mot-clé à commenter>",
      "livrable_promis": "<ce que reçoit la personne>"
    },
    ...
  ]
}`

  const result = await callClaude(
    validated.personaSlug,
    'linkedin_comment_trigger',
    prompt,
    2048
  )

  // Parse the JSON response
  const jsonMatch = result.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Claude did not return valid JSON')
  }

  let parsed: z.infer<typeof ViralOutput>
  try {
    parsed = ViralOutput.parse(JSON.parse(jsonMatch[0]))
  } catch {
    // If parsing fails, save the raw content as a single post
    const post = await db.post.create({
      data: {
        persona: { connect: { slug: validated.personaSlug } },
        type: 'comment_trigger',
        module: 'M09',
        contenu: result,
        statut: 'draft',
        platform: validated.platform,
      },
    })
    return [post.id]
  }

  // Sort by virality score descending
  const sorted = parsed.variantes.sort((a, b) => b.score_viralite - a.score_viralite)

  // Create a post for each variant
  const postIds: string[] = []
  for (const variante of sorted) {
    const post = await db.post.create({
      data: {
        persona: { connect: { slug: validated.personaSlug } },
        type: 'comment_trigger',
        module: 'M09',
        contenu: `[${variante.style.toUpperCase()}] Score: ${variante.score_viralite}/10\nMot-clé: ${variante.mot_cle}\nLivrable: ${variante.livrable_promis}\n\n---\n\n${variante.contenu}`,
        statut: 'draft',
        platform: validated.platform,
      },
    })
    postIds.push(post.id)
  }

  log('info', `Generated ${postIds.length} viral variants`, {
    persona: validated.personaSlug,
    scores: sorted.map((v) => v.score_viralite),
  })

  return postIds
}
