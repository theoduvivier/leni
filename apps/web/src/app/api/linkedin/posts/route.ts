import { NextResponse } from 'next/server'
import { db } from '@leni/db'
import { createDecipheriv } from 'crypto'

const ALGORITHM = 'aes-256-gcm'

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY
  if (!key || key.length < 32) {
    throw new Error('ENCRYPTION_KEY must be at least 32 characters')
  }
  return Buffer.from(key.slice(0, 32), 'utf-8')
}

function decryptToken(encryptedData: string): string {
  const key = getEncryptionKey()
  const [ivHex, authTagHex, encrypted] = encryptedData.split(':')
  if (!ivHex || !authTagHex || !encrypted) {
    throw new Error('Invalid encrypted data format')
  }
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'))
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

async function getAccessToken(): Promise<string> {
  const token = await db.oAuthToken.findUnique({
    where: { provider: 'linkedin' },
  })
  if (!token) throw new Error('LinkedIn not connected')
  if (token.expiresAt && token.expiresAt < new Date()) {
    throw new Error('LinkedIn token expired')
  }
  return decryptToken(token.accessToken)
}

/**
 * POST /api/linkedin/posts — Import old LinkedIn posts into the DB
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const personaSlug = (body.personaSlug as string) ?? 'flipio'

    const accessToken = await getAccessToken()

    // Get user profile for author URN — try /v2/userinfo then /v2/me
    let authorUrn: string
    const userinfoRes = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (userinfoRes.ok) {
      const profile = await userinfoRes.json()
      authorUrn = `urn:li:person:${profile.sub}`
    } else {
      const meRes = await fetch('https://api.linkedin.com/v2/me', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
        },
      })
      if (!meRes.ok) {
        return NextResponse.json({ error: 'Failed to fetch LinkedIn profile' }, { status: 500 })
      }
      const me = await meRes.json()
      authorUrn = `urn:li:person:${me.id}`
    }

    // Fetch posts using the REST API
    const postsRes = await fetch(
      `https://api.linkedin.com/rest/posts?author=${encodeURIComponent(authorUrn)}&q=author&count=50&sortBy=LAST_MODIFIED`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'LinkedIn-Version': '202401',
          'X-Restli-Protocol-Version': '2.0.0',
        },
      }
    )

    if (!postsRes.ok) {
      const errorText = await postsRes.text()
      console.error('LinkedIn posts fetch failed:', postsRes.status, errorText)

      // Fallback to ugcPosts API
      const ugcRes = await fetch(
        `https://api.linkedin.com/v2/ugcPosts?q=authors&authors=List(${encodeURIComponent(authorUrn)})&count=50`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'X-Restli-Protocol-Version': '2.0.0',
          },
        }
      )

      if (!ugcRes.ok) {
        const ugcError = await ugcRes.text()
        console.error('LinkedIn ugcPosts fetch also failed:', ugcRes.status, ugcError)
        return NextResponse.json(
          { error: 'Cannot fetch LinkedIn posts. You may need to add r_member_social scope.', details: ugcError },
          { status: 403 }
        )
      }

      const ugcData = await ugcRes.json()
      const imported = await importUgcPosts(ugcData.elements ?? [], personaSlug)
      return NextResponse.json({ imported, source: 'ugcPosts' })
    }

    const postsData = await postsRes.json()
    const imported = await importRestPosts(postsData.elements ?? [], personaSlug)
    return NextResponse.json({ imported, source: 'restPosts' })
  } catch (err) {
    console.error('LinkedIn posts import error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

interface ImportedPost {
  externalId: string
  contenu: string
  publishedAt: string
  isNew: boolean
}

/**
 * Import posts from the REST /posts API format
 */
async function importRestPosts(elements: Record<string, unknown>[], personaSlug: string): Promise<ImportedPost[]> {
  const persona = await getOrCreatePersona(personaSlug)
  const imported: ImportedPost[] = []

  for (const el of elements) {
    const postUrn = el.id as string | undefined
    if (!postUrn) continue

    const commentary = el.commentary as string | undefined
    const content = el.content as Record<string, unknown> | undefined
    const text = commentary ?? (content?.title as string | undefined) ?? ''
    if (!text) continue

    const createdAtMs = el.createdAt as number | undefined
    const publishedAt = createdAtMs ? new Date(createdAtMs) : new Date()

    // Check if already imported
    const existing = await db.post.findFirst({
      where: { externalId: postUrn },
    })

    if (existing) {
      imported.push({
        externalId: postUrn,
        contenu: text.slice(0, 100),
        publishedAt: publishedAt.toISOString(),
        isNew: false,
      })
      continue
    }

    await db.post.create({
      data: {
        personaId: persona.id,
        type: 'post_texte',
        module: 'import_linkedin',
        contenu: text,
        statut: 'published',
        platform: 'linkedin',
        externalId: postUrn,
        publishedAt,
        publishAt: publishedAt,
      },
    })

    imported.push({
      externalId: postUrn,
      contenu: text.slice(0, 100),
      publishedAt: publishedAt.toISOString(),
      isNew: true,
    })
  }

  return imported
}

/**
 * Import posts from the UGC /ugcPosts API format
 */
async function importUgcPosts(elements: Record<string, unknown>[], personaSlug: string): Promise<ImportedPost[]> {
  const persona = await getOrCreatePersona(personaSlug)
  const imported: ImportedPost[] = []

  for (const el of elements) {
    const postUrn = (el.id ?? el['$URN']) as string | undefined
    if (!postUrn) continue

    const specificContent = el.specificContent as Record<string, unknown> | undefined
    const shareContent = specificContent?.['com.linkedin.ugc.ShareContent'] as Record<string, unknown> | undefined
    const commentary = shareContent?.shareCommentary as Record<string, unknown> | undefined
    const text = commentary?.text as string | undefined ?? ''
    if (!text) continue

    const created = el.created as Record<string, unknown> | undefined
    const createdAtMs = (created?.time ?? el.firstPublishedAt) as number | undefined
    const publishedAt = createdAtMs ? new Date(createdAtMs) : new Date()

    const existing = await db.post.findFirst({
      where: { externalId: postUrn },
    })

    if (existing) {
      imported.push({
        externalId: postUrn,
        contenu: text.slice(0, 100),
        publishedAt: publishedAt.toISOString(),
        isNew: false,
      })
      continue
    }

    await db.post.create({
      data: {
        personaId: persona.id,
        type: 'post_texte',
        module: 'import_linkedin',
        contenu: text,
        statut: 'published',
        platform: 'linkedin',
        externalId: postUrn,
        publishedAt,
        publishAt: publishedAt,
      },
    })

    imported.push({
      externalId: postUrn,
      contenu: text.slice(0, 100),
      publishedAt: publishedAt.toISOString(),
      isNew: true,
    })
  }

  return imported
}

async function getOrCreatePersona(slug: string) {
  const persona = await db.persona.findUnique({ where: { slug } })
  if (persona) return persona

  // Fallback: use the first persona available
  const first = await db.persona.findFirst()
  if (first) return first

  throw new Error('No persona found in DB')
}
