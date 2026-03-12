'use client'

import { useState, useEffect, useCallback } from 'react'
import { MessageCircle, RefreshCw, Send, ChevronDown, ChevronUp, Pencil, Check, X, Loader2, Download, ExternalLink, ChevronLeft, ChevronRight, Lightbulb, Zap, FileText, Image, Trash2, RotateCcw, GripVertical, CheckSquare, Square, Linkedin, Unlink } from 'lucide-react'

interface PostItem {
  id: string
  type: string
  module: string
  contenu: string
  statut: string
  platform: string
  externalId: string | null
  publishAt: string | null
  publishedAt: string | null
  createdAt: string
  persona: { slug: string; nom: string }
  _count: { comments: number }
}

interface CommentItem {
  id: string
  externalId: string
  authorName: string
  authorHeadline: string | null
  contenu: string
  isQuestion: boolean
  isProspect: boolean
  draftReply: string | null
  statut: string
  createdAt: string
}

const typeLabels: Record<string, string> = {
  post_texte: 'Post texte',
  comment_trigger: 'Comment trigger',
  ghostwriter: 'Ghostwriter',
  post_image: 'Post image',
  deal_case_study: 'Case study',
  instagram_caption: 'Caption',
  instagram_story: 'Story',
}

const statutConfig: Record<string, { label: string; color: string }> = {
  draft: { label: 'Brouillon', color: 'bg-white/[0.04] text-white/40' },
  approved: { label: 'Valid\u00e9', color: 'bg-accent-blue/10 text-accent-blue' },
  published: { label: 'Publi\u00e9', color: 'bg-accent-teal/10 text-accent-teal' },
  archived: { label: 'Archiv\u00e9', color: 'bg-white/[0.04] text-white/25' },
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}j`
}

export default function PostsPage() {
  const [posts, setPosts] = useState<PostItem[]>([])
  const [filter, setFilter] = useState<'all' | 'published' | 'draft' | 'approved'>('all')
  const [personaFilter, setPersonaFilter] = useState<'all' | 'flipio' | 'mdb'>('all')
  const [expandedPost, setExpandedPost] = useState<string | null>(null)
  const [comments, setComments] = useState<Record<string, CommentItem[]>>({})
  const [loadingComments, setLoadingComments] = useState<string | null>(null)
  const [pollingPost, setPollingPost] = useState<string | null>(null)
  const [generatingReply, setGeneratingReply] = useState<string | null>(null)
  const [sendingReply, setSendingReply] = useState<string | null>(null)
  const [editingReply, setEditingReply] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ total: number; new: number; error?: string } | null>(null)
  const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const loadPosts = useCallback(async () => {
    const res = await fetch('/api/posts?limit=100')
    const data = await res.json()
    setPosts(data.posts ?? [])
  }, [])

  useEffect(() => {
    loadPosts()
  }, [loadPosts])

  async function importLinkedInPosts() {
    setImporting(true)
    setImportResult(null)
    try {
      const res = await fetch('/api/linkedin/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personaSlug: 'mdb' }),
      })
      const data = await res.json()
      if (res.ok) {
        const imported = data.imported as { isNew: boolean }[]
        setImportResult({ total: imported.length, new: imported.filter((p: { isNew: boolean }) => p.isNew).length })
        await loadPosts()
      } else {
        setImportResult({ total: 0, new: 0, error: data.error })
      }
    } catch (err) {
      console.error('Import error:', err)
      setImportResult({ total: 0, new: 0, error: 'Erreur réseau' })
    } finally {
      setImporting(false)
    }
  }

  async function loadComments(postId: string) {
    setLoadingComments(postId)
    const res = await fetch(`/api/comments?postId=${postId}&limit=100`)
    const data = await res.json()
    setComments((prev) => ({ ...prev, [postId]: data.comments ?? [] }))
    setLoadingComments(null)
  }

  async function toggleExpand(postId: string) {
    if (expandedPost === postId) {
      setExpandedPost(null)
      return
    }
    setExpandedPost(postId)
    if (!comments[postId]) {
      await loadComments(postId)
    }
  }

  async function fetchNewComments(postId: string) {
    setPollingPost(postId)
    try {
      const res = await fetch('/api/comments/trigger', { method: 'POST' })
      if (res.ok) {
        // Wait a bit for the job to process, then reload comments
        await new Promise((r) => setTimeout(r, 3000))
        await loadComments(postId)
        await loadPosts()
      }
    } finally {
      setPollingPost(null)
    }
  }

  async function generateReply(commentId: string) {
    setGeneratingReply(commentId)
    try {
      const res = await fetch(`/api/comments/${commentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut: 'pending' }),
      })
      if (res.ok) {
        // Trigger the comment-reply job
        const jobRes = await fetch('/api/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'comment-reply', data: { commentId } }),
        })
        if (jobRes.ok) {
          // Poll for the result
          await new Promise((r) => setTimeout(r, 5000))
          // Reload comments for the post that contains this comment
          for (const [postId, cmts] of Object.entries(comments)) {
            if (cmts.some((c) => c.id === commentId)) {
              await loadComments(postId)
              break
            }
          }
        }
      }
    } finally {
      setGeneratingReply(null)
    }
  }

  async function approveReply(commentId: string, reply: string) {
    setSendingReply(commentId)
    try {
      await fetch(`/api/comments/${commentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut: 'approved', draftReply: reply }),
      })
      // Trigger actual reply via LinkedIn API
      await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'comment-reply', data: { commentId } }),
      })
      await new Promise((r) => setTimeout(r, 3000))
      for (const [postId, cmts] of Object.entries(comments)) {
        if (cmts.some((c) => c.id === commentId)) {
          await loadComments(postId)
          break
        }
      }
    } finally {
      setSendingReply(null)
      setEditingReply(null)
    }
  }

  async function ignoreComment(commentId: string) {
    await fetch(`/api/comments/${commentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statut: 'ignored' }),
    })
    for (const [postId, cmts] of Object.entries(comments)) {
      if (cmts.some((c) => c.id === commentId)) {
        await loadComments(postId)
        break
      }
    }
  }

  async function saveEditedReply(commentId: string) {
    await fetch(`/api/comments/${commentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draftReply: editDraft }),
    })
    setEditingReply(null)
    for (const [postId, cmts] of Object.entries(comments)) {
      if (cmts.some((c) => c.id === commentId)) {
        await loadComments(postId)
        break
      }
    }
  }

  const [deletingPost, setDeletingPost] = useState<string | null>(null)
  const [togglingPost, setTogglingPost] = useState<string | null>(null)
  const [unlinkingPost, setUnlinkingPost] = useState<string | null>(null)

  async function deletePost(postId: string) {
    if (!confirm('Supprimer ce post ?')) return
    setDeletingPost(postId)
    try {
      const res = await fetch(`/api/posts/${postId}`, { method: 'DELETE' })
      if (res.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== postId))
        if (expandedPost === postId) setExpandedPost(null)
      }
    } finally {
      setDeletingPost(null)
    }
  }

  async function togglePostStatus(postId: string, currentStatut: string) {
    const newStatut = currentStatut === 'approved' ? 'draft' : 'approved'
    setTogglingPost(postId)
    try {
      const res = await fetch(`/api/posts/${postId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut: newStatut }),
      })
      if (res.ok) {
        setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, statut: newStatut } : p))
      }
    } finally {
      setTogglingPost(null)
    }
  }

  async function unlinkFromLinkedIn(postId: string) {
    if (!confirm('Supprimer ce post de LinkedIn ? Il restera dans ta bibliothèque en tant qu\'archivé.')) return
    setUnlinkingPost(postId)
    try {
      const res = await fetch(`/api/posts/${postId}/linkedin`, { method: 'DELETE' })
      if (res.ok) {
        setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, statut: 'archived', externalId: null } : p))
      } else {
        const err = await res.json()
        alert(err.error ?? 'Erreur lors de la suppression LinkedIn')
      }
    } catch {
      alert('Erreur réseau')
    } finally {
      setUnlinkingPost(null)
    }
  }

  function toggleSelect(postId: string) {
    setSelectedPosts((prev) => {
      const next = new Set(prev)
      if (next.has(postId)) next.delete(postId)
      else next.add(postId)
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedPosts.size === filtered.length) {
      setSelectedPosts(new Set())
    } else {
      setSelectedPosts(new Set(filtered.map((p) => p.id)))
    }
  }

  async function bulkDelete() {
    if (selectedPosts.size === 0) return
    if (!confirm(`Supprimer ${selectedPosts.size} post${selectedPosts.size > 1 ? 's' : ''} ?`)) return
    setBulkDeleting(true)
    try {
      await Promise.all(
        Array.from(selectedPosts).map((id) =>
          fetch(`/api/posts/${id}`, { method: 'DELETE' })
        )
      )
      setPosts((prev) => prev.filter((p) => !selectedPosts.has(p.id)))
      setSelectedPosts(new Set())
      if (expandedPost && selectedPosts.has(expandedPost)) setExpandedPost(null)
    } finally {
      setBulkDeleting(false)
    }
  }

  const filtered = posts.filter((p) => {
    if (filter !== 'all' && p.statut !== filter) return false
    if (personaFilter !== 'all' && p.persona.slug !== personaFilter) return false
    return true
  })

  return (
    <div className="px-5 py-8 md:px-10 md:py-12 max-w-7xl">
      {/* Header */}
      <div className="animate-fade-up flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-white md:text-4xl">
            Posts
          </h1>
          <p className="mt-2 text-[15px] text-white/40 max-w-lg">
            Publications et calendrier éditorial.
          </p>
        </div>
        <button
          onClick={importLinkedInPosts}
          disabled={importing}
          className="mt-2 flex items-center gap-2 rounded-xl bg-accent-blue/10 border border-accent-blue/20 px-4 py-2.5 text-[12px] font-bold text-accent-blue hover:bg-accent-blue/15 transition-all disabled:opacity-50 shrink-0"
        >
          {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Importer LinkedIn
        </button>
      </div>

      {/* Calendar at the top */}
      <CalendarView onScheduled={loadPosts} />

      {/* Import result */}
      {importResult && (
        <div className="mt-4 animate-fade-up glass rounded-xl px-4 py-3 flex items-center justify-between">
          <p className="text-[13px] text-white/60">
            {importResult.error
              ? <span className="text-accent-pink">{importResult.error}</span>
              : importResult.new > 0
                ? <><span className="font-bold text-accent-teal">{importResult.new}</span> nouveau{importResult.new > 1 ? 'x' : ''} post{importResult.new > 1 ? 's' : ''} import&eacute;{importResult.new > 1 ? 's' : ''} ({importResult.total} total)</>
                : importResult.total > 0
                  ? <span>Tous les posts sont d&eacute;j&agrave; import&eacute;s ({importResult.total})</span>
                  : <span className="text-white/30">Aucun post trouv&eacute; sur LinkedIn</span>
            }
          </p>
          <button onClick={() => setImportResult(null)} className="text-white/20 hover:text-white/40">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="mt-8 flex flex-wrap items-center gap-2 animate-fade-up" style={{ animationDelay: '100ms' }}>
        <button
          onClick={toggleSelectAll}
          className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-[12px] font-bold transition-all ${
            selectedPosts.size > 0 && selectedPosts.size === filtered.length
              ? 'bg-accent-blue/15 text-accent-blue border border-accent-blue/30'
              : 'glass text-white/40 hover:text-white/60 border border-transparent'
          }`}
        >
          {selectedPosts.size > 0 && selectedPosts.size === filtered.length
            ? <CheckSquare className="h-3.5 w-3.5" />
            : <Square className="h-3.5 w-3.5" />}
          Tout
        </button>
        {selectedPosts.size > 0 && (
          <button
            onClick={bulkDelete}
            disabled={bulkDeleting}
            className="flex items-center gap-1.5 rounded-full bg-red-500/10 border border-red-500/20 px-4 py-2 text-[12px] font-bold text-red-400 hover:bg-red-500/15 transition-all disabled:opacity-50"
          >
            {bulkDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Supprimer {selectedPosts.size} post{selectedPosts.size > 1 ? 's' : ''}
          </button>
        )}
        <div className="w-px bg-white/[0.06] mx-1 h-6" />
        {([['all', 'Tous'], ['published', 'Publi\u00e9s'], ['approved', 'Valid\u00e9s'], ['draft', 'Brouillons']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => { setFilter(key); setSelectedPosts(new Set()) }}
            className={`rounded-full px-4 py-2 text-[12px] font-bold transition-all ${
              filter === key
                ? 'bg-accent-blue/15 text-accent-blue border border-accent-blue/30'
                : 'glass text-white/40 hover:text-white/60 border border-transparent'
            }`}
          >
            {label}
          </button>
        ))}
        <div className="w-px bg-white/[0.06] mx-1 h-6" />
        {([['all', 'Tous'], ['flipio', 'Flipio'], ['mdb', 'MdB']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => { setPersonaFilter(key); setSelectedPosts(new Set()) }}
            className={`rounded-full px-4 py-2 text-[12px] font-bold transition-all ${
              personaFilter === key
                ? 'bg-accent-teal/15 text-accent-teal border border-accent-teal/30'
                : 'glass text-white/40 hover:text-white/60 border border-transparent'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Posts list */}
      <div className="mt-8 space-y-3 animate-fade-up" style={{ animationDelay: '200ms' }}>
        {filtered.map((post) => {
          const isExpanded = expandedPost === post.id
          const postComments = comments[post.id] ?? []
          const s = statutConfig[post.statut] ?? statutConfig.draft

          const isDraft = post.statut === 'draft'

          const isSelected = selectedPosts.has(post.id)

          return (
            <div
              key={post.id}
              draggable={isDraft}
              onDragStart={isDraft ? (e) => { e.dataTransfer.setData('text/plain', post.id); e.dataTransfer.effectAllowed = 'move' } : undefined}
              className={`glass rounded-2xl overflow-hidden ${isDraft ? 'cursor-grab active:cursor-grabbing' : ''} ${isSelected ? 'ring-1 ring-accent-blue/30' : ''}`}
            >
              {/* Post header */}
              <div
                className="px-5 py-4 cursor-pointer transition-colors hover:bg-white/[0.02]"
                onClick={() => toggleExpand(post.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleSelect(post.id) }}
                      className="shrink-0 text-white/25 hover:text-accent-blue transition-colors"
                    >
                      {isSelected ? <CheckSquare className="h-4 w-4 text-accent-blue" /> : <Square className="h-4 w-4" />}
                    </button>
                    {isDraft && <GripVertical className="h-4 w-4 text-white/15 shrink-0 hidden md:block" />}
                    <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[11px] font-bold text-white/25 uppercase tracking-wider">{post.persona.nom}</span>
                      <span className="text-white/10">&middot;</span>
                      <span className="text-[11px] text-white/20">{typeLabels[post.type] ?? post.type}</span>
                      <span className="text-white/10">&middot;</span>
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                        post.platform === 'instagram' ? 'text-accent-pink bg-accent-pink/10' : 'text-accent-blue bg-accent-blue/10'
                      }`}>
                        {post.platform}
                      </span>
                    </div>
                    <p className="text-[14px] font-semibold text-white/80 line-clamp-2">{post.contenu.slice(0, 150)}{post.contenu.length > 150 ? '...' : ''}</p>
                    <div className="mt-2 flex items-center gap-3">
                      {post.statut === 'published' && post.externalId ? (
                        <span className="flex items-center gap-1.5 rounded-full bg-[#0A66C2]/10 px-2.5 py-1 text-[10px] font-bold text-[#0A66C2]">
                          <Linkedin className="h-3 w-3" />
                          Publié
                        </span>
                      ) : (
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${s.color}`}>{s.label}</span>
                      )}
                      <span className="text-[11px] text-white/20">
                        {post.publishedAt
                          ? new Date(post.publishedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
                          : getTimeAgo(post.createdAt)
                        }
                      </span>
                      {post._count.comments > 0 && (
                        <span className="flex items-center gap-1 text-[11px] text-white/30">
                          <MessageCircle className="h-3 w-3" />
                          {post._count.comments}
                        </span>
                      )}
                      {post.externalId && (
                        <a
                          href={`https://www.linkedin.com/feed/update/${post.externalId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 text-[11px] text-[#0A66C2]/50 hover:text-[#0A66C2] transition-colors"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Voir sur LinkedIn
                        </a>
                      )}
                    </div>
                  </div>
                  </div>
                  <div className="shrink-0 mt-1">
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-white/20" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-white/20" />
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded: full content + comments */}
              {isExpanded && (
                <div className="border-t border-white/[0.04]">
                  {/* Full post content */}
                  <div className="px-5 py-4 bg-white/[0.01]">
                    <p className="text-[13px] text-white/60 whitespace-pre-wrap leading-relaxed">{post.contenu}</p>
                  </div>

                  {/* Post actions */}
                  <div className="px-5 py-3 border-t border-white/[0.04] flex items-center gap-2">
                    {post.statut === 'approved' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); togglePostStatus(post.id, post.statut) }}
                        disabled={togglingPost === post.id}
                        className="flex items-center gap-1.5 rounded-lg bg-white/[0.04] px-3 py-1.5 text-[11px] font-bold text-white/40 hover:text-white/60 transition-colors disabled:opacity-50"
                      >
                        {togglingPost === post.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                        Repasser en brouillon
                      </button>
                    )}
                    {post.statut === 'draft' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); togglePostStatus(post.id, post.statut) }}
                        disabled={togglingPost === post.id}
                        className="flex items-center gap-1.5 rounded-lg bg-accent-blue/10 px-3 py-1.5 text-[11px] font-bold text-accent-blue hover:bg-accent-blue/15 transition-colors disabled:opacity-50"
                      >
                        {togglingPost === post.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                        Valider
                      </button>
                    )}
                    {post.statut === 'published' && post.externalId && (
                      <button
                        onClick={(e) => { e.stopPropagation(); unlinkFromLinkedIn(post.id) }}
                        disabled={unlinkingPost === post.id}
                        className="flex items-center gap-1.5 rounded-lg bg-red-400/5 px-3 py-1.5 text-[11px] font-bold text-red-400/50 hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-50"
                      >
                        {unlinkingPost === post.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Unlink className="h-3 w-3" />}
                        Supprimer de LinkedIn
                      </button>
                    )}
                    {post.statut !== 'published' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); deletePost(post.id) }}
                        disabled={deletingPost === post.id}
                        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold text-red-400/50 hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-50 ml-auto"
                      >
                        {deletingPost === post.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                        Supprimer
                      </button>
                    )}
                  </div>

                  {/* Comments section */}
                  <div className="border-t border-white/[0.04] px-5 py-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-[13px] font-bold text-white/60">
                        Commentaires ({postComments.length})
                      </h3>
                      {post.statut === 'published' && post.externalId && (
                        <button
                          onClick={(e) => { e.stopPropagation(); fetchNewComments(post.id) }}
                          disabled={pollingPost === post.id}
                          className="flex items-center gap-1.5 rounded-lg bg-accent-blue/10 px-3 py-1.5 text-[11px] font-bold text-accent-blue hover:bg-accent-blue/15 transition-colors disabled:opacity-50"
                        >
                          <RefreshCw className={`h-3 w-3 ${pollingPost === post.id ? 'animate-spin' : ''}`} />
                          R&eacute;cup&eacute;rer
                        </button>
                      )}
                    </div>

                    {loadingComments === post.id && (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="h-5 w-5 text-white/20 animate-spin" />
                      </div>
                    )}

                    {postComments.length === 0 && loadingComments !== post.id && (
                      <p className="text-[12px] text-white/20 text-center py-6">
                        Aucun commentaire{post.statut === 'published' && post.externalId ? ' — cliquez sur R\u00e9cup\u00e9rer' : ''}
                      </p>
                    )}

                    <div className="space-y-3">
                      {postComments.map((comment) => (
                        <CommentCard
                          key={comment.id}
                          comment={comment}
                          isGenerating={generatingReply === comment.id}
                          isSending={sendingReply === comment.id}
                          isEditing={editingReply === comment.id}
                          editDraft={editDraft}
                          onGenerateReply={() => generateReply(comment.id)}
                          onApproveReply={(reply) => approveReply(comment.id, reply)}
                          onIgnore={() => ignoreComment(comment.id)}
                          onStartEdit={() => { setEditingReply(comment.id); setEditDraft(comment.draftReply ?? '') }}
                          onCancelEdit={() => setEditingReply(null)}
                          onEditChange={setEditDraft}
                          onSaveEdit={() => saveEditedReply(comment.id)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div className="glass rounded-2xl p-12 text-center">
            <p className="text-[14px] text-white/25">Aucun post</p>
          </div>
        )}
      </div>
    </div>
  )
}

function CommentCard({
  comment,
  isGenerating,
  isSending,
  isEditing,
  editDraft,
  onGenerateReply,
  onApproveReply,
  onIgnore,
  onStartEdit,
  onCancelEdit,
  onEditChange,
  onSaveEdit,
}: {
  comment: CommentItem
  isGenerating: boolean
  isSending: boolean
  isEditing: boolean
  editDraft: string
  onGenerateReply: () => void
  onApproveReply: (reply: string) => void
  onIgnore: () => void
  onStartEdit: () => void
  onCancelEdit: () => void
  onEditChange: (v: string) => void
  onSaveEdit: () => void
}) {
  const isHandled = comment.statut === 'replied' || comment.statut === 'ignored'

  return (
    <div className={`rounded-xl border p-4 transition-colors ${
      isHandled ? 'border-white/[0.04] bg-white/[0.01]' : 'border-white/[0.06] bg-white/[0.02]'
    }`}>
      {/* Author */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <span className="text-[13px] font-bold text-white/70">{comment.authorName}</span>
          {comment.authorHeadline && (
            <span className="ml-2 text-[11px] text-white/25">{comment.authorHeadline}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {comment.isQuestion && (
            <span className="rounded-full bg-amber-400/10 px-2 py-0.5 text-[9px] font-bold text-amber-400">Question</span>
          )}
          {comment.isProspect && (
            <span className="rounded-full bg-accent-teal/10 px-2 py-0.5 text-[9px] font-bold text-accent-teal">Prospect</span>
          )}
          {comment.statut === 'replied' && (
            <span className="rounded-full bg-accent-teal/10 px-2 py-0.5 text-[9px] font-bold text-accent-teal">R&eacute;pondu</span>
          )}
          {comment.statut === 'ignored' && (
            <span className="rounded-full bg-white/[0.04] px-2 py-0.5 text-[9px] font-bold text-white/25">Ignor&eacute;</span>
          )}
        </div>
      </div>

      {/* Comment content */}
      <p className="text-[13px] text-white/50 leading-relaxed">{comment.contenu}</p>

      {/* Draft reply */}
      {comment.draftReply && !isEditing && (
        <div className="mt-3 rounded-lg bg-accent-blue/5 border border-accent-blue/10 p-3">
          <p className="text-[11px] font-bold text-accent-blue/60 mb-1">R&eacute;ponse g&eacute;n&eacute;r&eacute;e</p>
          <p className="text-[12px] text-white/50 leading-relaxed">{comment.draftReply}</p>
        </div>
      )}

      {/* Edit draft */}
      {isEditing && (
        <div className="mt-3">
          <textarea
            value={editDraft}
            onChange={(e) => onEditChange(e.target.value)}
            rows={3}
            className="w-full rounded-lg bg-white/[0.06] border border-white/[0.1] px-3 py-2 text-[12px] text-white placeholder:text-white/20 focus:outline-none focus:border-accent-blue/40 transition-all resize-none"
          />
          <div className="mt-2 flex items-center gap-2 justify-end">
            <button onClick={onCancelEdit} className="text-[11px] font-bold text-white/30 hover:text-white/50">
              Annuler
            </button>
            <button onClick={onSaveEdit} className="flex items-center gap-1 rounded-lg bg-accent-blue/10 px-3 py-1.5 text-[11px] font-bold text-accent-blue hover:bg-accent-blue/15">
              <Check className="h-3 w-3" /> Sauver
            </button>
          </div>
        </div>
      )}

      {/* Actions */}
      {!isHandled && (
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {!comment.draftReply && (
            <button
              onClick={onGenerateReply}
              disabled={isGenerating}
              className="flex items-center gap-1.5 rounded-lg bg-accent-blue/10 px-3 py-1.5 text-[11px] font-bold text-accent-blue hover:bg-accent-blue/15 transition-colors disabled:opacity-50"
            >
              {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageCircle className="h-3 w-3" />}
              G&eacute;n&eacute;rer r&eacute;ponse
            </button>
          )}
          {comment.draftReply && !isEditing && (
            <>
              <button
                onClick={() => onApproveReply(comment.draftReply!)}
                disabled={isSending}
                className="flex items-center gap-1.5 rounded-lg bg-accent-teal/10 px-3 py-1.5 text-[11px] font-bold text-accent-teal hover:bg-accent-teal/15 transition-colors disabled:opacity-50"
              >
                {isSending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                Envoyer
              </button>
              <button
                onClick={onStartEdit}
                className="flex items-center gap-1.5 rounded-lg bg-white/[0.04] px-3 py-1.5 text-[11px] font-bold text-white/40 hover:text-white/60 transition-colors"
              >
                <Pencil className="h-3 w-3" /> Modifier
              </button>
            </>
          )}
          <button
            onClick={onIgnore}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold text-white/20 hover:text-white/40 transition-colors"
          >
            <X className="h-3 w-3" /> Ignorer
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Calendar View ───

interface CalendarPostItem {
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
  posts: CalendarPostItem[]
  drafts: CalendarPostItem[]
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

const calTypeConfig: Record<string, { label: string; icon: typeof Pencil; color: string; bg: string }> = {
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

function CalendarView({ onScheduled }: { onScheduled?: () => void }) {
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()))
  const [data, setData] = useState<CalendarData | null>(null)
  const [loading, setLoading] = useState(true)
  const [dragOverDay, setDragOverDay] = useState<string | null>(null)
  const [scheduling, setScheduling] = useState<string | null>(null)

  const fetchCalendar = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/calendar?start=${weekStart.toISOString()}`)
      if (res.ok) {
        const json = await res.json()
        if (json.posts) setData(json)
      }
    } catch { /* silently fail */ }
    finally { setLoading(false) }
  }, [weekStart])

  useEffect(() => { fetchCalendar() }, [fetchCalendar])

  async function scheduleDraftToDay(postId: string, dayKey: string) {
    setScheduling(postId)
    try {
      const publishAt = new Date(`${dayKey}T09:00:00`).toISOString()
      const res = await fetch(`/api/posts/${postId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publishAt, statut: 'approved' }),
      })
      if (res.ok) {
        await fetchCalendar()
        onScheduled?.()
      }
    } finally {
      setScheduling(null)
      setDragOverDay(null)
    }
  }

  function handleDragStart(e: React.DragEvent, postId: string) {
    e.dataTransfer.setData('text/plain', postId)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragEnter(e: React.DragEvent, dayKey: string) {
    e.preventDefault()
    e.stopPropagation()
    setDragOverDay(dayKey)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    // Only clear if leaving the cell itself, not entering a child
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const { clientX, clientY } = e
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
      setDragOverDay(null)
    }
  }

  function handleDrop(e: React.DragEvent, dayKey: string) {
    e.preventDefault()
    e.stopPropagation()
    setDragOverDay(null)
    const postId = e.dataTransfer.getData('text/plain')
    if (postId) scheduleDraftToDay(postId, dayKey)
  }

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

  const days: Date[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    days.push(d)
  }

  function postsForDay(date: Date): CalendarPostItem[] {
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

  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  const monthStart = weekStart.toLocaleDateString('fr-FR', { month: 'long' })
  const monthEnd = weekEnd.toLocaleDateString('fr-FR', { month: 'long' })
  const weekLabel = monthStart === monthEnd
    ? `${weekStart.getDate()} — ${weekEnd.getDate()} ${monthStart} ${weekEnd.getFullYear()}`
    : `${weekStart.getDate()} ${monthStart} — ${weekEnd.getDate()} ${monthEnd} ${weekEnd.getFullYear()}`

  return (
    <div className="mt-8">
      {/* Week navigation */}
      <div className="flex items-center justify-between animate-fade-up">
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
        <div className="mt-6 flex gap-3 flex-wrap animate-fade-up">
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
            const cfg = calTypeConfig[type]
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
      <div className="mt-8 animate-fade-up">
        {loading ? (
          <div className="glass rounded-2xl p-14 text-center">
            <Loader2 className="h-6 w-6 text-white/30 animate-spin mx-auto" />
            <p className="mt-3 text-[13px] text-white/30">Chargement...</p>
          </div>
        ) : (
          <>
            {/* Desktop grid */}
            <div className="hidden md:grid grid-cols-7 gap-2">
              {days.map((day, i) => {
                const dayKey = day.toISOString().split('T')[0]
                const isToday = dayKey === today
                return (
                  <div key={i} className="text-center pb-2">
                    <p className={`text-[11px] font-bold uppercase tracking-wider ${isToday ? 'text-accent-blue' : 'text-white/25'}`}>{DAYS_FR[i]}</p>
                    <p className={`text-[18px] font-extrabold mt-0.5 ${isToday ? 'text-accent-blue' : 'text-white/60'}`}>{day.getDate()}</p>
                  </div>
                )
              })}
              {days.map((day, i) => {
                const dayPosts = postsForDay(day)
                const suggestion = suggestionForDay(day)
                const dayKey = day.toISOString().split('T')[0]
                const isToday = dayKey === today
                const isPast = dayKey < today
                const isDragOver = dragOverDay === dayKey && !isPast
                return (
                  <div
                    key={`col-${i}`}
                    onDragEnter={!isPast ? (e) => handleDragEnter(e, dayKey) : undefined}
                    onDragOver={!isPast ? (e) => handleDragOver(e) : undefined}
                    onDragLeave={!isPast ? (e) => handleDragLeave(e) : undefined}
                    onDrop={!isPast ? (e) => handleDrop(e, dayKey) : undefined}
                    className={`glass rounded-2xl p-3 min-h-[180px] transition-all ${isToday ? 'border border-accent-blue/20 shadow-lg shadow-accent-blue/5' : ''} ${isPast ? 'opacity-50' : ''} ${isDragOver ? 'ring-2 ring-accent-blue/40 bg-accent-blue/[0.04]' : ''}`}
                  >
                    {dayPosts.length > 0 ? (
                      <div className="space-y-2">
                        {dayPosts.map((post) => <CalPostChip key={post.id} post={post} />)}
                      </div>
                    ) : suggestion && !isPast ? (
                      <CalSuggestionChip suggestion={suggestion} />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-[11px] text-white/15 font-medium">{isDragOver ? 'Déposer ici' : 'Aucun post'}</p>
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
                  <div key={i} className={`glass rounded-2xl p-4 ${isToday ? 'border border-accent-blue/20' : ''} ${isPast ? 'opacity-50' : ''}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className={`text-[13px] font-bold ${isToday ? 'text-accent-blue' : 'text-white/60'}`}>{DAYS_FULL_FR[i]}</span>
                        <span className="text-[12px] text-white/25">{day.getDate()}</span>
                      </div>
                      {isToday && (
                        <span className="rounded-full bg-accent-blue/10 px-2.5 py-0.5 text-[10px] font-bold text-accent-blue">Aujourd&apos;hui</span>
                      )}
                    </div>
                    {dayPosts.length > 0 ? (
                      <div className="space-y-2">
                        {dayPosts.map((post) => <CalPostChip key={post.id} post={post} />)}
                      </div>
                    ) : suggestion && !isPast ? (
                      <CalSuggestionChip suggestion={suggestion} />
                    ) : (
                      <p className="text-[12px] text-white/20 py-2">Aucun post prévu</p>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Drafts */}
            {data && data.drafts.length > 0 && (
              <div className="mt-10">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display text-lg font-bold tracking-tight text-white">
                    Brouillons à planifier
                    <span className="ml-2 text-[12px] font-bold text-white/25">{data.drafts.length}</span>
                  </h2>
                  <p className="text-[11px] text-white/20 hidden md:block">Glissez-déposez sur le calendrier ci-dessus</p>
                </div>
                <div className="glass rounded-2xl overflow-hidden divide-y divide-white/[0.04]">
                  {data.drafts.map((draft) => {
                    const cfg = calTypeConfig[draft.type] ?? { label: draft.type, icon: Pencil, color: 'text-white/40', bg: 'bg-white/[0.04]' }
                    const Icon = cfg.icon
                    const isScheduling = scheduling === draft.id
                    return (
                      <div
                        key={draft.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, draft.id)}
                        className={`flex items-center justify-between px-5 py-3.5 transition-colors hover:bg-white/[0.02] cursor-grab active:cursor-grabbing ${isScheduling ? 'opacity-50' : ''}`}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <GripVertical className="h-4 w-4 text-white/15 shrink-0" />
                          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${cfg.bg}`}>
                            {isScheduling ? <Loader2 className={`h-3.5 w-3.5 animate-spin ${cfg.color}`} /> : <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className={`text-[11px] font-bold ${cfg.color}`}>{cfg.label}</span>
                              <span className="text-[10px] text-white/20">{draft.persona.nom}</span>
                            </div>
                            <p className="text-[12px] text-white/50 truncate">{draft.contenu.slice(0, 60)}</p>
                          </div>
                        </div>
                        <span className="rounded-full bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold text-white/30 shrink-0 ml-3">
                          {isScheduling ? 'Planification...' : 'Glisser sur une date'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function CalPostChip({ post }: { post: CalendarPostItem }) {
  const cfg = calTypeConfig[post.type] ?? { label: post.type, icon: Pencil, color: 'text-white/40', bg: 'bg-white/[0.04]' }
  const Icon = cfg.icon
  const time = post.publishAt
    ? new Date(post.publishAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : null
  const statutColors: Record<string, string> = { approved: 'border-accent-blue/20', published: 'border-accent-teal/20' }

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
        <span className="text-white/10">&middot;</span>
        <span className="text-[9px] text-white/15">{post.platform}</span>
        {post.statut === 'published' && <span className="ml-auto text-[9px] font-bold text-accent-teal">Publié</span>}
      </div>
    </div>
  )
}

function CalSuggestionChip({ suggestion }: { suggestion: Suggestion }) {
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
