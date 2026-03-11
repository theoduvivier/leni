import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { LoginForm } from './login-form'

export default async function LoginPage() {
  const session = await getSession()
  if (session.isLoggedIn) {
    redirect('/')
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="glass glow-blue animate-scale-in w-full max-w-sm rounded-2xl p-8">
        <div className="mb-8 flex flex-col items-center gap-3">
          <img
            src="/leni-mascot.png"
            alt="Leni"
            width={80}
            height={80}
            className="rounded-2xl drop-shadow-lg animate-float"
          />
          <div className="text-center">
            <h1 className="font-display text-2xl font-bold tracking-tight text-white">
              Leni
            </h1>
            <p className="text-sm text-white/40">Agent Social Media</p>
          </div>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
