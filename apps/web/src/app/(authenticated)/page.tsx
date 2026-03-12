'use client'

import { useState, useEffect } from 'react'
import NextImage from 'next/image'
import { Pencil, Zap, Image, FileText, ArrowUpRight, Activity } from 'lucide-react'

interface Stats {
  postsPublished: number
  postsPending: number
}

interface PostItem {
  id: string
  type: string
  module: string
  contenu: string
  statut: string
  platform: string
  publishAt: string | null
  publishedAt: string | null
  createdAt: string
  persona: { slug: string; nom: string }
}

export default function Home() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [recentPosts, setRecentPosts] = useState<PostItem[]>([])
  useEffect(() => {
    fetch('/api/stats').then((r) => r.json()).then(setStats).catch(() => {})
    fetch('/api/posts?limit=5').then((r) => r.json()).then((d) => setRecentPosts(d.posts ?? [])).catch(() => {})
  }, [])

  function openCompose(type?: string) {
    window.dispatchEvent(new CustomEvent('leni:compose', { detail: { type } }))
  }

  return (
    <div className="px-5 py-8 md:px-10 md:py-12 max-w-6xl">
      {/* Header with mascot */}
      <div className="animate-fade-up flex items-start gap-5">
        <div className="hidden sm:block shrink-0 animate-float">
          <NextImage
            src="/leni-mascot.png"
            alt="Leni mascot"
            width={140}
            height={140}
            className="drop-shadow-2xl"
          />
        </div>
        <div>
          <p className="text-[13px] font-semibold text-accent-blue tracking-wide uppercase">Dashboard</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-white md:text-4xl">
            Bienvenue sur Leni
          </h1>
          <p className="mt-2 text-[15px] text-white/40 max-w-lg">
            Vue d&apos;ensemble de vos agents et de votre activité social media.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-10 grid grid-cols-2 gap-3 stagger">
        <StatCard label="Posts publiés" value={stats?.postsPublished ?? 0} subtitle="cette semaine" color="blue" />
        <StatCard label="En attente" value={stats?.postsPending ?? 0} subtitle="à valider" color="teal" />
      </div>

      {/* Quick actions */}
      <div className="mt-12 animate-fade-up" style={{ animationDelay: '200ms' }}>
        <h2 className="font-display text-lg font-bold tracking-tight text-white">Actions rapides</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4 stagger">
          <ActionCard
            title="Post LinkedIn"
            subtitle="Post texte optimisé"
            icon={<Pencil className="h-4 w-4" />}
            gradient="from-accent-blue/20 to-accent-blue/5"
            iconColor="text-accent-blue"
            onClick={() => openCompose('post_texte')}
          />
          <ActionCard
            title="Post Viral"
            subtitle="Comment trigger"
            icon={<Zap className="h-4 w-4" />}
            gradient="from-accent-pink/20 to-accent-pink/5"
            iconColor="text-accent-pink"
            onClick={() => openCompose('comment_trigger')}
          />
          <ActionCard
            title="Case Study"
            subtitle="Deal avant/après"
            icon={<Image className="h-4 w-4" />}
            gradient="from-accent-teal/20 to-accent-teal/5"
            iconColor="text-accent-teal"
            onClick={() => openCompose('deal_case_study')}
          />
          <ActionCard
            title="Ghostwriter"
            subtitle="Long format"
            icon={<FileText className="h-4 w-4" />}
            gradient="from-purple-500/20 to-purple-500/5"
            iconColor="text-purple-400"
            onClick={() => openCompose('ghostwriter')}
          />
        </div>
      </div>

      {/* Recent posts */}
      {recentPosts.length > 0 && (
        <div className="mt-12 animate-fade-up" style={{ animationDelay: '300ms' }}>
          <h2 className="font-display text-lg font-bold tracking-tight text-white">Posts récents</h2>
          <div className="mt-4 glass rounded-2xl overflow-hidden divide-y divide-white/[0.04]">
            {recentPosts.map((post) => (
              <PostRow key={post.id} post={post} />
            ))}
          </div>
        </div>
      )}

      {/* Agent status */}
      <div className="mt-12 animate-fade-up" style={{ animationDelay: '350ms' }}>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold tracking-tight text-white">Statut agents</h2>
          <div className="flex items-center gap-1.5 text-[12px] font-medium text-white/30">
            <Activity className="h-3.5 w-3.5" />
            Temps réel
          </div>
        </div>
        <div className="mt-4 glass rounded-2xl overflow-hidden divide-y divide-white/[0.04]">
          <AgentRow name="Content Agent" status="idle" description="Dernière génération : jamais" />
          <AgentRow name="Comment Agent" status="scheduled" description="Scan toutes les 4h" />
        </div>
      </div>

    </div>
  )
}

function StatCard({ label, value, subtitle, color }: {
  label: string; value: number; subtitle: string
  color: 'blue' | 'teal' | 'pink' | 'neutral'
}) {
  const accents = {
    blue: 'from-accent-blue/15 to-transparent border-accent-blue/10 shadow-accent-blue/5',
    teal: 'from-accent-teal/15 to-transparent border-accent-teal/10 shadow-accent-teal/5',
    pink: 'from-accent-pink/15 to-transparent border-accent-pink/10 shadow-accent-pink/5',
    neutral: 'from-white/[0.06] to-transparent border-white/[0.06]',
  }
  const textColors = {
    blue: 'text-accent-blue',
    teal: 'text-accent-teal',
    pink: 'text-accent-pink',
    neutral: 'text-white',
  }

  return (
    <div className={`animate-scale-in glass-hover relative overflow-hidden rounded-2xl border bg-gradient-to-br p-5 ${accents[color]}`}>
      <p className={`font-display text-4xl font-extrabold tracking-tighter ${textColors[color]}`}>{value}</p>
      <p className="mt-1.5 text-[13px] font-semibold text-white/80">{label}</p>
      <p className="text-[11px] font-medium text-white/30">{subtitle}</p>
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-white/[0.02] to-transparent rounded-bl-full" />
    </div>
  )
}

function ActionCard({ title, subtitle, icon, gradient, iconColor, onClick }: {
  title: string; subtitle: string; icon: React.ReactNode
  gradient: string; iconColor: string; onClick: () => void
}) {
  return (
    <button onClick={onClick} className="animate-scale-in group glass glass-hover cursor-pointer rounded-2xl p-5 text-left w-full">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} ${iconColor} transition-transform duration-300 group-hover:scale-110`}>
        {icon}
      </div>
      <p className="mt-3.5 text-[14px] font-bold text-white">{title}</p>
      <p className="text-[12px] text-white/35 mt-0.5">{subtitle}</p>
      <div className="mt-4 flex items-center text-[12px] font-semibold text-white/20 group-hover:text-accent-blue transition-colors duration-300">
        Lancer <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
      </div>
    </button>
  )
}

function PostRow({ post }: { post: PostItem }) {
  const statutConfig: Record<string, { label: string; color: string }> = {
    draft: { label: 'Brouillon', color: 'bg-white/[0.04] text-white/40' },
    approved: { label: 'Validé', color: 'bg-accent-blue/10 text-accent-blue' },
    published: { label: 'Publié', color: 'bg-accent-teal/10 text-accent-teal' },
    archived: { label: 'Archivé', color: 'bg-white/[0.04] text-white/25' },
  }
  const s = statutConfig[post.statut] ?? statutConfig.draft

  const typeLabels: Record<string, string> = {
    post_texte: 'Post texte',
    comment_trigger: 'Comment trigger',
    ghostwriter: 'Ghostwriter',
    post_image: 'Post image',
  }

  return (
    <div className="flex items-center justify-between px-5 py-4 transition-colors hover:bg-white/[0.02]">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[11px] font-bold text-white/25 uppercase tracking-wider">{post.persona.nom}</span>
          <span className="text-white/10">·</span>
          <span className="text-[11px] text-white/20">{typeLabels[post.type] ?? post.type}</span>
        </div>
        <p className="text-[13px] font-semibold text-white/70 truncate">{post.contenu.slice(0, 80)}...</p>
      </div>
      <span className={`ml-3 shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold ${s.color}`}>
        {s.label}
      </span>
    </div>
  )
}

function AgentRow({ name, status, description }: {
  name: string; status: 'idle' | 'active' | 'scheduled' | 'error'; description: string
}) {
  const cfg = {
    idle: { label: 'Inactif', dot: 'bg-white/25', bg: 'bg-white/[0.04]', text: 'text-white/40' },
    active: { label: 'Actif', dot: 'bg-accent-teal', bg: 'bg-accent-teal/10', text: 'text-accent-teal' },
    scheduled: { label: 'Planifié', dot: 'bg-amber-400', bg: 'bg-amber-400/10', text: 'text-amber-400' },
    error: { label: 'Erreur', dot: 'bg-red-400', bg: 'bg-red-400/10', text: 'text-red-400' },
  }
  const s = cfg[status]

  return (
    <div className="flex items-center justify-between px-5 py-4 transition-colors hover:bg-white/[0.02]">
      <div>
        <p className="text-[14px] font-semibold text-white/90">{name}</p>
        <p className="text-[12px] text-white/30 mt-0.5">{description}</p>
      </div>
      <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-bold ${s.bg} ${s.text}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${s.dot} ${status === 'active' || status === 'scheduled' ? 'animate-pulse-soft' : ''}`} />
        {s.label}
      </div>
    </div>
  )
}
