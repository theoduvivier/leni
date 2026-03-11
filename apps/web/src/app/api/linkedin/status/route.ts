import { NextResponse } from 'next/server'
import { db } from '@leni/db'

export async function GET() {
  try {
    const token = await db.oAuthToken.findUnique({
      where: { provider: 'linkedin' },
      select: {
        profileName: true,
        profileImage: true,
        expiresAt: true,
        updatedAt: true,
      },
    })

    if (!token) {
      return NextResponse.json({ connected: false })
    }

    const expired = token.expiresAt ? token.expiresAt < new Date() : false

    return NextResponse.json({
      connected: !expired,
      expired,
      profileName: token.profileName,
      profileImage: token.profileImage,
      expiresAt: token.expiresAt?.toISOString() ?? null,
      connectedAt: token.updatedAt.toISOString(),
    })
  } catch (err) {
    console.error('LinkedIn status error:', err)
    return NextResponse.json({ connected: false })
  }
}

export async function DELETE() {
  try {
    await db.oAuthToken.delete({ where: { provider: 'linkedin' } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: true })
  }
}
