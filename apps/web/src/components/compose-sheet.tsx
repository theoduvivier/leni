'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { X, Loader2, Sparkles, Copy, Check, Clock, CalendarDays, Upload, Image as ImageIcon, Trash2 } from 'lucide-react'

interface ComposeSheetProps {
  open: boolean
  onClose: () => void
  defaultType?: string
}

type PostType = 'post_texte' | 'comment_trigger' | 'ghostwriter' | 'post_image' | 'deal_case_study' | 'instagram_caption' | 'instagram_story'
type Platform = 'linkedin' | 'instagram'
type Persona = 'flipio' | 'mdb'
type Step = 'config' | 'generating' | 'review' | 'schedule'

const linkedInTypes: { value: PostType; label: string; description: string }[] = [
  { value: 'post_texte', label: 'Post texte', description: 'Post LinkedIn optimisé 900-1100 car.' },
  { value: 'comment_trigger', label: 'Post viral', description: '3 variantes comment trigger' },
  { value: 'ghostwriter', label: 'Ghostwriter', description: 'Long format pédagogique' },
  { value: 'post_image', label: 'Post image', description: 'Post avec visuel' },
  { value: 'deal_case_study', label: 'Case Study', description: 'Deal avant/après + chiffres' },
]

const instagramTypes: { value: PostType; label: string; description: string }[] = [
  { value: 'instagram_caption', label: 'Caption', description: 'Photo + caption + hashtags' },
  { value: 'instagram_story', label: 'Story', description: 'Texte overlay vertical 1080x1920' },
  { value: 'deal_case_study', label: 'Case Study', description: 'Carrousel avant/après' },
]

const personas: { value: Persona; label: string }[] = [
  { value: 'flipio', label: 'Flipio' },
  { value: 'mdb', label: 'MdB Perso' },
]

const strategies = ['Division', 'Bloc/détail', 'Rénovation-revente', 'Surélévation', 'Autre']

interface UploadedFile {
  id: string
  filename: string
  url: string
}

export function ComposeSheet({ open, onClose, defaultType }: ComposeSheetProps) {
  const [step, setStep] = useState<Step>('config')
  const [type, setType] = useState<PostType>('post_texte')
  const [platform, setPlatform] = useState<Platform>('linkedin')
  const [persona, setPersona] = useState<Persona>('flipio')
  const [brief, setBrief] = useState('')
  const [jobId, setJobId] = useState<string | null>(null)
  const [postId, setPostId] = useState<string | null>(null)
  const [generatedContent, setGeneratedContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('09:00')
  const [scheduling, setScheduling] = useState(false)
  const [scheduled, setScheduled] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [published, setPublished] = useState(false)

  // Deal case study fields
  const [dealCity, setDealCity] = useState('')
  const [dealStrategy, setDealStrategy] = useState('')
  const [dealMetric, setDealMetric] = useState('')
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isDeal = type === 'deal_case_study'
  const postTypes = platform === 'instagram' ? instagramTypes : linkedInTypes

  useEffect(() => {
    if (defaultType && [...linkedInTypes, ...instagramTypes].some((t) => t.value === defaultType)) {
      setType(defaultType as PostType)
    }
  }, [defaultType])

  // Reset state when sheet closes
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setStep('config')
        setBrief('')
        setJobId(null)
        setPostId(null)
        setGeneratedContent('')
        setError(null)
        setCopied(false)
        setScheduleDate('')
        setScheduleTime('09:00')
        setScheduling(false)
        setScheduled(false)
        setPublishing(false)
        setPublished(false)
        setDealCity('')
        setDealStrategy('')
        setDealMetric('')
        setUploadedFiles([])
      }, 300)
    }
  }, [open])

  // Poll job status
  const pollJob = useCallback(async (id: string) => {
    const maxAttempts = 60
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 2000))
      try {
        const res = await fetch(`/api/jobs/${id}`)
        const job = await res.json()
        if (job.status === 'completed' && job.result?.postId) {
          const postRes = await fetch(`/api/posts/${job.result.postId}`)
          const postData = await postRes.json()
          setPostId(job.result.postId as string)
          setGeneratedContent(postData.post.contenu)
          setStep('review')
          return
        }
        if (job.status === 'failed') {
          setError(job.error ?? 'La génération a échoué')
          setStep('config')
          return
        }
      } catch {
        // continue polling
      }
    }
    setError('Timeout — la génération prend trop de temps')
    setStep('config')
  }, [])

  async function handleUpload(files: FileList) {
    setUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      for (const file of Array.from(files)) {
        formData.append('files', file)
      }

      const res = await fetch('/api/media', { method: 'POST', body: formData })
      if (!res.ok) {
        const err = await res.json()
        setError(err.error ?? 'Erreur lors de l\'upload')
        setUploading(false)
        return
      }

      const data = await res.json()
      setUploadedFiles((prev) => [...prev, ...(data.files as UploadedFile[])])
    } catch {
      setError('Erreur réseau lors de l\'upload')
    }
    setUploading(false)
  }

  function removeFile(id: string) {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== id))
  }

  async function handleGenerate() {
    const effectiveBrief = isDeal
      ? `Deal à ${dealCity || 'non précisé'}, stratégie ${dealStrategy || 'non précisée'}, résultat : ${dealMetric || 'non précisé'}. ${brief}`
      : brief

    if (effectiveBrief.length < 10) return
    setError(null)
    setStep('generating')

    try {
      const body: Record<string, unknown> = {
        personaSlug: persona,
        type,
        platform,
        brief: effectiveBrief,
      }

      if (isDeal) {
        if (dealCity) body.dealCity = dealCity
        if (dealStrategy) body.dealStrategy = dealStrategy
        if (dealMetric) body.dealMetric = dealMetric
        if (uploadedFiles.length > 0) body.mediaIds = uploadedFiles.map((f) => f.id)
      }

      const res = await fetch('/api/posts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json()
        setError(err.error?.[0]?.message ?? 'Erreur lors de la création du job')
        setStep('config')
        return
      }

      const data = await res.json()
      setJobId(data.jobId)
      pollJob(data.jobId)
    } catch {
      setError('Erreur réseau')
      setStep('config')
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(generatedContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleSchedule() {
    if (!postId || !scheduleDate) return
    setScheduling(true)

    try {
      const publishAt = new Date(`${scheduleDate}T${scheduleTime}:00`).toISOString()
      const res = await fetch(`/api/posts/${postId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publishAt, statut: 'approved' }),
      })

      if (res.ok) {
        setScheduled(true)
        setTimeout(() => onClose(), 1500)
      }
    } finally {
      setScheduling(false)
    }
  }

  async function handlePublishNow() {
    if (!postId) return
    setPublishing(true)

    try {
      // First approve the post
      await fetch(`/api/posts/${postId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut: 'approved' }),
      })

      // Then trigger publish
      const res = await fetch(`/api/posts/${postId}/publish`, { method: 'POST' })
      if (res.ok) {
        setPublished(true)
        setTimeout(() => onClose(), 1500)
      } else {
        const err = await res.json()
        setError(err.error ?? 'Erreur lors de la publication')
      }
    } catch {
      setError('Erreur réseau')
    } finally {
      setPublishing(false)
    }
  }

  function handlePlatformChange(p: Platform) {
    setPlatform(p)
    // Reset type if not available on the new platform
    const types = p === 'instagram' ? instagramTypes : linkedInTypes
    if (!types.some((t) => t.value === type)) {
      setType(types[0].value)
    }
  }

  // Default schedule date to tomorrow
  function openSchedule() {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    setScheduleDate(tomorrow.toISOString().split('T')[0])
    setStep('schedule')
  }

  const canGenerate = isDeal
    ? (dealCity.length > 0 || dealMetric.length > 0 || brief.length >= 10)
    : brief.length >= 10

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed inset-x-0 bottom-0 z-[70] md:inset-auto md:right-6 md:top-6 md:bottom-6 md:w-[480px] animate-slide-up">
        <div className="flex h-full max-h-[90dvh] md:max-h-full flex-col rounded-t-3xl md:rounded-3xl border border-white/[0.08] bg-[hsl(228,25%,8%)] shadow-2xl shadow-black/50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
            <div>
              <h2 className="font-display text-lg font-bold text-white">Composer</h2>
              <p className="text-[12px] text-white/35 mt-0.5">
                {step === 'config' && (isDeal ? 'Renseigne les infos de ton deal' : 'Configure et génère ton post')}
                {step === 'generating' && 'Claude est en train de rédiger...'}
                {step === 'review' && 'Revois et valide le résultat'}
                {step === 'schedule' && 'Choisis la date et l\'heure'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-all"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {step === 'config' && (
              <>
                {error && (
                  <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-[13px] text-red-400">
                    {error}
                  </div>
                )}

                {/* Persona */}
                <div>
                  <label className="block text-[12px] font-bold text-white/40 uppercase tracking-wider mb-2.5">Persona</label>
                  <div className="flex gap-2">
                    {personas.map((p) => (
                      <button
                        key={p.value}
                        onClick={() => setPersona(p.value)}
                        className={`flex-1 rounded-xl py-2.5 text-[13px] font-bold transition-all duration-200 ${
                          persona === p.value
                            ? 'bg-white text-[hsl(228,30%,6%)] shadow-lg shadow-white/10'
                            : 'text-white/40 hover:text-white/60 bg-white/[0.04] hover:bg-white/[0.06]'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Type */}
                <div>
                  <label className="block text-[12px] font-bold text-white/40 uppercase tracking-wider mb-2.5">Type de post</label>
                  <div className="grid grid-cols-2 gap-2">
                    {postTypes.map((t) => (
                      <button
                        key={t.value}
                        onClick={() => setType(t.value)}
                        className={`rounded-xl p-3 text-left transition-all duration-200 border ${
                          type === t.value
                            ? t.value === 'deal_case_study'
                              ? 'bg-accent-teal/10 border-accent-teal/30 text-white'
                              : 'bg-accent-blue/10 border-accent-blue/30 text-white'
                            : 'bg-white/[0.03] border-white/[0.06] text-white/60 hover:bg-white/[0.05]'
                        }`}
                      >
                        <p className="text-[13px] font-bold">{t.label}</p>
                        <p className="text-[11px] text-white/30 mt-0.5">{t.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Platform */}
                <div>
                  <label className="block text-[12px] font-bold text-white/40 uppercase tracking-wider mb-2.5">Plateforme</label>
                  <div className="flex gap-2">
                    {(['linkedin', 'instagram'] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => handlePlatformChange(p)}
                        className={`flex-1 rounded-xl py-2.5 text-[13px] font-bold transition-all duration-200 ${
                          platform === p
                            ? 'bg-white text-[hsl(228,30%,6%)] shadow-lg shadow-white/10'
                            : 'text-white/40 hover:text-white/60 bg-white/[0.04] hover:bg-white/[0.06]'
                        }`}
                      >
                        {p === 'linkedin' ? 'LinkedIn' : 'Instagram'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Deal-specific fields */}
                {isDeal && (
                  <>
                    {/* City */}
                    <div>
                      <label className="block text-[12px] font-bold text-white/40 uppercase tracking-wider mb-2.5">Ville</label>
                      <input
                        type="text"
                        value={dealCity}
                        onChange={(e) => setDealCity(e.target.value)}
                        placeholder="ex: Paris 12e, Lyon 3e..."
                        className="w-full rounded-xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 text-[14px] text-white placeholder:text-white/20 focus:outline-none focus:border-accent-teal/40 focus:bg-white/[0.06] transition-all"
                      />
                    </div>

                    {/* Strategy */}
                    <div>
                      <label className="block text-[12px] font-bold text-white/40 uppercase tracking-wider mb-2.5">Stratégie</label>
                      <div className="flex gap-2 flex-wrap">
                        {strategies.map((s) => (
                          <button
                            key={s}
                            onClick={() => setDealStrategy(s)}
                            className={`rounded-full px-4 py-2 text-[12px] font-bold transition-all duration-200 ${
                              dealStrategy === s
                                ? 'bg-accent-teal text-white shadow-lg shadow-accent-teal/20'
                                : 'text-white/40 bg-white/[0.04] hover:bg-white/[0.06] hover:text-white/60'
                            }`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Metric */}
                    <div>
                      <label className="block text-[12px] font-bold text-white/40 uppercase tracking-wider mb-2.5">Chiffre clé</label>
                      <input
                        type="text"
                        value={dealMetric}
                        onChange={(e) => setDealMetric(e.target.value)}
                        placeholder="ex: +85k€ plus-value, 12% rendement..."
                        className="w-full rounded-xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 text-[14px] text-white placeholder:text-white/20 focus:outline-none focus:border-accent-teal/40 focus:bg-white/[0.06] transition-all"
                      />
                    </div>

                    {/* Photo upload */}
                    <div>
                      <label className="block text-[12px] font-bold text-white/40 uppercase tracking-wider mb-2.5">
                        Photos avant/après
                        <span className="text-white/20 font-normal ml-1">(optionnel)</span>
                      </label>

                      {uploadedFiles.length > 0 && (
                        <div className="grid grid-cols-4 gap-2 mb-3">
                          {uploadedFiles.map((file) => (
                            <div key={file.id} className="relative group rounded-lg overflow-hidden aspect-square bg-white/[0.04]">
                              <img src={file.url} alt={file.filename} className="w-full h-full object-cover" />
                              <button
                                onClick={() => removeFile(file.id)}
                                className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white/60 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        className="hidden"
                        onChange={(e) => e.target.files && handleUpload(e.target.files)}
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="flex items-center gap-2 rounded-xl border border-dashed border-white/[0.12] bg-white/[0.02] px-4 py-3 text-[13px] font-bold text-white/40 hover:text-white/60 hover:border-white/[0.2] hover:bg-white/[0.04] transition-all w-full justify-center disabled:opacity-40"
                      >
                        {uploading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}
                        {uploading ? 'Upload en cours...' : `Ajouter des photos${uploadedFiles.length > 0 ? ` (${uploadedFiles.length})` : ''}`}
                      </button>
                    </div>
                  </>
                )}

                {/* Brief */}
                <div>
                  <label className="block text-[12px] font-bold text-white/40 uppercase tracking-wider mb-2.5">
                    {isDeal ? 'Description complémentaire' : 'Brief'}
                    {isDeal && <span className="text-white/20 font-normal ml-1">(optionnel)</span>}
                  </label>
                  <textarea
                    value={brief}
                    onChange={(e) => setBrief(e.target.value)}
                    placeholder={isDeal
                      ? 'Détails supplémentaires sur le deal, leçons apprises...'
                      : 'Décris ce que tu veux communiquer... (min. 10 caractères)'
                    }
                    rows={isDeal ? 3 : 4}
                    className="w-full rounded-xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 text-[14px] text-white placeholder:text-white/20 focus:outline-none focus:border-accent-blue/40 focus:bg-white/[0.06] transition-all resize-none"
                  />
                  {!isDeal && (
                    <p className="mt-1.5 text-[11px] text-white/20 text-right">{brief.length} caractères</p>
                  )}
                </div>
              </>
            )}

            {step === 'generating' && (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="relative">
                  <div className={`h-16 w-16 rounded-2xl flex items-center justify-center ${isDeal ? 'bg-accent-teal/10' : 'bg-accent-blue/10'}`}>
                    {isDeal ? (
                      <ImageIcon className="h-7 w-7 text-accent-teal animate-pulse-soft" />
                    ) : (
                      <Sparkles className="h-7 w-7 text-accent-blue animate-pulse-soft" />
                    )}
                  </div>
                  <Loader2 className={`absolute -top-2 -right-2 h-5 w-5 animate-spin ${isDeal ? 'text-accent-teal' : 'text-accent-blue'}`} />
                </div>
                <p className="mt-6 text-[15px] font-bold text-white">
                  {isDeal ? 'Claude rédige ton case study...' : 'Claude rédige ton post...'}
                </p>
                <p className="mt-1.5 text-[13px] text-white/30">Persona : {persona === 'flipio' ? 'Flipio' : 'MdB'} · {postTypes.find((t) => t.value === type)?.label}</p>
                <div className="mt-6 w-48 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                  <div className={`h-full rounded-full animate-shimmer ${isDeal ? 'bg-accent-teal/40' : 'bg-accent-blue/40'}`} style={{ width: '60%' }} />
                </div>
              </div>
            )}

            {step === 'review' && (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-bold text-accent-teal uppercase tracking-wider">Résultat</span>
                  <span className="text-white/10">·</span>
                  <span className="text-[11px] text-white/25">{persona === 'flipio' ? 'Flipio' : 'MdB'} · {postTypes.find((t) => t.value === type)?.label}</span>
                </div>

                {/* Show uploaded photos in review */}
                {isDeal && uploadedFiles.length > 0 && (
                  <div className="grid grid-cols-4 gap-2">
                    {uploadedFiles.map((file) => (
                      <div key={file.id} className="rounded-lg overflow-hidden aspect-square bg-white/[0.04]">
                        <img src={file.url} alt={file.filename} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                )}

                <div className="rounded-xl bg-white/[0.04] border border-white/[0.08] p-5">
                  <pre className="text-[14px] text-white/80 whitespace-pre-wrap font-sans leading-relaxed">
                    {generatedContent}
                  </pre>
                </div>

                <div className="flex items-center gap-2 text-[12px] text-white/25">
                  <span>{generatedContent.length} caractères</span>
                  <span>·</span>
                  <span>{platform === 'linkedin' ? 'LinkedIn' : 'Instagram'}</span>
                  {isDeal && dealCity && (
                    <>
                      <span>·</span>
                      <span>{dealCity}</span>
                    </>
                  )}
                </div>
              </>
            )}

            {step === 'schedule' && (
              <>
                {scheduled ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <div className="h-16 w-16 rounded-2xl bg-accent-teal/10 flex items-center justify-center">
                      <Check className="h-7 w-7 text-accent-teal" />
                    </div>
                    <p className="mt-6 text-[15px] font-bold text-white">Post planifié !</p>
                    <p className="mt-1.5 text-[13px] text-white/30">
                      {new Date(`${scheduleDate}T${scheduleTime}`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} à {scheduleTime}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-1">
                      <CalendarDays className="h-4 w-4 text-accent-blue" />
                      <span className="text-[13px] font-bold text-white">Planifier la publication</span>
                    </div>

                    <div className="rounded-xl bg-white/[0.04] border border-white/[0.08] p-4 mb-2">
                      <pre className="text-[12px] text-white/50 whitespace-pre-wrap font-sans leading-relaxed line-clamp-3">
                        {generatedContent.slice(0, 150)}...
                      </pre>
                    </div>

                    <div>
                      <label className="block text-[12px] font-bold text-white/40 uppercase tracking-wider mb-2.5">Date</label>
                      <input
                        type="date"
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full rounded-xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 text-[14px] text-white focus:outline-none focus:border-accent-blue/40 transition-all [color-scheme:dark]"
                      />
                    </div>

                    <div>
                      <label className="block text-[12px] font-bold text-white/40 uppercase tracking-wider mb-2.5">Heure</label>
                      <input
                        type="time"
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                        className="w-full rounded-xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 text-[14px] text-white focus:outline-none focus:border-accent-blue/40 transition-all [color-scheme:dark]"
                      />
                    </div>

                    <div className="rounded-xl bg-amber-400/[0.06] border border-amber-400/10 px-4 py-3">
                      <p className="text-[12px] text-amber-400/70">
                        Le post sera marqué comme validé et publié automatiquement à l&apos;heure choisie.
                      </p>
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-white/[0.06] px-6 py-4">
            {step === 'config' && (
              <button
                onClick={handleGenerate}
                disabled={!canGenerate}
                className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[14px] font-bold text-white shadow-lg transition-all duration-200 hover:brightness-110 active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed ${
                  isDeal
                    ? 'bg-gradient-to-r from-accent-teal to-[#00e0c0] shadow-accent-teal/25 hover:shadow-accent-teal/40'
                    : 'bg-gradient-to-r from-accent-blue to-[#5b8aff] shadow-accent-blue/25 hover:shadow-accent-blue/40'
                }`}
              >
                <Sparkles className="h-4 w-4" />
                {isDeal ? 'Générer le case study' : 'Générer avec Claude'}
              </button>
            )}

            {step === 'review' && !published && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => setStep('config')}
                    className="rounded-xl px-4 py-3 text-[13px] font-bold text-white/50 bg-white/[0.04] hover:bg-white/[0.06] transition-all"
                  >
                    Régénérer
                  </button>
                  <button
                    onClick={handleCopy}
                    className="flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-[13px] font-bold text-white bg-white/[0.08] hover:bg-white/[0.12] transition-all"
                  >
                    {copied ? <Check className="h-4 w-4 text-accent-teal" /> : <Copy className="h-4 w-4" />}
                    {copied ? 'Copié' : 'Copier'}
                  </button>
                  <button
                    onClick={openSchedule}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-[13px] font-bold text-white bg-white/[0.08] hover:bg-white/[0.12] transition-all"
                  >
                    <Clock className="h-4 w-4" />
                    Planifier
                  </button>
                </div>
                <button
                  onClick={handlePublishNow}
                  disabled={publishing}
                  className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[14px] font-bold text-white shadow-lg transition-all duration-200 hover:brightness-110 active:scale-[0.98] disabled:opacity-50 ${
                    platform === 'instagram'
                      ? 'bg-gradient-to-r from-accent-pink to-[#ff8db5] shadow-accent-pink/25 hover:shadow-accent-pink/40'
                      : 'bg-gradient-to-r from-accent-blue to-[#5b8aff] shadow-accent-blue/25 hover:shadow-accent-blue/40'
                  }`}
                >
                  {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Publier sur {platform === 'linkedin' ? 'LinkedIn' : 'Instagram'}
                </button>
              </div>
            )}
            {step === 'review' && published && (
              <div className="flex flex-col items-center py-4">
                <div className="flex items-center gap-2 text-accent-teal">
                  <Check className="h-5 w-5" />
                  <span className="text-[14px] font-bold">Publication lancée !</span>
                </div>
              </div>
            )}

            {step === 'schedule' && !scheduled && (
              <div className="flex gap-2">
                <button
                  onClick={() => setStep('review')}
                  className="flex-1 rounded-xl py-3 text-[13px] font-bold text-white/50 bg-white/[0.04] hover:bg-white/[0.06] transition-all"
                >
                  Retour
                </button>
                <button
                  onClick={handleSchedule}
                  disabled={!scheduleDate || scheduling}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-[14px] font-bold text-white bg-gradient-to-r from-accent-blue to-[#5b8aff] shadow-lg shadow-accent-blue/25 hover:shadow-accent-blue/40 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {scheduling ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarDays className="h-4 w-4" />}
                  Confirmer
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
