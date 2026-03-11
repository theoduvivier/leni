import { db } from '@leni/db'
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY
  if (!key || key.length < 32) {
    throw new Error('ENCRYPTION_KEY must be at least 32 characters')
  }
  return Buffer.from(key.slice(0, 32), 'utf-8')
}

export function encryptToken(token: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(16)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(token, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

export function decryptToken(encryptedData: string): string {
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

export function getLinkedInAuthUrl(): string {
  const clientId = process.env.LINKEDIN_CLIENT_ID
  const redirectUri = `${process.env.NEXTAUTH_URL}/api/linkedin/callback`
  const scope = 'openid profile w_member_social'
  const state = randomBytes(16).toString('hex')

  return `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=${encodeURIComponent(scope)}`
}

export async function exchangeCodeForToken(code: string): Promise<{
  accessToken: string
  expiresIn: number
  refreshToken?: string
}> {
  const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${process.env.NEXTAUTH_URL}/api/linkedin/callback`,
      client_id: process.env.LINKEDIN_CLIENT_ID ?? '',
      client_secret: process.env.LINKEDIN_CLIENT_SECRET ?? '',
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`LinkedIn token exchange failed: ${error}`)
  }

  const data = await response.json()
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
    refreshToken: data.refresh_token,
  }
}

export async function publishToLinkedIn(postId: string): Promise<string> {
  const post = await db.post.findUnique({
    where: { id: postId },
    include: { persona: true },
  })

  if (!post) throw new Error(`Post ${postId} not found`)
  if (post.statut !== 'approved') throw new Error(`Post ${postId} is not approved`)

  const accessToken = process.env.LINKEDIN_ACCESS_TOKEN
  if (!accessToken) throw new Error('LinkedIn access token not configured')

  // Get user profile for author URN
  const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!profileRes.ok) throw new Error('Failed to fetch LinkedIn profile')
  const profile = await profileRes.json()

  // Create post
  const postBody = {
    author: `urn:li:person:${profile.sub}`,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text: post.contenu },
        shareMediaCategory: 'NONE',
      },
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
    },
  }

  const publishRes = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify(postBody),
  })

  if (!publishRes.ok) {
    const error = await publishRes.text()
    throw new Error(`LinkedIn publish failed: ${error}`)
  }

  const result = await publishRes.json()
  const externalId = result.id

  await db.post.update({
    where: { id: postId },
    data: {
      statut: 'published',
      publishedAt: new Date(),
      externalId,
    },
  })

  console.log(JSON.stringify({
    level: 'info',
    message: `Published to LinkedIn: ${externalId}`,
    timestamp: new Date().toISOString(),
    service: 'publisher-linkedin',
    postId,
    externalId,
  }))

  return externalId
}
