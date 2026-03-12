'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Loader2, Sparkles, Copy, Check, Clock, CalendarDays, Upload, Image as ImageIcon, Trash2, Settings2 } from 'lucide-react'
import { ParametersPanel } from '@/components/parameters-panel'
import { ImagePicker } from '@/components/image-picker'

type PostType = 'post_texte' | 'comment_trigger' | 'ghostwriter' | 'post_image' | 'deal_case_study' | 'instagram_caption' | 'instagram_story'
type Platform = 'linkedin' | 'instagram'
type Persona = 'flipio' | 'mdb'
type Step = 'config' | 'generating' | 'review'

const linkedInTypes: { value: PostType; label: string; description: string }[] = [
  { value: 'post_texte', label: 'Post texte', description: '900-1100 car.' },
  { value: 'comment_trigger', label: 'Post viral', description: '3 variantes' },
  { value: 'ghostwriter', label: 'Ghostwriter', description: 'Long format' },
  { value: 'post_image', label: 'Post image', description: 'Avec visuel' },
  { value: 'deal_case_study', label: 'Case Study', description: 'Deal avant/après' },
]

const instagramTypes: { value: PostType; label: string; description: string }[] = [
  { value: 'instagram_caption', label: 'Caption', description: 'Photo + hashtags' },
  { value: 'instagram_story', label: 'Story', description: '1080x1920' },
  { value: 'deal_case_study', label: 'Case Study', description: 'Carrousel' },
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

export default function RedigerPage() {
  return (
    <Suspense>
      <RedigerContent />
    </Suspense>
  )
}

function RedigerContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [step, setStep] = useState<Step>('config')
  const [type, setType] = useState<PostType>('post_texte')
  const [platform, setPlatform] = useState<Platform>('linkedin')
  const [persona, setPersona] = useState<Persona>('flipio')
  const [brief, setBrief] = useState('')
  const [postId, setPostId] = useState<string | null>(null)
  const [generatedContent, setGeneratedContent] = useState('')
  const [postMediaUrl, setPostMediaUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [published, setPublished] = useState(false)

  // Schedule inline
  const [showSchedule, setShowSchedule] = useState(false)
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('09:00')
  const [scheduling, setScheduling] = useState(false)
  const [scheduled, setScheduled] = useState(false)

  // Deal fields
  const [dealCity, setDealCity] = useState('')
  const [dealStrategy, setDealStrategy] = useState('')
  const [dealMetric, setDealMetric] = useState('')
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Image picker
  const [selectedImage, setSelectedImage] = useState<{ url: string; fullUrl: string; photographer: string } | null>(null)
  const [imageMode, setImageMode] = useState<'none' | 'stock' | 'upload'>('none')
  const [customImage, setCustomImage] = useState<UploadedFile | null>(null)
  const customFileInputRef = useRef<HTMLInputElement>(null)

  // Mobile tab
  const [mobileTab, setMobileTab] = useState<'rediger' | 'params'>('rediger')

  const isDeal = type === 'deal_case_study'
  const postTypes = platform === 'instagram' ? instagramTypes : linkedInTypes

  // Read type from query params
  useEffect(() => {
    const typeParam = searchParams.get('type')
    if (typeParam && [...linkedInTypes, ...instagramTypes].some((t) => t.value === typeParam)) {
      setType(typeParam as PostType)
    }
  }, [searchParams])

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
          setPostMediaUrl(postData.post.mediaUrl ?? null)
          setStep('review')
          return
        }
        if (job.status === 'failed') {
          setError(job.error ?? 'La génération a échoué')
          setStep('config')
          return
        }
      } catch { /* continue */ }
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

  async function handleCustomImageUpload(files: FileList) {
    setUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('files', files[0])
      const res = await fetch('/api/media', { method: 'POST', body: formData })
      if (!res.ok) {
        const err = await res.json()
        setError(err.error ?? 'Erreur lors de l\'upload')
        return
      }
      const data = await res.json()
      setCustomImage(data.files[0] as UploadedFile)
    } catch {
      setError('Erreur réseau lors de l\'upload')
    } finally {
      setUploading(false)
    }
  }

  function handleImageModeChange(mode: 'none' | 'stock' | 'upload') {
    setImageMode(mode)
    if (mode !== 'stock') setSelectedImage(null)
    if (mode !== 'upload') setCustomImage(null)
  }

  const isGenerating = step === 'generating'

  async function handleGenerate() {
    if (isGenerating) return // prevent double-submit
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
      if (selectedImage) {
        body.mediaUrl = selectedImage.fullUrl
        body.imageCredit = selectedImage.photographer
      } else if (customImage) {
        body.mediaUrl = `${window.location.origin}${customImage.url}`
        body.mediaIds = [customImage.id]
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
        body: JSON.stringify({ publishAt, statut: 'approved', contenu: generatedContent }),
      })
      if (res.ok) {
        setScheduled(true)
        setTimeout(() => router.push('/posts'), 1500)
      }
    } finally {
      setScheduling(false)
    }
  }

  async function handlePublishNow() {
    if (!postId) return
    setPublishing(true)
    try {
      await fetch(`/api/posts/${postId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut: 'approved', contenu: generatedContent }),
      })
      const res = await fetch(`/api/posts/${postId}/publish`, { method: 'POST' })
      if (res.ok) {
        setPublished(true)
        setTimeout(() => router.push('/posts'), 1500)
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
    const types = p === 'instagram' ? instagramTypes : linkedInTypes
    if (!types.some((t) => t.value === type)) {
      setType(types[0].value)
    }
  }

  function handleReset() {
    setStep('config')
    setPostId(null)
    setGeneratedContent('')
    setPostMediaUrl(null)
    setPublished(false)
    setPublishing(false)
    setShowSchedule(false)
    setScheduled(false)
    setScheduleDate('')
    setScheduleTime('09:00')
    setCopied(false)
    setError(null)
    setImageMode('none')
    setCustomImage(null)
    setSelectedImage(null)
  }

  function openSchedule() {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    setScheduleDate(tomorrow.toISOString().split('T')[0])
    setShowSchedule(true)
  }

  const canGenerate = isDeal
    ? (dealCity.length > 0 || dealMetric.length > 0 || brief.length >= 10)
    : brief.length >= 10

  return (
    <div className="px-5 py-8 md:px-10 md:py-12 max-w-7xl">
      {/* Header */}
      <div className="animate-fade-up">
        <h1 className="font-display text-3xl font-bold tracking-tight text-white md:text-4xl">
          Rédiger
        </h1>
        <p className="mt-2 text-[15px] text-white/40">
          {step === 'config' && (isDeal ? 'Renseigne les infos de ton deal' : 'Configure et génère ton post')}
          {step === 'generating' && 'L\'IA est en train de rédiger...'}
          {step === 'review' && 'Revois et valide le résultat'}
        </p>
      </div>

      {/* Mobile tab toggle */}
      <div className="md:hidden mt-6 flex gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06]">
        <button
          onClick={() => setMobileTab('rediger')}
          className={`flex-1 rounded-lg py-2 text-[13px] font-bold transition-all ${
            mobileTab === 'rediger'
              ? 'bg-white/[0.08] text-white shadow-sm'
              : 'text-white/35 hover:text-white/50'
          }`}
        >
          Rédiger
        </button>
        <button
          onClick={() => setMobileTab('params')}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-[13px] font-bold transition-all ${
            mobileTab === 'params'
              ? 'bg-white/[0.08] text-white shadow-sm'
              : 'text-white/35 hover:text-white/50'
          }`}
        >
          <Settings2 className="h-3.5 w-3.5" />
          Paramètres
        </button>
      </div>

      {/* Two-column layout */}
      <div className="mt-8 flex gap-8 animate-fade-up" style={{ animationDelay: '100ms' }}>
        {/* Left column — Rédiger */}
        <div className={`flex-1 min-w-0 ${mobileTab === 'params' ? 'hidden md:block' : ''}`}>
          {step === 'config' && (
            <div className="space-y-5">
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

              {/* Type */}
              <div>
                <label className="block text-[12px] font-bold text-white/40 uppercase tracking-wider mb-2.5">Type de post</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {postTypes.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setType(t.value)}
                      className={`rounded-xl p-3 text-left transition-all duration-200 border ${
                        type === t.value
                          ? isDeal
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

              {/* Deal-specific fields */}
              {isDeal && (
                <>
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
                              onClick={() => setUploadedFiles((prev) => prev.filter((f) => f.id !== file.id))}
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
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
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

              {/* Image section for all non-deal types */}
              {!isDeal && (
                <div>
                  <label className="block text-[12px] font-bold text-white/40 uppercase tracking-wider mb-2.5">
                    Image
                    <span className="text-white/20 font-normal ml-1">(optionnel)</span>
                  </label>
                  <div className="flex gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06] mb-3">
                    {([
                      { value: 'none' as const, label: 'Pas d\'image' },
                      { value: 'stock' as const, label: 'Banque d\'images' },
                      { value: 'upload' as const, label: 'Mon image' },
                    ]).map((m) => (
                      <button
                        key={m.value}
                        onClick={() => handleImageModeChange(m.value)}
                        className={`flex-1 rounded-lg py-2 text-[12px] font-bold transition-all ${
                          imageMode === m.value
                            ? 'bg-white/[0.08] text-white shadow-sm'
                            : 'text-white/35 hover:text-white/50'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>

                  {imageMode === 'stock' && (
                    <>
                      {selectedImage ? (
                        <div className="relative rounded-xl overflow-hidden">
                          <img src={selectedImage.url} alt="" className="w-full h-48 object-cover rounded-xl" />
                          <div className="absolute bottom-2 left-2 rounded-md bg-black/50 backdrop-blur-sm px-2 py-1 text-[10px] text-white/60">
                            {selectedImage.photographer}
                          </div>
                          <button
                            onClick={() => setSelectedImage(null)}
                            className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white/60 hover:text-white transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <ImagePicker
                          defaultQuery={persona === 'flipio' ? 'modern real estate technology' : 'luxury paris apartment'}
                          onSelect={(img) => setSelectedImage({ url: img.url, fullUrl: img.fullUrl, photographer: img.photographer })}
                        />
                      )}
                    </>
                  )}

                  {imageMode === 'upload' && (
                    <>
                      {customImage ? (
                        <div className="relative rounded-xl overflow-hidden">
                          <img src={customImage.url} alt="" className="w-full h-48 object-cover rounded-xl" />
                          <button
                            onClick={() => setCustomImage(null)}
                            className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white/60 hover:text-white transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <input
                            ref={customFileInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            onChange={(e) => e.target.files && handleCustomImageUpload(e.target.files)}
                          />
                          <button
                            onClick={() => customFileInputRef.current?.click()}
                            disabled={uploading}
                            className="flex items-center gap-2 rounded-xl border border-dashed border-white/[0.12] bg-white/[0.02] px-4 py-8 text-[13px] font-bold text-white/40 hover:text-white/60 hover:border-white/[0.2] hover:bg-white/[0.04] transition-all w-full justify-center disabled:opacity-40"
                          >
                            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                            {uploading ? 'Upload en cours...' : 'Choisir une image'}
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Generate button */}
              <button
                onClick={handleGenerate}
                disabled={!canGenerate || isGenerating}
                className={`flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-[14px] font-bold text-white shadow-lg transition-all duration-200 hover:brightness-110 active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed ${
                  isDeal
                    ? 'bg-gradient-to-r from-accent-teal to-[#00e0c0] shadow-accent-teal/25'
                    : 'bg-gradient-to-r from-accent-blue to-[#5b8aff] shadow-accent-blue/25'
                }`}
              >
                <Sparkles className="h-4 w-4" />
                {isDeal ? 'Générer le case study' : 'Générer avec l\'IA'}
              </button>
            </div>
          )}

          {step === 'generating' && (
            <div className="flex flex-col items-center justify-center py-24">
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
                {isDeal ? 'L\'IA rédige ton case study...' : 'L\'IA rédige ton post...'}
              </p>
              <p className="mt-1.5 text-[13px] text-white/30">
                Persona : {persona === 'flipio' ? 'Flipio' : 'MdB'} · {postTypes.find((t) => t.value === type)?.label}
              </p>
              <div className="mt-6 w-48 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                <div className={`h-full rounded-full animate-shimmer ${isDeal ? 'bg-accent-teal/40' : 'bg-accent-blue/40'}`} style={{ width: '60%' }} />
              </div>
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-5">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-accent-teal uppercase tracking-wider">Résultat</span>
                <span className="text-white/10">·</span>
                <span className="text-[11px] text-white/25">
                  {persona === 'flipio' ? 'Flipio' : 'MdB'} · {postTypes.find((t) => t.value === type)?.label}
                </span>
              </div>

              {isDeal && uploadedFiles.length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                  {uploadedFiles.map((file) => (
                    <div key={file.id} className="rounded-lg overflow-hidden aspect-square bg-white/[0.04]">
                      <img src={file.url} alt={file.filename} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}

              {!isDeal && (selectedImage || customImage || postMediaUrl) && (
                <div className="rounded-xl overflow-hidden">
                  <img
                    src={selectedImage?.url ?? customImage?.url ?? postMediaUrl ?? ''}
                    alt=""
                    className="w-full h-48 object-cover rounded-xl"
                  />
                  {selectedImage?.photographer && (
                    <p className="text-[11px] text-white/25 mt-1.5">Photo : {selectedImage.photographer}</p>
                  )}
                </div>
              )}

              <div className="rounded-xl bg-white/[0.04] border border-white/[0.08] overflow-hidden">
                <textarea
                  value={generatedContent}
                  onChange={(e) => setGeneratedContent(e.target.value)}
                  rows={Math.max(8, generatedContent.split('\n').length + 2)}
                  className="w-full px-5 py-4 text-[14px] text-white/80 bg-transparent font-sans leading-relaxed focus:outline-none resize-y"
                />
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

              {/* Actions */}
              {!published && !scheduled && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <button
                      onClick={handleReset}
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

                  {/* Inline schedule */}
                  {showSchedule && (
                    <div className="glass rounded-xl p-4 space-y-3">
                      <div className="flex items-center gap-2 mb-1">
                        <CalendarDays className="h-4 w-4 text-accent-blue" />
                        <span className="text-[13px] font-bold text-white">Planifier la publication</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-white/30 uppercase mb-1.5">Date</label>
                          <input
                            type="date"
                            value={scheduleDate}
                            onChange={(e) => setScheduleDate(e.target.value)}
                            min={new Date().toISOString().split('T')[0]}
                            className="w-full rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 py-2.5 text-[13px] text-white focus:outline-none focus:border-accent-blue/40 transition-all [color-scheme:dark]"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-white/30 uppercase mb-1.5">Heure</label>
                          <input
                            type="time"
                            value={scheduleTime}
                            onChange={(e) => setScheduleTime(e.target.value)}
                            className="w-full rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 py-2.5 text-[13px] text-white focus:outline-none focus:border-accent-blue/40 transition-all [color-scheme:dark]"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setShowSchedule(false)}
                          className="flex-1 rounded-lg py-2.5 text-[12px] font-bold text-white/40 bg-white/[0.04] hover:bg-white/[0.06] transition-all"
                        >
                          Annuler
                        </button>
                        <button
                          onClick={handleSchedule}
                          disabled={!scheduleDate || scheduling}
                          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-[12px] font-bold text-white bg-accent-blue hover:brightness-110 transition-all disabled:opacity-30"
                        >
                          {scheduling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarDays className="h-3.5 w-3.5" />}
                          Confirmer
                        </button>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handlePublishNow}
                    disabled={publishing}
                    className={`flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-[14px] font-bold text-white shadow-lg transition-all duration-200 hover:brightness-110 active:scale-[0.98] disabled:opacity-50 ${
                      platform === 'instagram'
                        ? 'bg-gradient-to-r from-accent-pink to-[#ff8db5] shadow-accent-pink/25'
                        : 'bg-gradient-to-r from-accent-blue to-[#5b8aff] shadow-accent-blue/25'
                    }`}
                  >
                    {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    Publier sur {platform === 'linkedin' ? 'LinkedIn' : 'Instagram'}
                  </button>
                </div>
              )}

              {published && (
                <div className="flex items-center justify-center gap-2 py-4 text-accent-teal">
                  <Check className="h-5 w-5" />
                  <span className="text-[14px] font-bold">Publication lancée !</span>
                </div>
              )}

              {scheduled && (
                <div className="flex flex-col items-center py-6">
                  <div className="h-12 w-12 rounded-xl bg-accent-teal/10 flex items-center justify-center">
                    <Check className="h-6 w-6 text-accent-teal" />
                  </div>
                  <p className="mt-4 text-[14px] font-bold text-white">Post planifié !</p>
                  <p className="mt-1 text-[13px] text-white/30">
                    {new Date(`${scheduleDate}T${scheduleTime}`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} à {scheduleTime}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right column — Parameters */}
        <div className={`w-full md:w-[380px] md:shrink-0 ${mobileTab === 'rediger' ? 'hidden md:block' : ''}`}>
          <div className="md:sticky md:top-8">
            <div className="flex items-center gap-2 mb-4">
              <Settings2 className="h-4 w-4 text-white/25" />
              <h2 className="text-[13px] font-bold text-white/40 uppercase tracking-wider">Paramètres du prompt</h2>
            </div>
            <ParametersPanel personaSlug={persona} postType={type} />
          </div>
        </div>
      </div>
    </div>
  )
}
