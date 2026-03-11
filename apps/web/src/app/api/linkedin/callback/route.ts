import { NextResponse } from 'next/server'

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
    return NextResponse.redirect(new URL(`/?error=${error}`, baseUrl))
  }

  if (!code) {
    return NextResponse.redirect(new URL('/?error=no_code', baseUrl))
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
      return NextResponse.redirect(new URL('/?error=token_exchange_failed', baseUrl))
    }

    const tokenData = await tokenRes.json()

    // In production, encrypt and store the token
    console.log('LinkedIn OAuth successful, token received', { expiresIn: tokenData.expires_in })

    return NextResponse.redirect(new URL('/?linkedin=connected', baseUrl))
  } catch (err) {
    console.error('LinkedIn callback error:', err)
    return NextResponse.redirect(new URL('/?error=callback_failed', baseUrl))
  }
}
