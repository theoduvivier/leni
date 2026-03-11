'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Lock } from 'lucide-react'

export function LoginForm() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Erreur de connexion')
        return
      }

      router.push('/')
      router.refresh()
    } catch {
      setError('Erreur réseau')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mot de passe"
          autoFocus
          required
          className="w-full rounded-xl border border-white/[0.08] bg-white/[0.06] py-3 pl-10 pr-4 text-sm text-white placeholder:text-white/30 transition-colors focus:border-accent-blue/50 focus:bg-white/[0.08] focus:outline-none focus:ring-1 focus:ring-accent-blue/30"
        />
      </div>

      {error && (
        <p className="animate-fade-up text-center text-sm font-medium text-red-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent-blue to-[#5b8aff] py-3 text-sm font-bold text-white shadow-lg shadow-accent-blue/25 transition-all duration-200 hover:shadow-accent-blue/40 hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
      >
        {loading ? (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        ) : (
          'Se connecter'
        )}
      </button>
    </form>
  )
}
