import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@leni/db'

const GenerateBody = z.object({
  personaSlug: z.enum(['flipio', 'mdb']),
  type: z.enum(['post_texte', 'comment_trigger', 'ghostwriter', 'post_image']),
  platform: z.enum(['linkedin', 'instagram']),
  brief: z.string().min(10, 'Le brief doit faire au moins 10 caractères'),
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
