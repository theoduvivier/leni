import { db } from '@leni/db'
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY
  if (!key || key.length < 32) {
    throw new Error('ENCRYPTION_KEY must be at least 32 hex characters')
  }
  // Key is a hex string (32 hex chars = 16 bytes), pad to 32 bytes for AES-256
  // Use consistent UTF-8 encoding to match existing encrypted data
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

export async function getLinkedInAccessToken(): Promise<string> {
  const token = await db.oAuthToken.findUnique({
    where: { provider: 'linkedin' },
  })

  if (token) {
    if (token.expiresAt && token.expiresAt < new Date()) {
      throw new Error('LinkedIn token expired — reconnect via the dashboard')
    }
    return decryptToken(token.accessToken)
  }

  // Fallback to env var for backwards compatibility
  const envToken = process.env.LINKEDIN_ACCESS_TOKEN
  if (envToken) {
    return envToken
  }

  throw new Error('LinkedIn not connected — connect via the dashboard')
}

export async function getLinkedInPersonId(accessToken: string): Promise<string> {
  // Try /v2/userinfo (openid scope) first, fallback to /v2/me
  const userinfoRes = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (userinfoRes.ok) {
    const profile = await userinfoRes.json()
    if (profile.sub) return profile.sub
  }

  const meRes = await fetch('https://api.linkedin.com/v2/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'X-Restli-Protocol-Version': '2.0.0',
    },
  })
  if (meRes.ok) {
    const me = await meRes.json()
    if (me.id) return me.id
  }

  const status1 = userinfoRes.status
  const status2 = meRes.status
  throw new Error(
    `Failed to fetch LinkedIn profile (userinfo: ${status1}, me: ${status2}). ` +
    `Token may lack required scopes — reconnect LinkedIn via the dashboard.`
  )
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

async function uploadImageToLinkedIn(
  accessToken: string,
  personId: string,
  imageUrl: string
): Promise<string> {
  // Step 1: Register upload
  const registerRes = await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({
      registerUploadRequest: {
        recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
        owner: `urn:li:person:${personId}`,
        serviceRelationships: [
          {
            relationshipType: 'OWNER',
            identifier: 'urn:li:userGeneratedContent',
          },
        ],
      },
    }),
  })

  if (!registerRes.ok) {
    const errText = await registerRes.text()
    throw new Error(`LinkedIn image register failed (${registerRes.status}): ${errText}`)
  }

  const registerData = await registerRes.json()
  const uploadUrl =
    registerData.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest']
      .uploadUrl
  const asset = registerData.value.asset

  // Step 2: Download image
  const imageRes = await fetch(imageUrl)
  if (!imageRes.ok) throw new Error(`Failed to download image: ${imageUrl}`)
  const imageBuffer = Buffer.from(await imageRes.arrayBuffer())

  // Step 3: Upload binary to LinkedIn
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/octet-stream',
    },
    body: imageBuffer,
  })

  if (!uploadRes.ok) {
    const errText = await uploadRes.text()
    throw new Error(`LinkedIn image upload failed (${uploadRes.status}): ${errText}`)
  }

  return asset
}

function parseLinkedInError(responseText: string): string {
  try {
    const parsed = JSON.parse(responseText)
    return parsed.message ?? parsed.error ?? responseText
  } catch {
    return responseText.slice(0, 500)
  }
}

export async function publishToLinkedIn(postId: string): Promise<string> {
  const post = await db.post.findUnique({
    where: { id: postId },
    include: { persona: true },
  })

  if (!post) throw new Error(`Post ${postId} not found`)
  if (post.statut !== 'approved') throw new Error(`Post ${postId} is not approved`)

  const accessToken = await getLinkedInAccessToken()
  const personId = await getLinkedInPersonId(accessToken)
  const authorUrn = `urn:li:person:${personId}`

  // Build share content — with or without image
  let shareMediaCategory = 'NONE'
  const media: Array<{
    status: string
    media: string
    description?: { text: string }
  }> = []

  if (post.mediaUrl) {
    try {
      const asset = await uploadImageToLinkedIn(accessToken, personId, post.mediaUrl)
      shareMediaCategory = 'IMAGE'
      media.push({
        status: 'READY',
        media: asset,
        description: { text: post.contenu.slice(0, 100) },
      })
    } catch (err) {
      console.error('Image upload failed, publishing as text-only:', err)
      // Fallback to text-only post
    }
  }

  const shareContent: Record<string, unknown> = {
    shareCommentary: { text: post.contenu },
    shareMediaCategory,
  }
  if (media.length > 0) {
    shareContent.media = media
  }

  const postBody = {
    author: authorUrn,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': shareContent,
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
    const errorText = await publishRes.text()
    const parsed = parseLinkedInError(errorText)
    throw new Error(`LinkedIn publish failed (${publishRes.status}): ${parsed}`)
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
    hasImage: !!post.mediaUrl,
  }))

  return externalId
}
