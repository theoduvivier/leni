import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')

  if (error) {
    return NextResponse.redirect(new URL(`/?error=${error}`, process.env.NEXTAUTH_URL))
  }

  if (!code) {
    return NextResponse.redirect(new URL('/?error=no_code', process.env.NEXTAUTH_URL))
  }

  try {
    const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
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

    if (!tokenRes.ok) {
      const errorText = await tokenRes.text()
      console.error('LinkedIn token exchange failed:', errorText)
      return NextResponse.redirect(new URL('/?error=token_exchange_failed', process.env.NEXTAUTH_URL))
    }

    const tokenData = await tokenRes.json()

    // In production, encrypt and store the token
    // const encrypted = encryptToken(tokenData.access_token)
    // await db.setting.upsert(...)

    console.log('LinkedIn OAuth successful, token received')

    return NextResponse.redirect(new URL('/?linkedin=connected', process.env.NEXTAUTH_URL))
  } catch (err) {
    console.error('LinkedIn callback error:', err)
    return NextResponse.redirect(new URL('/?error=callback_failed', process.env.NEXTAUTH_URL))
  }
}
