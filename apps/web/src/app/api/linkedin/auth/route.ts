import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'

export async function POST() {
  const clientId = process.env.LINKEDIN_CLIENT_ID
  if (!clientId) {
    return NextResponse.json({ error: 'LinkedIn client ID not configured' }, { status: 500 })
  }

  const redirectUri = `${process.env.NEXTAUTH_URL}/api/linkedin/callback`
  const scope = 'openid profile w_member_social'
  const state = randomBytes(16).toString('hex')

  const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=${encodeURIComponent(scope)}`

  // Store state in a cookie for CSRF validation in callback
  const response = NextResponse.json({ authUrl, state })
  response.cookies.set('linkedin_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  })

  return response
}
