'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Cpu, Save, X, Check, Linkedin, Unlink, Loader2, ExternalLink, ChevronDown, ChevronRight, Eye } from 'lucide-react'

interface PersonaData {
  id: string
  slug: string
  nom: string
  config: Record<string, unknown>
  regles: string
  faq: Record<string, unknown>
  contextLive: { data: Record<string, string> } | null
}

interface SkillData {
  id: string
  nom: string
  version: string
  plateforme: string
  actif: boolean
  updatedAt: string
}

const skillDisplayNames: Record<string, string> = {
  linkedin_post_texte: 'Post texte',
  linkedin_post_image: 'Post image',
  linkedin_comment_trigger: 'Comment trigger',
  linkedin_ghostwriter: 'Ghostwriter',
  instagram_caption: 'Caption',
  instagram_story: 'Story',
  deal_case_study: 'Case study',
  comment_reply: 'Comment reply',
}

const platformFromSkill: Record<string, string> = {
  linkedin_post_texte: 'LinkedIn',
  linkedin_post_image: 'LinkedIn',
  linkedin_comment_trigger: 'LinkedIn',
  linkedin_ghostwriter: 'LinkedIn',
  instagram_caption: 'Instagram',
  instagram_story: 'Instagram',
  deal_case_study: 'LinkedIn',
  comment_reply: 'LinkedIn',
}

interface LinkedInStatus {
  connected: boolean
  expired?: boolean
  profileName?: string | null
  profileImage?: string | null
  expiresAt?: string | null
  connectedAt?: string | null
}

export default function ContextePage() {
  return (
    <Suspense>
      <ContexteContent />
    </Suspense>
  )
}

function ContexteContent() {
  const searchParams = useSearchParams()
  const [personas, setPersonas] = useState<PersonaData[]>([])
  const [skills, setSkills] = useState<SkillData[]>([])
  const [editingContext, setEditingContext] = useState<string | null>(null)
  const [contextDraft, setContextDraft] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [expandedPersona, setExpandedPersona] = useState<string | null>(null)
  const [viewingSkill, setViewingSkill] = useState<{ id: string; nom: string; contenu: string } | null>(null)
  const [skillLoading, setSkillLoading] = useState(false)

  const [linkedIn, setLinkedIn] = useState<LinkedInStatus | null>(null)
  const [linkedInLoading, setLinkedInLoading] = useState(false)
  const [linkedInMessage, setLinkedInMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetch('/api/personas').then((r) => r.json()).then((d) => setPersonas(d.personas ?? [])).catch(() => {})
    fetch('/api/skills').then((r) => r.json()).then((d) => setSkills(d.skills ?? [])).catch(() => {})
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

  function startEditContext(slug: string, current: Record<string, string>) {
    setEditingContext(slug)
    setContextDraft({
      places_beta: current.places_beta ?? '',
      date_ouverture: current.date_ouverture ?? '',
      promo_en_cours: current.promo_en_cours ?? '',
      ...current,
    })
  }

  async function saveContext(slug: string) {
    setSaving(true)
    try {
      const res = await fetch(`/api/personas/${slug}/context`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: contextDraft }),
      })
      if (res.ok) {
        setPersonas((prev) =>
          prev.map((p) =>
            p.slug === slug ? { ...p, contextLive: { data: contextDraft } } : p
          )
        )
        setEditingContext(null)
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    } finally {
      setSaving(false)
    }
  }

  async function loadSkillContent(skillId: string, skillNom: string) {
    setSkillLoading(true)
    try {
      const res = await fetch(`/api/skills/${skillId}`)
      if (res.ok) {
        const data = await res.json()
        setViewingSkill({ id: skillId, nom: skillNom, contenu: data.skill?.contenu ?? '' })
      }
    } finally {
      setSkillLoading(false)
    }
  }

  const flipio = personas.find((p) => p.slug === 'flipio')
  const mdb = personas.find((p) => p.slug === 'mdb')

  return (
    <div className="px-5 py-8 md:px-10 md:py-12 max-w-6xl">
      {/* Header */}
      <div className="animate-fade-up">
        <p className="text-[13px] font-semibold text-purple-400 tracking-wide uppercase">Contexte</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-white md:text-4xl">
          Contexte & Personas
        </h1>
        <p className="mt-2 text-[15px] text-white/40 max-w-lg">
          Données live injectées dans chaque prompt IA.
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

      {/* Personas */}
      <div className="mt-10 animate-fade-up" style={{ animationDelay: '100ms' }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-lg font-bold tracking-tight text-white">Personas</h2>
          <span className="text-[12px] font-bold text-white/25">{personas.length} actifs</span>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 stagger">
          {flipio && (
            <PersonaCard
              persona={flipio}
              details={[
                { label: 'Cible', value: (flipio.config as Record<string, unknown>).cible && typeof (flipio.config as Record<string, unknown>).cible === 'object' ? ((flipio.config as Record<string, Record<string, string[]>>).cible.profils ?? []).join(', ') : 'Marchands de biens, promoteurs' },
                { label: 'Ton', value: (flipio.config as Record<string, unknown>).ton && typeof (flipio.config as Record<string, unknown>).ton === 'object' ? (flipio.config as Record<string, Record<string, string>>).ton.style : 'Direct, expert, provocateur' },
                { label: 'Stade', value: (flipio.config as Record<string, unknown>).identite && typeof (flipio.config as Record<string, unknown>).identite === 'object' ? (flipio.config as Record<string, Record<string, string>>).identite.stade : 'Bêta privée' },
              ]}
              color="blue"
            />
          )}
          {mdb && (
            <PersonaCard
              persona={mdb}
              details={[
                { label: 'Stratégie', value: extractConfigString(mdb.config, 'strategie', 'Division, bloc/détail, réno-revente') },
                { label: 'Ticket', value: extractConfigString(mdb.config, 'ticket', '300–800k€') },
                { label: 'Zone', value: extractConfigString(mdb.config, 'zone', 'Paris, petite couronne') },
              ]}
              color="teal"
            />
          )}
          {!flipio && !mdb && personas.map((p) => (
            <PersonaCard
              key={p.slug}
              persona={p}
              details={[]}
              color="blue"
            />
          ))}
        </div>
      </div>

      {/* Persona prompt details */}
      {personas.map((persona) => {
        const isExpanded = expandedPersona === persona.slug
        const faq = persona.faq as unknown as Array<{ question: string; reponse: string }> | null

        return (
          <div key={`prompt-${persona.slug}`} className="mt-6 animate-fade-up" style={{ animationDelay: '150ms' }}>
            <button
              onClick={() => setExpandedPersona(isExpanded ? null : persona.slug)}
              className="w-full flex items-center justify-between glass rounded-2xl p-5 transition-colors hover:bg-white/[0.03]"
            >
              <div className="flex items-center gap-3">
                <Eye className="h-4 w-4 text-white/30" />
                <span className="text-[14px] font-bold text-white/80">Prompt système — {persona.nom}</span>
              </div>
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-white/30" />
              ) : (
                <ChevronRight className="h-4 w-4 text-white/30" />
              )}
            </button>

            {isExpanded && (
              <div className="mt-2 glass rounded-2xl p-5 space-y-5">
                {/* Config */}
                <div>
                  <h4 className="text-[11px] font-bold text-white/25 uppercase tracking-wider mb-2">Config persona</h4>
                  <pre className="text-[12px] text-white/50 bg-white/[0.03] rounded-xl p-4 overflow-x-auto whitespace-pre-wrap font-mono">
                    {JSON.stringify(persona.config, null, 2)}
                  </pre>
                </div>

                {/* Règles */}
                <div>
                  <h4 className="text-[11px] font-bold text-white/25 uppercase tracking-wider mb-2">Règles</h4>
                  <pre className="text-[12px] text-white/50 bg-white/[0.03] rounded-xl p-4 overflow-x-auto whitespace-pre-wrap font-mono">
                    {persona.regles || 'Aucune règle définie'}
                  </pre>
                </div>

                {/* FAQ */}
                {faq && faq.length > 0 && (
                  <div>
                    <h4 className="text-[11px] font-bold text-white/25 uppercase tracking-wider mb-2">FAQ ({faq.length} entrées)</h4>
                    <div className="space-y-2">
                      {faq.map((f, i) => (
                        <div key={i} className="bg-white/[0.03] rounded-xl p-4">
                          <p className="text-[12px] font-bold text-accent-blue">Q: {f.question}</p>
                          <p className="text-[12px] text-white/50 mt-1">R: {f.reponse}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Live Context per persona */}
      {personas.map((persona) => {
        const ctx = (persona.contextLive?.data ?? {}) as Record<string, string>
        const isEditing = editingContext === persona.slug

        return (
          <div key={persona.slug} className="mt-12 animate-fade-up" style={{ animationDelay: '220ms' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg font-bold tracking-tight text-white">
                Données live — {persona.nom}
              </h2>
              {!isEditing ? (
                <button
                  onClick={() => startEditContext(persona.slug, ctx)}
                  className="text-[12px] font-bold text-accent-blue hover:text-accent-blue/80 transition-colors"
                >
                  Modifier
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditingContext(null)}
                    className="flex items-center gap-1 text-[12px] font-bold text-white/30 hover:text-white/60 transition-colors"
                  >
                    <X className="h-3 w-3" /> Annuler
                  </button>
                  <button
                    onClick={() => saveContext(persona.slug)}
                    disabled={saving}
                    className="flex items-center gap-1 text-[12px] font-bold text-accent-teal hover:text-accent-teal/80 transition-colors disabled:opacity-50"
                  >
                    <Save className="h-3 w-3" /> Sauver
                  </button>
                </div>
              )}
            </div>

            {saved && !isEditing && (
              <div className="mb-3 flex items-center gap-2 rounded-xl bg-accent-teal/10 border border-accent-teal/20 px-4 py-2.5 text-[13px] text-accent-teal">
                <Check className="h-4 w-4" /> Contexte sauvegardé
              </div>
            )}

            <div className="glass rounded-2xl overflow-hidden divide-y divide-white/[0.04]">
              {isEditing ? (
                <>
                  <ContextRowEdit label="Places bêta restantes" value={contextDraft.places_beta ?? ''} onChange={(v) => setContextDraft({ ...contextDraft, places_beta: v })} />
                  <ContextRowEdit label="Date ouverture publique" value={contextDraft.date_ouverture ?? ''} onChange={(v) => setContextDraft({ ...contextDraft, date_ouverture: v })} />
                  <ContextRowEdit label="Promo en cours" value={contextDraft.promo_en_cours ?? ''} onChange={(v) => setContextDraft({ ...contextDraft, promo_en_cours: v })} />
                </>
              ) : (
                <>
                  <ContextRow label="Places bêta restantes" value={ctx.places_beta} />
                  <ContextRow label="Date ouverture publique" value={ctx.date_ouverture} />
                  <ContextRow label="Promo en cours" value={ctx.promo_en_cours} />
                </>
              )}
            </div>
          </div>
        )
      })}

      {/* Skills */}
      <div className="mt-12 animate-fade-up" style={{ animationDelay: '340ms' }}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-white/20" />
            <h2 className="font-display text-lg font-bold tracking-tight text-white">Skills actifs</h2>
          </div>
          <span className="text-[12px] font-bold text-white/25">{skills.length} skills</span>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 stagger">
          {skills.map((skill) => (
            <SkillChip
              key={skill.id}
              name={skillDisplayNames[skill.nom] ?? skill.nom}
              platform={platformFromSkill[skill.nom] ?? skill.plateforme}
              version={skill.version}
              onClick={() => loadSkillContent(skill.id, skill.nom)}
            />
          ))}
          {skills.length === 0 && (
            <p className="col-span-full text-[13px] text-white/25 text-center py-8">Aucun skill actif</p>
          )}
        </div>

        {/* Skill content viewer */}
        {viewingSkill && (
          <div className="mt-4 glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[14px] font-bold text-white/80">
                {skillDisplayNames[viewingSkill.nom] ?? viewingSkill.nom}
              </h3>
              <button
                onClick={() => setViewingSkill(null)}
                className="text-[12px] font-bold text-white/30 hover:text-white/60 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <pre className="text-[12px] text-white/50 bg-white/[0.03] rounded-xl p-4 overflow-x-auto whitespace-pre-wrap font-mono max-h-96 overflow-y-auto">
              {viewingSkill.contenu}
            </pre>
          </div>
        )}
        {skillLoading && (
          <div className="mt-4 flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-white/30" />
          </div>
        )}
      </div>

    </div>
  )
}

function extractConfigString(config: Record<string, unknown>, key: string, fallback: string): string {
  const val = config[key]
  if (typeof val === 'string') return val
  if (Array.isArray(val)) return val.join(', ')
  if (val && typeof val === 'object') {
    const first = Object.values(val).find((v) => typeof v === 'string')
    if (typeof first === 'string') return first
    const arr = Object.values(val).find((v) => Array.isArray(v))
    if (Array.isArray(arr)) return arr.join(', ')
  }
  return fallback
}

function PersonaCard({ persona, details, color }: {
  persona: PersonaData
  details: { label: string; value: string }[]
  color: 'blue' | 'teal'
}) {
  const colors = {
    blue: { accent: 'text-accent-blue', bg: 'from-accent-blue/15 to-accent-blue/5' },
    teal: { accent: 'text-accent-teal', bg: 'from-accent-teal/15 to-accent-teal/5' },
  }
  const c = colors[color]

  return (
    <div className="animate-scale-in glass glass-hover rounded-2xl p-5 relative overflow-hidden">
      <div className="flex items-start gap-3.5 mb-4">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${c.bg} font-display font-extrabold text-sm ${c.accent}`}>
          {persona.nom[0]}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h3 className="text-[15px] font-bold text-white">{persona.nom}</h3>
            <span className="flex items-center gap-1.5 rounded-full bg-accent-teal/10 px-2.5 py-1 text-[10px] font-bold text-accent-teal">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-teal animate-pulse-soft" />
              Actif
            </span>
          </div>
          <p className="text-[12px] text-white/35 mt-0.5">{persona.slug}</p>
        </div>
      </div>

      <div className="h-px bg-white/[0.05] mb-4" />

      <div className="space-y-2.5">
        {details.map((d) => (
          <div key={d.label} className="flex items-baseline justify-between gap-3">
            <span className="text-[11px] font-bold text-white/20 uppercase tracking-wider shrink-0">{d.label}</span>
            <span className="text-[12px] font-semibold text-white/60 text-right">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ContextRow({ label, value }: { label: string; value?: string }) {
  const isEmpty = !value
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-white/[0.02]">
      <span className="text-[14px] font-semibold text-white/80">{label}</span>
      <span className={`text-[13px] ${isEmpty ? 'text-white/25' : 'font-semibold text-white/70'}`}>
        {value || 'Non configuré'}
      </span>
    </div>
  )
}

function ContextRowEdit({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3">
      <span className="text-[14px] font-semibold text-white/80 shrink-0">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Non configuré"
        className="w-48 rounded-lg bg-white/[0.06] border border-white/[0.1] px-3 py-2 text-[13px] text-white placeholder:text-white/20 focus:outline-none focus:border-accent-blue/40 transition-all text-right"
      />
    </div>
  )
}

function SkillChip({ name, platform, version, onClick }: { name: string; platform: string; version: string; onClick?: () => void }) {
  const platformColors: Record<string, string> = {
    LinkedIn: 'text-accent-blue bg-accent-blue/10',
    Instagram: 'text-accent-pink bg-accent-pink/10',
    Global: 'text-purple-400 bg-purple-400/10',
  }

  return (
    <button onClick={onClick} className="animate-scale-in glass glass-hover rounded-xl p-3.5 text-left w-full cursor-pointer transition-all hover:ring-1 hover:ring-white/10">
      <p className="text-[13px] font-bold text-white/80">{name}</p>
      <div className="mt-2 flex items-center gap-2">
        <span className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-bold ${platformColors[platform] ?? 'text-white/40 bg-white/[0.04]'}`}>
          {platform}
        </span>
        <span className="text-[10px] text-white/20">v{version}</span>
      </div>
    </button>
  )
}
