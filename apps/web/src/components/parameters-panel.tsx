'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronDown, ChevronRight, Save, Loader2, Check, Plus, Trash2 } from 'lucide-react'

interface ParametersPanelProps {
  personaSlug: string
  postType: string
}

interface PersonaData {
  id: string
  slug: string
  nom: string
  config: Record<string, unknown>
  regles: string
  faq: Array<{ question: string; reponse: string }>
}

interface SkillData {
  id: string
  nom: string
  contenu: string
  version: string
  plateforme: string
}

const skillMap: Record<string, string> = {
  post_texte: 'linkedin_post_texte',
  comment_trigger: 'linkedin_comment_trigger',
  ghostwriter: 'linkedin_ghostwriter',
  post_image: 'linkedin_post_image',
  deal_case_study: 'deal_case_study',
  instagram_caption: 'instagram_caption',
  instagram_story: 'instagram_story',
}

type SectionKey = 'config' | 'regles' | 'faq' | 'context' | 'skill' | 'model'

export function ParametersPanel({ personaSlug, postType }: ParametersPanelProps) {
  const [persona, setPersona] = useState<PersonaData | null>(null)
  const [contextLive, setContextLive] = useState<Record<string, string>>({})
  const [skill, setSkill] = useState<SkillData | null>(null)
  const [loading, setLoading] = useState(true)

  const [expanded, setExpanded] = useState<SectionKey | null>(null)
  const [editing, setEditing] = useState<SectionKey | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<SectionKey | null>(null)

  // Edit drafts
  const [configDraft, setConfigDraft] = useState('')
  const [reglesDraft, setReglesDraft] = useState('')
  const [faqDraft, setFaqDraft] = useState<Array<{ question: string; reponse: string }>>([])
  const [contextDraft, setContextDraft] = useState<Record<string, string>>({})
  const [skillDraft, setSkillDraft] = useState('')

  const fetchPersona = useCallback(async () => {
    try {
      const res = await fetch(`/api/personas/${personaSlug}/context`)
      if (res.ok) {
        const data = await res.json()
        setPersona(data.persona)
        setContextLive(data.contextLive ?? {})
      }
    } catch { /* ignore */ }
  }, [personaSlug])

  const fetchSkill = useCallback(async () => {
    const skillNom = skillMap[postType]
    if (!skillNom) { setSkill(null); return }
    try {
      const res = await fetch(`/api/skills?nom=${skillNom}`)
      if (res.ok) {
        const data = await res.json()
        setSkill(data.skill ?? null)
      }
    } catch { /* ignore */ }
  }, [postType])

  useEffect(() => {
    setLoading(true)
    setExpanded(null)
    setEditing(null)
    Promise.all([fetchPersona(), fetchSkill()]).finally(() => setLoading(false))
  }, [fetchPersona, fetchSkill])

  function toggleSection(key: SectionKey) {
    if (editing) return
    setExpanded(expanded === key ? null : key)
  }

  function startEdit(key: SectionKey) {
    if (key === 'config') setConfigDraft(JSON.stringify(persona?.config ?? {}, null, 2))
    if (key === 'regles') setReglesDraft(persona?.regles ?? '')
    if (key === 'faq') setFaqDraft([...(persona?.faq ?? [])])
    if (key === 'context') setContextDraft({ ...contextLive })
    if (key === 'skill') setSkillDraft(skill?.contenu ?? '')
    setEditing(key)
    setExpanded(key)
  }

  function cancelEdit() {
    setEditing(null)
  }

  async function saveEdit(key: SectionKey) {
    setSaving(true)
    try {
      if (key === 'config') {
        const parsed = JSON.parse(configDraft)
        const res = await fetch(`/api/personas/${personaSlug}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ config: parsed }),
        })
        if (res.ok) setPersona((p) => p ? { ...p, config: parsed } : p)
      }
      if (key === 'regles') {
        const res = await fetch(`/api/personas/${personaSlug}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ regles: reglesDraft }),
        })
        if (res.ok) setPersona((p) => p ? { ...p, regles: reglesDraft } : p)
      }
      if (key === 'faq') {
        const res = await fetch(`/api/personas/${personaSlug}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ faq: faqDraft }),
        })
        if (res.ok) setPersona((p) => p ? { ...p, faq: faqDraft } : p)
      }
      if (key === 'context') {
        const res = await fetch(`/api/personas/${personaSlug}/context`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: contextDraft }),
        })
        if (res.ok) setContextLive({ ...contextDraft })
      }
      if (key === 'skill' && skill) {
        const res = await fetch(`/api/skills/${skill.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contenu: skillDraft }),
        })
        if (res.ok) {
          const data = await res.json()
          setSkill(data.skill)
        }
      }
      setEditing(null)
      setSaved(key)
      setTimeout(() => setSaved(null), 2000)
    } catch { /* ignore */ }
    finally { setSaving(false) }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-white/30" />
      </div>
    )
  }

  const sections: { key: SectionKey; label: string; badge: string }[] = [
    { key: 'config', label: 'Persona config', badge: persona?.nom ?? personaSlug },
    { key: 'regles', label: 'Règles', badge: persona?.regles ? `${persona.regles.split('\n').length} lignes` : '0' },
    { key: 'faq', label: 'FAQ', badge: `${persona?.faq?.length ?? 0} entrées` },
    { key: 'context', label: 'Données live', badge: `${Object.keys(contextLive).length} champs` },
    { key: 'skill', label: 'Skill actif', badge: skill ? `${skill.nom} v${skill.version}` : 'Aucun' },
  ]

  return (
    <div className="space-y-2">
      {sections.map((section) => {
        const isExpanded = expanded === section.key
        const isEditing = editing === section.key
        const isSaved = saved === section.key

        return (
          <div key={section.key} className="glass rounded-xl overflow-hidden">
            {/* Header */}
            <button
              onClick={() => toggleSection(section.key)}
              className="w-full flex items-center justify-between px-4 py-3 transition-colors hover:bg-white/[0.02]"
            >
              <div className="flex items-center gap-2.5">
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-white/25" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-white/25" />
                )}
                <span className="text-[13px] font-bold text-white/70">{section.label}</span>
              </div>
              <div className="flex items-center gap-2">
                {isSaved && <Check className="h-3.5 w-3.5 text-accent-teal" />}
                <span className="text-[11px] font-medium text-white/25">{section.badge}</span>
              </div>
            </button>

            {/* Content */}
            {isExpanded && (
              <div className="px-4 pb-4">
                {/* Edit/Cancel/Save toolbar */}
                <div className="flex items-center justify-end gap-2 mb-3">
                  {!isEditing ? (
                    <button
                      onClick={() => startEdit(section.key)}
                      className="text-[11px] font-bold text-accent-blue hover:text-accent-blue/80 transition-colors"
                    >
                      Modifier
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={cancelEdit}
                        className="text-[11px] font-bold text-white/30 hover:text-white/60 transition-colors"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={() => saveEdit(section.key)}
                        disabled={saving}
                        className="flex items-center gap-1 text-[11px] font-bold text-accent-teal hover:text-accent-teal/80 transition-colors disabled:opacity-50"
                      >
                        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                        Sauver
                      </button>
                    </>
                  )}
                </div>

                {/* Section-specific content */}
                {section.key === 'config' && (
                  isEditing ? (
                    <textarea
                      value={configDraft}
                      onChange={(e) => setConfigDraft(e.target.value)}
                      rows={12}
                      className="w-full rounded-lg bg-white/[0.04] border border-white/[0.1] px-3 py-2.5 text-[12px] text-white/60 font-mono focus:outline-none focus:border-accent-blue/40 transition-all resize-y"
                    />
                  ) : (
                    <pre className="text-[12px] text-white/50 bg-white/[0.03] rounded-lg p-3 overflow-x-auto whitespace-pre-wrap font-mono max-h-64 overflow-y-auto">
                      {JSON.stringify(persona?.config ?? {}, null, 2)}
                    </pre>
                  )
                )}

                {section.key === 'regles' && (
                  isEditing ? (
                    <textarea
                      value={reglesDraft}
                      onChange={(e) => setReglesDraft(e.target.value)}
                      rows={8}
                      className="w-full rounded-lg bg-white/[0.04] border border-white/[0.1] px-3 py-2.5 text-[12px] text-white/60 font-mono focus:outline-none focus:border-accent-blue/40 transition-all resize-y"
                    />
                  ) : (
                    <pre className="text-[12px] text-white/50 bg-white/[0.03] rounded-lg p-3 overflow-x-auto whitespace-pre-wrap font-mono max-h-64 overflow-y-auto">
                      {persona?.regles || 'Aucune règle définie'}
                    </pre>
                  )
                )}

                {section.key === 'faq' && (
                  isEditing ? (
                    <div className="space-y-2">
                      {faqDraft.map((f, i) => (
                        <div key={i} className="bg-white/[0.03] rounded-lg p-3 space-y-2">
                          <div className="flex items-start gap-2">
                            <span className="text-[11px] font-bold text-accent-blue shrink-0 mt-1.5">Q:</span>
                            <input
                              value={f.question}
                              onChange={(e) => {
                                const next = [...faqDraft]
                                next[i] = { ...next[i], question: e.target.value }
                                setFaqDraft(next)
                              }}
                              className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1.5 text-[12px] text-white/60 focus:outline-none focus:border-accent-blue/40"
                            />
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-[11px] font-bold text-white/30 shrink-0 mt-1.5">R:</span>
                            <textarea
                              value={f.reponse}
                              onChange={(e) => {
                                const next = [...faqDraft]
                                next[i] = { ...next[i], reponse: e.target.value }
                                setFaqDraft(next)
                              }}
                              rows={2}
                              className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1.5 text-[12px] text-white/60 focus:outline-none focus:border-accent-blue/40 resize-y"
                            />
                          </div>
                          <button
                            onClick={() => setFaqDraft(faqDraft.filter((_, j) => j !== i))}
                            className="flex items-center gap-1 text-[10px] font-bold text-red-400/60 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="h-3 w-3" /> Supprimer
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => setFaqDraft([...faqDraft, { question: '', reponse: '' }])}
                        className="flex items-center gap-1 text-[11px] font-bold text-accent-blue hover:text-accent-blue/80 transition-colors"
                      >
                        <Plus className="h-3 w-3" /> Ajouter une entrée
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {(persona?.faq ?? []).length > 0 ? (
                        (persona?.faq ?? []).map((f, i) => (
                          <div key={i} className="bg-white/[0.03] rounded-lg p-3">
                            <p className="text-[12px] font-bold text-accent-blue">Q: {f.question}</p>
                            <p className="text-[12px] text-white/50 mt-1">R: {f.reponse}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-[12px] text-white/25">Aucune FAQ</p>
                      )}
                    </div>
                  )
                )}

                {section.key === 'context' && (
                  isEditing ? (
                    <div className="space-y-2">
                      {Object.entries(contextDraft).map(([key, value]) => (
                        <div key={key} className="flex items-center gap-3">
                          <span className="text-[12px] font-semibold text-white/50 shrink-0 w-40 truncate">{key}</span>
                          <input
                            value={value}
                            onChange={(e) => setContextDraft({ ...contextDraft, [key]: e.target.value })}
                            className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1.5 text-[12px] text-white/60 focus:outline-none focus:border-accent-blue/40"
                          />
                          <button
                            onClick={() => {
                              const next = { ...contextDraft }
                              delete next[key]
                              setContextDraft(next)
                            }}
                            className="text-white/20 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => setContextDraft({ ...contextDraft, ['nouveau_champ']: '' })}
                        className="flex items-center gap-1 text-[11px] font-bold text-accent-blue hover:text-accent-blue/80 transition-colors"
                      >
                        <Plus className="h-3 w-3" /> Ajouter un champ
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {Object.entries(contextLive).length > 0 ? (
                        Object.entries(contextLive).map(([key, value]) => (
                          <div key={key} className="flex items-center justify-between py-1.5">
                            <span className="text-[12px] font-semibold text-white/50">{key}</span>
                            <span className="text-[12px] text-white/70 font-medium">{value || '—'}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-[12px] text-white/25">Aucune donnée live</p>
                      )}
                    </div>
                  )
                )}

                {section.key === 'skill' && (
                  isEditing ? (
                    <textarea
                      value={skillDraft}
                      onChange={(e) => setSkillDraft(e.target.value)}
                      rows={16}
                      className="w-full rounded-lg bg-white/[0.04] border border-white/[0.1] px-3 py-2.5 text-[12px] text-white/60 font-mono focus:outline-none focus:border-accent-blue/40 transition-all resize-y"
                    />
                  ) : skill ? (
                    <pre className="text-[12px] text-white/50 bg-white/[0.03] rounded-lg p-3 overflow-x-auto whitespace-pre-wrap font-mono max-h-80 overflow-y-auto">
                      {skill.contenu}
                    </pre>
                  ) : (
                    <p className="text-[12px] text-white/25">Aucune skill pour ce type de post</p>
                  )
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
