import { NextResponse, NextRequest } from 'next/server'
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

function redirectTo(request: NextRequest, path: string): NextResponse {
  // Build absolute URL from the request origin
  const origin = request.nextUrl.origin
  return NextResponse.redirect(new URL(path, origin))
}

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get('code')
    const error = request.nextUrl.searchParams.get('error')
    const state = request.nextUrl.searchParams.get('state')

    console.log('LinkedIn callback hit', { hasCode: !!code, hasError: !!error, hasState: !!state })

    if (error) {
      return redirectTo(request, `/settings?linkedin=error&detail=${error}`)
    }

    if (!code) {
      return redirectTo(request, '/settings?linkedin=error&detail=no_code')
    }

    // CSRF validation: compare state param with cookie
    const storedState = request.cookies.get('linkedin_oauth_state')?.value
    if (!state || !storedState || state !== storedState) {
      console.error('LinkedIn CSRF mismatch', { hasState: !!state, hasStoredState: !!storedState, match: state === storedState })
      return redirectTo(request, '/settings?linkedin=error&detail=invalid_state')
    }

    // Use NEXTAUTH_URL for redirect_uri — must match exactly what was sent in /api/linkedin/auth
    const baseUrl = process.env.NEXTAUTH_URL ?? request.nextUrl.origin
    const redirectUri = `${baseUrl}/api/linkedin/callback`

    console.log('LinkedIn token exchange starting', { redirectUri })

    const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: process.env.LINKEDIN_CLIENT_ID ?? '',
        client_secret: process.env.LINKEDIN_CLIENT_SECRET ?? '',
      }),
    })

    if (!tokenRes.ok) {
      const errorText = await tokenRes.text()
      console.error('LinkedIn token exchange failed:', tokenRes.status, errorText)
      return redirectTo(request, '/settings?linkedin=error&detail=token_exchange_failed')
    }

    const tokenData = await tokenRes.json()
    const accessToken = tokenData.access_token as string
    const expiresIn = tokenData.expires_in as number

    console.log('LinkedIn token obtained', { expiresIn })

    // Fetch LinkedIn profile info (non-critical)
    let profileName: string | null = null
    let profileImage: string | null = null
    try {
      const userinfoRes = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (userinfoRes.ok) {
        const profile = await userinfoRes.json()
        profileName = profile.name ?? null
        profileImage = profile.picture ?? null
      } else {
        const meRes = await fetch('https://api.linkedin.com/v2/me', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'X-Restli-Protocol-Version': '2.0.0',
          },
        })
        if (meRes.ok) {
          const profile = await meRes.json()
          profileName = [profile.localizedFirstName, profile.localizedLastName].filter(Boolean).join(' ') || null
        }
      }
    } catch (profileErr) {
      console.error('LinkedIn profile fetch failed (non-critical):', profileErr)
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

    const redirectRes = redirectTo(request, '/settings?linkedin=connected')
    redirectRes.cookies.delete('linkedin_oauth_state')
    return redirectRes
  } catch (err) {
    console.error('LinkedIn callback UNHANDLED error:', err)
    try {
      const redirectRes = redirectTo(request, '/settings?linkedin=error&detail=callback_failed')
      redirectRes.cookies.delete('linkedin_oauth_state')
      return redirectRes
    } catch {
      // Last resort: return JSON if even redirect fails
      return NextResponse.json(
        { error: 'LinkedIn callback failed', detail: err instanceof Error ? err.message : 'unknown' },
        { status: 500 }
      )
    }
  }
}
