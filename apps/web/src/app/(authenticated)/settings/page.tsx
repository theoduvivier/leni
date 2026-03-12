'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Check, Linkedin, Unlink, Loader2, ExternalLink } from 'lucide-react'

interface LinkedInStatus {
  connected: boolean
  expired?: boolean
  profileName?: string | null
  profileImage?: string | null
  expiresAt?: string | null
  connectedAt?: string | null
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsContent />
    </Suspense>
  )
}

function SettingsContent() {
  const searchParams = useSearchParams()
  const [linkedIn, setLinkedIn] = useState<LinkedInStatus | null>(null)
  const [linkedInLoading, setLinkedInLoading] = useState(false)
  const [linkedInMessage, setLinkedInMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetchLinkedInStatus()
  }, [])

  useEffect(() => {
    const li = searchParams.get('linkedin')
    if (li === 'connected') {
      setLinkedInMessage({ type: 'success', text: 'LinkedIn connecté avec succès !' })
      fetchLinkedInStatus()
      setTimeout(() => setLinkedInMessage(null), 5000)
    } else if (li === 'error') {
      const detail = searchParams.get('detail') ?? 'unknown'
      setLinkedInMessage({ type: 'error', text: `Erreur de connexion LinkedIn : ${detail}` })
      setTimeout(() => setLinkedInMessage(null), 5000)
    }
  }, [searchParams])

  function fetchLinkedInStatus() {
    fetch('/api/linkedin/status').then((r) => r.json()).then(setLinkedIn).catch(() => setLinkedIn({ connected: false }))
  }

  async function connectLinkedIn() {
    setLinkedInLoading(true)
    try {
      const res = await fetch('/api/linkedin/auth', { method: 'POST' })
      const data = await res.json()
      if (data.authUrl) {
        window.location.href = data.authUrl
      }
    } catch {
      setLinkedInMessage({ type: 'error', text: 'Impossible de lancer la connexion LinkedIn' })
      setLinkedInLoading(false)
    }
  }

  async function disconnectLinkedIn() {
    setLinkedInLoading(true)
    try {
      await fetch('/api/linkedin/status', { method: 'DELETE' })
      setLinkedIn({ connected: false })
      setLinkedInMessage({ type: 'success', text: 'LinkedIn déconnecté' })
      setTimeout(() => setLinkedInMessage(null), 3000)
    } finally {
      setLinkedInLoading(false)
    }
  }

  return (
    <div className="px-5 py-8 md:px-10 md:py-12 max-w-3xl">
      <div className="animate-fade-up">
        <h1 className="font-display text-3xl font-bold tracking-tight text-white md:text-4xl">
          Réglages
        </h1>
        <p className="mt-2 text-[15px] text-white/40">
          Connexions et configuration.
        </p>
      </div>

      {/* LinkedIn connection */}
      <div className="mt-10 animate-fade-up" style={{ animationDelay: '80ms' }}>
        <h2 className="font-display text-lg font-bold tracking-tight text-white mb-5">Connexions</h2>

        {linkedInMessage && (
          <div className={`mb-3 flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[13px] ${
            linkedInMessage.type === 'success'
              ? 'bg-accent-teal/10 border-accent-teal/20 text-accent-teal'
              : 'bg-red-400/10 border-red-400/20 text-red-400'
          }`}>
            <Check className="h-4 w-4 shrink-0" />
            {linkedInMessage.text}
          </div>
        )}

        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0A66C2]/15">
                <Linkedin className="h-5 w-5 text-[#0A66C2]" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className="text-[15px] font-bold text-white">LinkedIn</h3>
                  {linkedIn?.connected && (
                    <span className="flex items-center gap-1.5 rounded-full bg-accent-teal/10 px-2.5 py-1 text-[10px] font-bold text-accent-teal">
                      <span className="h-1.5 w-1.5 rounded-full bg-accent-teal animate-pulse-soft" />
                      Connecté
                    </span>
                  )}
                  {linkedIn?.expired && (
                    <span className="flex items-center gap-1.5 rounded-full bg-amber-400/10 px-2.5 py-1 text-[10px] font-bold text-amber-400">
                      Expiré
                    </span>
                  )}
                  {linkedIn && !linkedIn.connected && !linkedIn.expired && (
                    <span className="flex items-center gap-1.5 rounded-full bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold text-white/40">
                      Non connecté
                    </span>
                  )}
                </div>
                {linkedIn?.connected && linkedIn.profileName && (
                  <p className="text-[12px] text-white/40 mt-0.5">{linkedIn.profileName}</p>
                )}
                {linkedIn?.connected && linkedIn.expiresAt && (
                  <p className="text-[11px] text-white/25 mt-0.5">
                    Expire le {new Date(linkedIn.expiresAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {linkedIn?.connected ? (
                <button
                  onClick={disconnectLinkedIn}
                  disabled={linkedInLoading}
                  className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] px-3.5 py-2 text-[12px] font-bold text-white/40 transition-colors hover:text-red-400 hover:border-red-400/20 disabled:opacity-50"
                >
                  {linkedInLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlink className="h-3.5 w-3.5" />}
                  Déconnecter
                </button>
              ) : (
                <button
                  onClick={connectLinkedIn}
                  disabled={linkedInLoading}
                  className="flex items-center gap-1.5 rounded-xl bg-[#0A66C2] px-4 py-2.5 text-[12px] font-bold text-white transition-all hover:brightness-110 disabled:opacity-50"
                >
                  {linkedInLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
                  Connecter LinkedIn
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
