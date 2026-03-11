import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { db } from '@leni/db'
import { randomUUID } from 'crypto'

const UPLOAD_DIR = join(process.cwd(), 'public', 'uploads')
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const files = formData.getAll('files') as File[]

    if (files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    if (files.length > 10) {
      return NextResponse.json({ error: 'Maximum 10 files allowed' }, { status: 400 })
    }

    // Ensure upload directory exists
    await mkdir(UPLOAD_DIR, { recursive: true })

    const uploaded: { id: string; filename: string; url: string }[] = []

    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json({ error: `Invalid file type: ${file.type}. Allowed: JPG, PNG, WebP` }, { status: 400 })
      }

      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: `File too large: ${file.name}. Max 10MB` }, { status: 400 })
      }

      const ext = file.name.split('.').pop() ?? 'jpg'
      const uniqueName = `${randomUUID()}.${ext}`
      const filePath = join(UPLOAD_DIR, uniqueName)

      const buffer = Buffer.from(await file.arrayBuffer())
      await writeFile(filePath, buffer)

      const media = await db.media.create({
        data: {
          filename: file.name,
          path: `/uploads/${uniqueName}`,
          type: file.type,
          size: file.size,
        },
      })

      uploaded.push({
        id: media.id,
        filename: media.filename,
        url: `/uploads/${uniqueName}`,
      })
    }

    return NextResponse.json({ files: uploaded })
  } catch (error) {
    console.error('Media upload error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
