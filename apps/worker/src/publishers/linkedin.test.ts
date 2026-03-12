import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockOAuthToken, mockPost, mockFetch } = vi.hoisted(() => ({
  mockOAuthToken: { findUnique: vi.fn() },
  mockPost: { findUnique: vi.fn(), update: vi.fn() },
  mockFetch: vi.fn(),
}))

vi.mock('@leni/db', () => ({ db: { oAuthToken: mockOAuthToken, post: mockPost } }))
vi.stubGlobal('fetch', mockFetch)

import { encryptToken, decryptToken, publishToLinkedIn, getLinkedInAccessToken } from './linkedin'

describe('encryptToken / decryptToken', () => {
  const ORIGINAL_ENV = process.env

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, ENCRYPTION_KEY: 'abcdefghijklmnopqrstuvwxyz012345' }
  })

  it('round-trips correctly', () => {
    const token = 'my-secret-linkedin-access-token-12345'
    const encrypted = encryptToken(token)
    const decrypted = decryptToken(encrypted)
    expect(decrypted).toBe(token)
  })

  it('produces different ciphertexts for same token (random IV)', () => {
    const token = 'same-token'
    const a = encryptToken(token)
    const b = encryptToken(token)
    expect(a).not.toBe(b)
  })

  it('throws on invalid encrypted data format', () => {
    expect(() => decryptToken('garbage')).toThrow('Invalid encrypted data format')
  })

  it('throws on wrong encryption key', () => {
    const token = 'test-token'
    const encrypted = encryptToken(token)
    process.env.ENCRYPTION_KEY = 'different_key_abcdefghijklmnopqrst'
    expect(() => decryptToken(encrypted)).toThrow()
  })

  it('throws when ENCRYPTION_KEY is missing', () => {
    delete process.env.ENCRYPTION_KEY
    expect(() => encryptToken('token')).toThrow('ENCRYPTION_KEY must be at least 32')
  })

  afterAll(() => {
    process.env = ORIGINAL_ENV
  })
})

describe('getLinkedInAccessToken', () => {
  const ORIGINAL_ENV = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...ORIGINAL_ENV, ENCRYPTION_KEY: 'abcdefghijklmnopqrstuvwxyz012345' }
  })

  it('returns decrypted token from DB', async () => {
    const encrypted = encryptToken('db-token')
    mockOAuthToken.findUnique.mockResolvedValue({
      accessToken: encrypted,
      expiresAt: new Date(Date.now() + 86400000),
    })

    const result = await getLinkedInAccessToken()
    expect(result).toBe('db-token')
  })

  it('throws when DB token is expired', async () => {
    mockOAuthToken.findUnique.mockResolvedValue({
      accessToken: encryptToken('expired'),
      expiresAt: new Date(Date.now() - 1000),
    })

    await expect(getLinkedInAccessToken()).rejects.toThrow('expired')
  })

  it('falls back to env var when no DB token', async () => {
    mockOAuthToken.findUnique.mockResolvedValue(null)
    process.env.LINKEDIN_ACCESS_TOKEN = 'env-token'

    const result = await getLinkedInAccessToken()
    expect(result).toBe('env-token')
  })

  it('throws when no token anywhere', async () => {
    mockOAuthToken.findUnique.mockResolvedValue(null)
    delete process.env.LINKEDIN_ACCESS_TOKEN

    await expect(getLinkedInAccessToken()).rejects.toThrow('not connected')
  })

  afterAll(() => {
    process.env = ORIGINAL_ENV
  })
})

describe('publishToLinkedIn', () => {
  const ORIGINAL_ENV = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...ORIGINAL_ENV, ENCRYPTION_KEY: 'abcdefghijklmnopqrstuvwxyz012345' }
  })

  it('publishes text-only post on happy path', async () => {
    mockPost.findUnique.mockResolvedValue({
      id: 'post-1',
      statut: 'approved',
      contenu: 'My great LinkedIn post',
      mediaUrl: null,
      persona: { slug: 'flipio' },
    })
    mockOAuthToken.findUnique.mockResolvedValue({
      accessToken: encryptToken('access-token'),
      expiresAt: new Date(Date.now() + 86400000),
    })
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ sub: 'person-1' }) }) // userinfo
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'urn:li:ugcPost:123' }) }) // publish

    const result = await publishToLinkedIn('post-1')

    expect(result).toBe('urn:li:ugcPost:123')
    expect(mockPost.update).toHaveBeenCalledWith({
      where: { id: 'post-1' },
      data: expect.objectContaining({
        statut: 'published',
        externalId: 'urn:li:ugcPost:123',
      }),
    })

    // Verify text-only post body
    const publishCall = mockFetch.mock.calls[1]
    const body = JSON.parse(publishCall[1].body)
    expect(body.specificContent['com.linkedin.ugc.ShareContent'].shareMediaCategory).toBe('NONE')
    expect(body.specificContent['com.linkedin.ugc.ShareContent'].media).toBeUndefined()
  })

  it('publishes image post when mediaUrl is present', async () => {
    mockPost.findUnique.mockResolvedValue({
      id: 'post-2',
      statut: 'approved',
      contenu: 'Post with image',
      mediaUrl: 'https://images.pexels.com/photos/123/test.jpg',
      persona: { slug: 'flipio' },
    })
    mockOAuthToken.findUnique.mockResolvedValue({
      accessToken: encryptToken('access-token'),
      expiresAt: new Date(Date.now() + 86400000),
    })

    const fakeImageBuffer = new ArrayBuffer(100)
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ sub: 'person-1' }) }) // userinfo
      .mockResolvedValueOnce({ // register upload
        ok: true,
        json: () => Promise.resolve({
          value: {
            uploadMechanism: {
              'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest': {
                uploadUrl: 'https://api.linkedin.com/upload/12345',
              },
            },
            asset: 'urn:li:digitalmediaAsset:D123',
          },
        }),
      })
      .mockResolvedValueOnce({ ok: true, arrayBuffer: () => Promise.resolve(fakeImageBuffer) }) // download image
      .mockResolvedValueOnce({ ok: true }) // upload binary
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'urn:li:ugcPost:456' }) }) // publish

    const result = await publishToLinkedIn('post-2')

    expect(result).toBe('urn:li:ugcPost:456')

    // Verify image post body
    const publishCall = mockFetch.mock.calls[4]
    const body = JSON.parse(publishCall[1].body)
    expect(body.specificContent['com.linkedin.ugc.ShareContent'].shareMediaCategory).toBe('IMAGE')
    expect(body.specificContent['com.linkedin.ugc.ShareContent'].media).toHaveLength(1)
    expect(body.specificContent['com.linkedin.ugc.ShareContent'].media[0].media).toBe('urn:li:digitalmediaAsset:D123')
  })

  it('falls back to text-only when image upload fails', async () => {
    mockPost.findUnique.mockResolvedValue({
      id: 'post-3',
      statut: 'approved',
      contenu: 'Post with broken image',
      mediaUrl: 'https://broken.url/image.jpg',
      persona: { slug: 'flipio' },
    })
    mockOAuthToken.findUnique.mockResolvedValue({
      accessToken: encryptToken('access-token'),
      expiresAt: new Date(Date.now() + 86400000),
    })
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ sub: 'person-1' }) }) // userinfo
      .mockResolvedValueOnce({ ok: false, text: () => Promise.resolve('Register failed'), status: 400 }) // register fails
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'urn:li:ugcPost:789' }) }) // publish text-only

    const result = await publishToLinkedIn('post-3')
    expect(result).toBe('urn:li:ugcPost:789')

    // Verify it fell back to text-only
    const publishCall = mockFetch.mock.calls[2]
    const body = JSON.parse(publishCall[1].body)
    expect(body.specificContent['com.linkedin.ugc.ShareContent'].shareMediaCategory).toBe('NONE')
  })

  it('parses JSON error from LinkedIn API', async () => {
    mockPost.findUnique.mockResolvedValue({
      id: 'post-4',
      statut: 'approved',
      contenu: 'Will fail',
      mediaUrl: null,
      persona: { slug: 'flipio' },
    })
    mockOAuthToken.findUnique.mockResolvedValue({
      accessToken: encryptToken('access-token'),
      expiresAt: new Date(Date.now() + 86400000),
    })
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ sub: 'person-1' }) }) // userinfo
      .mockResolvedValueOnce({
        ok: false,
        status: 422,
        text: () => Promise.resolve(JSON.stringify({ message: 'Duplicate post detected' })),
      })

    await expect(publishToLinkedIn('post-4')).rejects.toThrow('Duplicate post detected')
  })

  it('throws when post not found', async () => {
    mockPost.findUnique.mockResolvedValue(null)
    await expect(publishToLinkedIn('missing')).rejects.toThrow('not found')
  })

  it('throws when post not approved', async () => {
    mockPost.findUnique.mockResolvedValue({
      id: 'post-1',
      statut: 'draft',
      contenu: 'Draft post',
      mediaUrl: null,
      persona: { slug: 'flipio' },
    })
    await expect(publishToLinkedIn('post-1')).rejects.toThrow('not approved')
  })

  afterAll(() => {
    process.env = ORIGINAL_ENV
  })
})
