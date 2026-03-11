'use client'

import { useState, useEffect, useCallback } from 'react'
import { Calendar, ChevronLeft, ChevronRight, Lightbulb, Loader2, Pencil, Zap, FileText, Image } from 'lucide-react'

interface PostItem {
  id: string
  type: string
  module: string
  contenu: string
  statut: string
  platform: string
  publishAt: string | null
  publishedAt: string | null
  persona: { slug: string; nom: string }
}

interface Suggestion {
  date: string
  suggestedType: string
  reason: string
}

interface CalendarData {
  posts: PostItem[]
  drafts: PostItem[]
  suggestions: Suggestion[]
  weekStart: string
  weekEnd: string
  stats: {
    totalScheduled: number
    daysWithContent: number
    daysEmpty: number
    typeDistribution: Record<string, number>
  }
}

const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const DAYS_FULL_FR = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

const typeConfig: Record<string, { label: string; icon: typeof Pencil; color: string; bg: string }> = {
  post_texte: { label: 'Post texte', icon: Pencil, color: 'text-accent-blue', bg: 'bg-accent-blue/15' },
  comment_trigger: { label: 'Comment trigger', icon: Zap, color: 'text-accent-pink', bg: 'bg-accent-pink/15' },
  ghostwriter: { label: 'Ghostwriter', icon: FileText, color: 'text-purple-400', bg: 'bg-purple-400/15' },
  post_image: { label: 'Post image', icon: Image, color: 'text-accent-teal', bg: 'bg-accent-teal/15' },
}

function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export default function CalendrierPage() {
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()))
  const [data, setData] = useState<CalendarData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchCalendar = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/calendar?start=${weekStart.toISOString()}`)
      if (!res.ok) return
      const json = await res.json()
      if (json.posts) setData(json)
    } catch {
      // silently fail
    }
    setLoading(false)
  }, [weekStart])

  useEffect(() => { fetchCalendar() }, [fetchCalendar])

  function prevWeek() {
    const d = new Date(weekStart)
    d.setDate(d.getDate() - 7)
    setWeekStart(d)
  }

  function nextWeek() {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + 7)
    setWeekStart(d)
  }

  function goToday() {
    setWeekStart(getMonday(new Date()))
  }

  // Build 7-day array
  const days: Date[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    days.push(d)
  }

  // Group posts by day
  function postsForDay(date: Date): PostItem[] {
    if (!data) return []
    const dayKey = date.toISOString().split('T')[0]
    return data.posts.filter((p) => {
      const pDate = p.publishAt ?? p.publishedAt
      return pDate && pDate.startsWith(dayKey)
    })
  }

  function suggestionForDay(date: Date): Suggestion | undefined {
    if (!data) return undefined
    const dayKey = date.toISOString().split('T')[0]
    return data.suggestions.find((s) => s.date === dayKey)
  }

  const isCurrentWeek = getMonday(new Date()).getTime() === weekStart.getTime()
  const today = new Date().toISOString().split('T')[0]

  // Format week range for header
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  const monthStart = weekStart.toLocaleDateString('fr-FR', { month: 'long' })
  const monthEnd = weekEnd.toLocaleDateString('fr-FR', { month: 'long' })
  const weekLabel = monthStart === monthEnd
    ? `${weekStart.getDate()} — ${weekEnd.getDate()} ${monthStart} ${weekEnd.getFullYear()}`
    : `${weekStart.getDate()} ${monthStart} — ${weekEnd.getDate()} ${monthEnd} ${weekEnd.getFullYear()}`

  return (
    <div className="px-5 py-8 md:px-10 md:py-12 max-w-7xl">
      {/* Header */}
      <div className="animate-fade-up">
        <p className="text-[13px] font-semibold text-accent-blue tracking-wide uppercase">M05</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-white md:text-4xl">
          Calendrier éditorial
        </h1>
        <p className="mt-2 text-[15px] text-white/40 max-w-lg">
          Planification sur 7 jours — diversifie les formats et détecte les trous.
        </p>
      </div>

      {/* Week navigation */}
      <div className="mt-8 flex items-center justify-between animate-fade-up" style={{ animationDelay: '100ms' }}>
        <div className="flex items-center gap-3">
          <button onClick={prevWeek} className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06] border border-white/[0.08] text-white/50 hover:text-white hover:bg-white/[0.08] transition-all">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={nextWeek} className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06] border border-white/[0.08] text-white/50 hover:text-white hover:bg-white/[0.08] transition-all">
            <ChevronRight className="h-4 w-4" />
          </button>
          {!isCurrentWeek && (
            <button onClick={goToday} className="rounded-xl bg-white/[0.06] border border-white/[0.08] px-4 py-2 text-[12px] font-bold text-white/50 hover:text-white hover:bg-white/[0.08] transition-all">
              Aujourd&apos;hui
            </button>
          )}
        </div>
        <p className="text-[14px] font-semibold text-white/60 capitalize">{weekLabel}</p>
      </div>

      {/* Stats bar */}
      {data && !loading && (
        <div className="mt-6 flex gap-3 flex-wrap animate-fade-up" style={{ animationDelay: '150ms' }}>
          <div className="glass rounded-xl px-4 py-2.5 flex items-center gap-2">
            <span className="text-[11px] font-bold text-white/25 uppercase">Planifiés</span>
            <span className="text-[14px] font-extrabold text-accent-blue">{data.stats.totalScheduled}</span>
          </div>
          <div className="glass rounded-xl px-4 py-2.5 flex items-center gap-2">
            <span className="text-[11px] font-bold text-white/25 uppercase">Jours couverts</span>
            <span className="text-[14px] font-extrabold text-accent-teal">{data.stats.daysWithContent}/7</span>
          </div>
          <div className="glass rounded-xl px-4 py-2.5 flex items-center gap-2">
            <span className="text-[11px] font-bold text-white/25 uppercase">Trous</span>
            <span className={`text-[14px] font-extrabold ${data.stats.daysEmpty > 0 ? 'text-amber-400' : 'text-accent-teal'}`}>{data.stats.daysEmpty}</span>
          </div>
          {Object.entries(data.stats.typeDistribution).map(([type, count]) => {
            const cfg = typeConfig[type]
            return cfg ? (
              <div key={type} className="glass rounded-xl px-3 py-2.5 flex items-center gap-2">
                <cfg.icon className={`h-3 w-3 ${cfg.color}`} />
                <span className="text-[12px] font-bold text-white/40">{count}</span>
              </div>
            ) : null
          })}
        </div>
      )}

      {/* Calendar grid */}
      <div className="mt-8 animate-fade-up" style={{ animationDelay: '200ms' }}>
        {loading ? (
          <div className="glass rounded-2xl p-14 text-center">
            <Loader2 className="h-6 w-6 text-white/30 animate-spin mx-auto" />
            <p className="mt-3 text-[13px] text-white/30">Chargement...</p>
          </div>
        ) : (
          <>
            {/* Desktop grid */}
            <div className="hidden md:grid grid-cols-7 gap-2">
              {/* Day headers */}
              {days.map((day, i) => {
                const dayKey = day.toISOString().split('T')[0]
                const isToday = dayKey === today
                return (
                  <div key={i} className="text-center pb-2">
                    <p className={`text-[11px] font-bold uppercase tracking-wider ${isToday ? 'text-accent-blue' : 'text-white/25'}`}>
                      {DAYS_FR[i]}
                    </p>
                    <p className={`text-[18px] font-extrabold mt-0.5 ${isToday ? 'text-accent-blue' : 'text-white/60'}`}>
                      {day.getDate()}
                    </p>
                  </div>
                )
              })}

              {/* Day columns */}
              {days.map((day, i) => {
                const dayPosts = postsForDay(day)
                const suggestion = suggestionForDay(day)
                const dayKey = day.toISOString().split('T')[0]
                const isToday = dayKey === today
                const isPast = dayKey < today

                return (
                  <div
                    key={i}
                    className={`glass rounded-2xl p-3 min-h-[180px] transition-all ${
                      isToday ? 'border border-accent-blue/20 shadow-lg shadow-accent-blue/5' : ''
                    } ${isPast ? 'opacity-50' : ''}`}
                  >
                    {dayPosts.length > 0 ? (
                      <div className="space-y-2">
                        {dayPosts.map((post) => (
                          <PostChip key={post.id} post={post} />
                        ))}
                      </div>
                    ) : suggestion && !isPast ? (
                      <SuggestionChip suggestion={suggestion} />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-[11px] text-white/15 font-medium">Aucun post</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Mobile list */}
            <div className="md:hidden space-y-3">
              {days.map((day, i) => {
                const dayPosts = postsForDay(day)
                const suggestion = suggestionForDay(day)
                const dayKey = day.toISOString().split('T')[0]
                const isToday = dayKey === today
                const isPast = dayKey < today

                return (
                  <div
                    key={i}
                    className={`glass rounded-2xl p-4 ${
                      isToday ? 'border border-accent-blue/20' : ''
                    } ${isPast ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className={`text-[13px] font-bold ${isToday ? 'text-accent-blue' : 'text-white/60'}`}>
                          {DAYS_FULL_FR[i]}
                        </span>
                        <span className="text-[12px] text-white/25">{day.getDate()}</span>
                      </div>
                      {isToday && (
                        <span className="rounded-full bg-accent-blue/10 px-2.5 py-0.5 text-[10px] font-bold text-accent-blue">
                          Aujourd&apos;hui
                        </span>
                      )}
                    </div>
                    {dayPosts.length > 0 ? (
                      <div className="space-y-2">
                        {dayPosts.map((post) => (
                          <PostChip key={post.id} post={post} />
                        ))}
                      </div>
                    ) : suggestion && !isPast ? (
                      <SuggestionChip suggestion={suggestion} />
                    ) : (
                      <p className="text-[12px] text-white/20 py-2">Aucun post prévu</p>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Drafts section */}
            {data && data.drafts.length > 0 && (
              <div className="mt-10">
                <h2 className="font-display text-lg font-bold tracking-tight text-white mb-4">
                  Brouillons à planifier
                  <span className="ml-2 text-[12px] font-bold text-white/25">{data.drafts.length}</span>
                </h2>
                <div className="glass rounded-2xl overflow-hidden divide-y divide-white/[0.04]">
                  {data.drafts.map((draft) => (
                    <DraftRow key={draft.id} post={draft} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function PostChip({ post }: { post: PostItem }) {
  const cfg = typeConfig[post.type] ?? { label: post.type, icon: Pencil, color: 'text-white/40', bg: 'bg-white/[0.04]' }
  const Icon = cfg.icon

  const time = post.publishAt
    ? new Date(post.publishAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : null

  const statutColors: Record<string, string> = {
    approved: 'border-accent-blue/20',
    published: 'border-accent-teal/20',
  }

  return (
    <div className={`rounded-xl ${cfg.bg} border ${statutColors[post.statut] ?? 'border-transparent'} p-2.5`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`h-3 w-3 ${cfg.color}`} />
        <span className={`text-[10px] font-bold ${cfg.color}`}>{cfg.label}</span>
        {time && <span className="text-[10px] text-white/25 ml-auto">{time}</span>}
      </div>
      <p className="text-[11px] text-white/50 leading-snug line-clamp-2">{post.contenu.slice(0, 80)}</p>
      <div className="mt-1.5 flex items-center gap-1.5">
        <span className="text-[9px] font-bold text-white/20 uppercase">{post.persona.nom}</span>
        <span className="text-white/10">·</span>
        <span className="text-[9px] text-white/15">{post.platform}</span>
        {post.statut === 'published' && (
          <span className="ml-auto text-[9px] font-bold text-accent-teal">Publié</span>
        )}
      </div>
    </div>
  )
}

function SuggestionChip({ suggestion }: { suggestion: Suggestion }) {
  const cfg = typeConfig[suggestion.suggestedType] ?? { label: suggestion.suggestedType, icon: Pencil, color: 'text-amber-400', bg: 'bg-amber-400/10' }

  return (
    <div className="rounded-xl border border-dashed border-amber-400/20 p-2.5 bg-amber-400/[0.03]">
      <div className="flex items-center gap-2 mb-1">
        <Lightbulb className="h-3 w-3 text-amber-400" />
        <span className="text-[10px] font-bold text-amber-400">Suggestion</span>
      </div>
      <p className="text-[11px] text-white/40 leading-snug">{suggestion.reason}</p>
    </div>
  )
}

function DraftRow({ post }: { post: PostItem }) {
  const cfg = typeConfig[post.type] ?? { label: post.type, icon: Pencil, color: 'text-white/40', bg: 'bg-white/[0.04]' }
  const Icon = cfg.icon

  return (
    <div className="flex items-center justify-between px-5 py-3.5 transition-colors hover:bg-white/[0.02]">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${cfg.bg}`}>
          <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`text-[11px] font-bold ${cfg.color}`}>{cfg.label}</span>
            <span className="text-[10px] text-white/20">{post.persona.nom}</span>
          </div>
          <p className="text-[12px] text-white/50 truncate">{post.contenu.slice(0, 60)}</p>
        </div>
      </div>
      <span className="rounded-full bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold text-white/30 shrink-0 ml-3">
        Brouillon
      </span>
    </div>
  )
}
