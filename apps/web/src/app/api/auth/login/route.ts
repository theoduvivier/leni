import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession, verifyPassword } from '@/lib/auth'

const loginSchema = z.object({
  password: z.string().min(1),
})

// Simple in-memory rate limiter
const attempts = new Map<string, { count: number; resetAt: number }>()
const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000 // 15 minutes

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const record = attempts.get(ip)

  if (!record || now > record.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }

  record.count++
  return record.count > MAX_ATTEMPTS
}

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: 'Trop de tentatives. Réessaie dans 15 minutes.' },
      { status: 429 }
    )
  }

  const body = await request.json().catch(() => null)
  const parsed = loginSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Mot de passe requis' }, { status: 400 })
  }

  const valid = await verifyPassword(parsed.data.password)

  if (!valid) {
    // Fixed delay to prevent timing attacks
    await new Promise((r) => setTimeout(r, 500))
    return NextResponse.json(
      { error: 'Mot de passe incorrect' },
      { status: 401 }
    )
  }

  const session = await getSession()
  session.isLoggedIn = true
  await session.save()

  return NextResponse.json({ ok: true })
}
