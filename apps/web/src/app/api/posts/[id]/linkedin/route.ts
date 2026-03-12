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
  const token = await db.oAuthToken.findUnique({ where: { provider: 'linkedin' } })
  if (!token) throw new Error('LinkedIn not connected')
  if (token.expiresAt && token.expiresAt < new Date()) throw new Error('LinkedIn token expired')
  return decryptToken(token.accessToken)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const post = await db.post.findUnique({ where: { id } })

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }
    if (!post.externalId) {
      return NextResponse.json({ error: 'Post has no LinkedIn ID' }, { status: 400 })
    }

    const accessToken = await getAccessToken()

    // LinkedIn UGC Posts API: DELETE /v2/ugcPosts/{ugcPostUrn}
    const encodedUrn = encodeURIComponent(post.externalId)
    const res = await fetch(`https://api.linkedin.com/v2/ugcPosts/${encodedUrn}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
    })

    if (!res.ok) {
      const errorText = await res.text()
      console.error('LinkedIn delete failed:', res.status, errorText)
      // 404 means already deleted on LinkedIn — treat as success
      if (res.status !== 404) {
        let message = errorText
        try {
          const parsed = JSON.parse(errorText)
          message = parsed.message ?? errorText
        } catch { /* use raw text */ }
        return NextResponse.json({ error: `LinkedIn: ${message}` }, { status: res.status })
      }
    }

    // Update post in DB: clear externalId, set status to archived
    await db.post.update({
      where: { id },
      data: {
        externalId: null,
        statut: 'archived',
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('LinkedIn delete error:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
