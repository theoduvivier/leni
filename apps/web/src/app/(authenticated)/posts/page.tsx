'use client'

import { useState, useEffect } from 'react'
import { MessageCircle, RefreshCw, Send, ChevronDown, ChevronUp, Pencil, Check, X, Loader2 } from 'lucide-react'

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

  useEffect(() => {
    loadPosts()
  }, [])

  async function loadPosts() {
    const res = await fetch('/api/posts?limit=50')
    const data = await res.json()
    setPosts(data.posts ?? [])
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

  const filtered = posts.filter((p) => {
    if (filter !== 'all' && p.statut !== filter) return false
    if (personaFilter !== 'all' && p.persona.slug !== personaFilter) return false
    return true
  })

  return (
    <div className="px-5 py-8 md:px-10 md:py-12 max-w-6xl">
      {/* Header */}
      <div className="animate-fade-up">
        <p className="text-[13px] font-semibold text-accent-blue tracking-wide uppercase">Posts</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-white md:text-4xl">
          Mes publications
        </h1>
        <p className="mt-2 text-[15px] text-white/40 max-w-lg">
          Tous vos posts avec commentaires et r&eacute;ponses.
        </p>
      </div>

      {/* Filters */}
      <div className="mt-8 flex flex-wrap gap-2 animate-fade-up" style={{ animationDelay: '100ms' }}>
        {([['all', 'Tous'], ['published', 'Publi\u00e9s'], ['approved', 'Valid\u00e9s'], ['draft', 'Brouillons']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`rounded-full px-4 py-2 text-[12px] font-bold transition-all ${
              filter === key
                ? 'bg-accent-blue/15 text-accent-blue border border-accent-blue/30'
                : 'glass text-white/40 hover:text-white/60 border border-transparent'
            }`}
          >
            {label}
          </button>
        ))}
        <div className="w-px bg-white/[0.06] mx-1" />
        {([['all', 'Tous'], ['flipio', 'Flipio'], ['mdb', 'MdB']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setPersonaFilter(key)}
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

          return (
            <div key={post.id} className="glass rounded-2xl overflow-hidden">
              {/* Post header */}
              <div
                className="px-5 py-4 cursor-pointer transition-colors hover:bg-white/[0.02]"
                onClick={() => toggleExpand(post.id)}
              >
                <div className="flex items-start justify-between gap-3">
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
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${s.color}`}>{s.label}</span>
                      <span className="text-[11px] text-white/20">{getTimeAgo(post.createdAt)}</span>
                      {post._count.comments > 0 && (
                        <span className="flex items-center gap-1 text-[11px] text-white/30">
                          <MessageCircle className="h-3 w-3" />
                          {post._count.comments}
                        </span>
                      )}
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
