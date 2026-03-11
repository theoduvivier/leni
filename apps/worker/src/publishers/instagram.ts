import { db } from '@leni/db'

/**
 * Instagram Graph API Publisher
 *
 * Flow:
 * 1. Create a media container (image + caption, or carousel)
 * 2. Wait for container to be ready
 * 3. Publish the container
 *
 * Requires:
 * - INSTAGRAM_ACCESS_TOKEN (long-lived page token)
 * - INSTAGRAM_BUSINESS_ACCOUNT_ID
 *
 * Note: Instagram Graph API requires images to be accessible via public URL.
 * For local uploads, images must be served publicly first.
 */

const GRAPH_API = 'https://graph.facebook.com/v21.0'

function log(level: string, message: string, extra?: Record<string, unknown>) {
  console.log(JSON.stringify({
    level,
    message,
    timestamp: new Date().toISOString(),
    service: 'publisher-instagram',
    ...extra,
  }))
}

function getConfig() {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN
  const accountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID

  if (!accessToken) throw new Error('INSTAGRAM_ACCESS_TOKEN not configured')
  if (!accountId) throw new Error('INSTAGRAM_BUSINESS_ACCOUNT_ID not configured')

  return { accessToken, accountId }
}

/**
 * Create a single image media container.
 */
async function createImageContainer(
  accountId: string,
  accessToken: string,
  imageUrl: string,
  caption: string
): Promise<string> {
  const res = await fetch(`${GRAPH_API}/${accountId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image_url: imageUrl,
      caption,
      access_token: accessToken,
    }),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Instagram create container failed: ${error}`)
  }

  const data = await res.json()
  return data.id
}

/**
 * Create a carousel container with multiple images.
 */
async function createCarouselContainer(
  accountId: string,
  accessToken: string,
  imageUrls: string[],
  caption: string
): Promise<string> {
  // Step 1: Create individual image containers (no caption, children of carousel)
  const childIds: string[] = []
  for (const url of imageUrls) {
    const res = await fetch(`${GRAPH_API}/${accountId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: url,
        is_carousel_item: true,
        access_token: accessToken,
      }),
    })

    if (!res.ok) {
      const error = await res.text()
      throw new Error(`Instagram carousel child creation failed: ${error}`)
    }

    const data = await res.json()
    childIds.push(data.id)
  }

  // Step 2: Create the carousel container
  const res = await fetch(`${GRAPH_API}/${accountId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      media_type: 'CAROUSEL',
      children: childIds,
      caption,
      access_token: accessToken,
    }),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Instagram carousel container failed: ${error}`)
  }

  const data = await res.json()
  return data.id
}

/**
 * Wait for a media container to finish processing.
 * Instagram needs time to process uploaded media.
 */
async function waitForContainer(containerId: string, accessToken: string, maxRetries = 10): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    const res = await fetch(
      `${GRAPH_API}/${containerId}?fields=status_code&access_token=${accessToken}`
    )

    if (res.ok) {
      const data = await res.json()
      if (data.status_code === 'FINISHED') return
      if (data.status_code === 'ERROR') {
        throw new Error(`Instagram container processing failed: ${data.status_code}`)
      }
    }

    // Wait 2 seconds before retrying
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }

  throw new Error('Instagram container processing timed out')
}

/**
 * Publish a media container (make it visible on the feed).
 */
async function publishContainer(
  accountId: string,
  accessToken: string,
  containerId: string
): Promise<string> {
  const res = await fetch(`${GRAPH_API}/${accountId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      creation_id: containerId,
      access_token: accessToken,
    }),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Instagram publish failed: ${error}`)
  }

  const data = await res.json()
  return data.id
}

/**
 * Publish a post to Instagram.
 * Supports: single image, carousel (multiple images), caption-only (requires image).
 */
export async function publishToInstagram(postId: string): Promise<string> {
  const post = await db.post.findUnique({
    where: { id: postId },
    include: { persona: true },
  })

  if (!post) throw new Error(`Post ${postId} not found`)
  if (post.statut !== 'approved') throw new Error(`Post ${postId} is not approved`)

  const { accessToken, accountId } = getConfig()

  // Get media associated with this post
  const media = await db.media.findMany({
    where: { postId },
  })

  if (media.length === 0) {
    throw new Error(`Post ${postId} has no media — Instagram requires at least one image`)
  }

  // Build public URLs for images
  // In production, these should be publicly accessible URLs
  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  const imageUrls = media.map((m) => `${baseUrl}/uploads/${m.filename}`)

  let containerId: string

  if (imageUrls.length === 1) {
    // Single image post
    containerId = await createImageContainer(accountId, accessToken, imageUrls[0], post.contenu)
  } else {
    // Carousel post
    containerId = await createCarouselContainer(accountId, accessToken, imageUrls, post.contenu)
  }

  // Wait for processing
  await waitForContainer(containerId, accessToken)

  // Publish
  const externalId = await publishContainer(accountId, accessToken, containerId)

  // Update post status
  await db.post.update({
    where: { id: postId },
    data: {
      statut: 'published',
      publishedAt: new Date(),
      externalId,
    },
  })

  log('info', `Published to Instagram: ${externalId}`, {
    postId,
    externalId,
    mediaCount: media.length,
  })

  return externalId
}
