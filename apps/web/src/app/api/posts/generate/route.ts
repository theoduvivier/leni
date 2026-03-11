import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@leni/db'

const GenerateBody = z.object({
  personaSlug: z.enum(['flipio', 'mdb']),
  type: z.enum(['post_texte', 'comment_trigger', 'ghostwriter', 'post_image', 'deal_case_study', 'instagram_caption', 'instagram_story']),
  platform: z.enum(['linkedin', 'instagram']),
  brief: z.string().min(10, 'Le brief doit faire au moins 10 caractères'),
  dealCity: z.string().optional(),
  dealStrategy: z.string().optional(),
  dealMetric: z.string().optional(),
  mediaIds: z.array(z.string()).optional(),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const data = GenerateBody.parse(body)

    // Crée un job en DB — le worker le récupère automatiquement
    const job = await db.job.create({
      data: {
        type: 'content-generation',
        data: {
          personaSlug: data.personaSlug,
          type: data.type,
          platform: data.platform,
          brief: data.brief,
          ...(data.dealCity ? { dealCity: data.dealCity } : {}),
          ...(data.dealStrategy ? { dealStrategy: data.dealStrategy } : {}),
          ...(data.dealMetric ? { dealMetric: data.dealMetric } : {}),
          ...(data.mediaIds ? { mediaIds: data.mediaIds } : {}),
        },
      },
    })

    return NextResponse.json({ jobId: job.id, status: 'queued' })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
