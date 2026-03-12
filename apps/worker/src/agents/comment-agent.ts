import { db } from '@leni/db'
import { callLLM } from '../lib/llm'
import { getLinkedInAccessToken } from '../publishers/linkedin'
import { z } from 'zod'

const LLMReply = z.object({
  classification: z.enum(['question', 'prospect', 'compliment', 'debat', 'spam']),
  isQuestion: z.boolean(),
  isProspect: z.boolean(),
  reply: z.string().nullable(),
  shouldDM: z.boolean(),
})

function log(level: string, message: string, extra?: Record<string, unknown>) {
  console.log(JSON.stringify({
    level,
    message,
    timestamp: new Date().toISOString(),
    service: 'comment-agent',
    ...extra,
  }))
}

interface LinkedInComment {
  id: string
  authorName: string
  authorHeadline: string
  text: string
}

/**
 * Fetch comments from LinkedIn API for a given post URN.
 * Returns normalized comment objects.
 */
async function fetchLinkedInComments(postUrn: string): Promise<LinkedInComment[]> {
  let accessToken: string
  try {
    accessToken = await getLinkedInAccessToken()
  } catch {
    log('warn', 'LinkedIn not connected — skipping comment fetch')
    return []
  }

  try {
    // Fetch comments on the post
    const commentsRes = await fetch(
      `https://api.linkedin.com/v2/socialActions/${encodeURIComponent(postUrn)}/comments?count=50`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
        },
      }
    )

    if (!commentsRes.ok) {
      const error = await commentsRes.text()
      log('error', `Failed to fetch comments for ${postUrn}: ${error}`)
      return []
    }

    const data = await commentsRes.json()
    const elements = data.elements ?? []

    const comments: LinkedInComment[] = []
    for (const el of elements) {
      const commentUrn = el['$URN'] ?? el.commentUrn ?? ''
      const text = el.message?.text ?? ''
      if (!text || !commentUrn) continue

      // Extract author info from the actor field
      const actorName = el.actor?.['com.linkedin.voyager.feed.MemberActor']?.miniProfile?.firstName
        ? `${el.actor['com.linkedin.voyager.feed.MemberActor'].miniProfile.firstName} ${el.actor['com.linkedin.voyager.feed.MemberActor'].miniProfile.lastName}`
        : el.actorName ?? 'Inconnu'
      const actorHeadline = el.actor?.['com.linkedin.voyager.feed.MemberActor']?.miniProfile?.occupation ?? ''

      comments.push({
        id: commentUrn,
        authorName: actorName,
        authorHeadline: actorHeadline,
        text,
      })
    }

    return comments
  } catch (err) {
    log('error', `Error fetching comments for ${postUrn}: ${err instanceof Error ? err.message : 'unknown'}`)
    return []
  }
}

/**
 * Process a single comment with LLM to generate a draft reply.
 */
async function processComment(
  comment: LinkedInComment,
  postContenu: string,
  personaSlug: string
): Promise<{ classification: string; isQuestion: boolean; isProspect: boolean; reply: string | null; shouldDM: boolean }> {
  const prompt = `Commentaire LinkedIn à analyser :
Auteur : ${comment.authorName}
Headline : ${comment.authorHeadline || 'Non renseigné'}
Commentaire : "${comment.text}"

Post original (contexte) :
"${postContenu.slice(0, 500)}"

Persona : ${personaSlug}

Analyse ce commentaire et rédige une réponse. Retourne UNIQUEMENT du JSON valide.`

  const raw = await callLLM(personaSlug, 'comment_reply', prompt, 512)

  // Extract JSON from response
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    log('warn', `Could not parse LLM reply for comment ${comment.id}`)
    return { classification: 'compliment', isQuestion: false, isProspect: false, reply: null, shouldDM: false }
  }

  try {
    const parsed = LLMReply.parse(JSON.parse(jsonMatch[0]))
    return parsed
  } catch {
    log('warn', `Invalid LLM reply format for comment ${comment.id}`)
    return { classification: 'compliment', isQuestion: false, isProspect: false, reply: null, shouldDM: false }
  }
}

/**
 * Main entry point: scan all published posts for new comments,
 * classify them with LLM, and store draft replies.
 */
export async function pollComments(): Promise<{ scanned: number; newComments: number; drafted: number }> {
  log('info', 'Starting comment poll')

  // Get all published LinkedIn posts with an externalId
  const posts = await db.post.findMany({
    where: {
      statut: 'published',
      platform: 'linkedin',
      externalId: { not: null },
    },
    include: { persona: true },
    orderBy: { publishedAt: 'desc' },
    take: 20, // Only scan the 20 most recent published posts
  })

  let scanned = 0
  let newComments = 0
  let drafted = 0

  for (const post of posts) {
    if (!post.externalId) continue
    scanned++

    const linkedInComments = await fetchLinkedInComments(post.externalId)

    for (const liComment of linkedInComments) {
      // Check if we already have this comment
      const existing = await db.comment.findUnique({
        where: { externalId: liComment.id },
      })
      if (existing) continue

      newComments++

      // Process with LLM
      const result = await processComment(liComment, post.contenu, post.persona.slug)

      // Store in DB
      await db.comment.create({
        data: {
          postId: post.id,
          externalId: liComment.id,
          authorName: liComment.authorName,
          authorHeadline: liComment.authorHeadline || null,
          contenu: liComment.text,
          isQuestion: result.isQuestion,
          isProspect: result.isProspect,
          draftReply: result.reply,
          statut: result.classification === 'spam' ? 'ignored' : 'pending',
        },
      })

      if (result.reply) drafted++

      log('info', `Comment processed`, {
        commentId: liComment.id,
        classification: result.classification,
        hasReply: !!result.reply,
        postId: post.id,
      })
    }
  }

  log('info', `Comment poll complete`, { scanned, newComments, drafted })
  return { scanned, newComments, drafted }
}

/**
 * Reply to a comment on LinkedIn via the API.
 */
export async function replyToComment(commentId: string): Promise<string> {
  const comment = await db.comment.findUnique({
    where: { id: commentId },
    include: { post: true },
  })

  if (!comment) throw new Error(`Comment ${commentId} not found`)
  if (comment.statut !== 'approved') throw new Error(`Comment ${commentId} is not approved`)
  if (!comment.draftReply) throw new Error(`Comment ${commentId} has no draft reply`)
  if (!comment.post.externalId) throw new Error(`Post ${comment.postId} has no externalId`)

  const accessToken = await getLinkedInAccessToken()

  // Get author URN
  const { getLinkedInPersonId } = await import('../publishers/linkedin')
  const personId = await getLinkedInPersonId(accessToken)

  // Post reply
  const replyRes = await fetch(
    `https://api.linkedin.com/v2/socialActions/${encodeURIComponent(comment.post.externalId)}/comments`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify({
        actor: `urn:li:person:${personId}`,
        message: { text: comment.draftReply },
        parentComment: comment.externalId,
      }),
    }
  )

  if (!replyRes.ok) {
    const error = await replyRes.text()
    throw new Error(`LinkedIn reply failed: ${error}`)
  }

  await db.comment.update({
    where: { id: commentId },
    data: { statut: 'replied' },
  })

  log('info', `Replied to comment ${commentId} on post ${comment.postId}`)
  return commentId
}
