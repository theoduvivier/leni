import { NextResponse } from 'next/server'
import { db } from '@leni/db'
import { createCipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY
  if (!key || key.length < 32) {
    throw new Error('ENCRYPTION_KEY must be at least 32 characters')
  }
  return Buffer.from(key.slice(0, 32), 'utf-8')
}

function encryptToken(token: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(16)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(token, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

function getBaseUrl(request: Request): string {
  const url = new URL(request.url)
  return `${url.protocol}//${url.host}`
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')
  const baseUrl = getBaseUrl(request)

  if (error) {
    return NextResponse.redirect(new URL(`/contexte?linkedin=error&detail=${error}`, baseUrl))
  }

  if (!code) {
    return NextResponse.redirect(new URL('/contexte?linkedin=error&detail=no_code', baseUrl))
  }

  try {
    const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${baseUrl}/api/linkedin/callback`,
        client_id: process.env.LINKEDIN_CLIENT_ID ?? '',
        client_secret: process.env.LINKEDIN_CLIENT_SECRET ?? '',
      }),
    })

    if (!tokenRes.ok) {
      const errorText = await tokenRes.text()
      console.error('LinkedIn token exchange failed:', errorText)
      return NextResponse.redirect(new URL('/contexte?linkedin=error&detail=token_exchange_failed', baseUrl))
    }

    const tokenData = await tokenRes.json()
    const accessToken = tokenData.access_token as string
    const expiresIn = tokenData.expires_in as number

    // Fetch LinkedIn profile info
    let profileName: string | null = null
    let profileImage: string | null = null
    try {
      const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (profileRes.ok) {
        const profile = await profileRes.json()
        profileName = profile.name ?? null
        profileImage = profile.picture ?? null
      }
    } catch {
      // Profile fetch is non-critical
    }

    // Encrypt and store token
    const encryptedToken = encryptToken(accessToken)
    const expiresAt = new Date(Date.now() + expiresIn * 1000)

    await db.oAuthToken.upsert({
      where: { provider: 'linkedin' },
      create: {
        provider: 'linkedin',
        accessToken: encryptedToken,
        refreshToken: tokenData.refresh_token ? encryptToken(tokenData.refresh_token) : null,
        expiresAt,
        profileName,
        profileImage,
      },
      update: {
        accessToken: encryptedToken,
        refreshToken: tokenData.refresh_token ? encryptToken(tokenData.refresh_token) : null,
        expiresAt,
        profileName,
        profileImage,
      },
    })

    console.log('LinkedIn OAuth successful, token stored in DB', { expiresIn, profileName })

    return NextResponse.redirect(new URL('/contexte?linkedin=connected', baseUrl))
  } catch (err) {
    console.error('LinkedIn callback error:', err)
    return NextResponse.redirect(new URL('/contexte?linkedin=error&detail=callback_failed', baseUrl))
  }
}
