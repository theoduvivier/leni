import { vi } from 'vitest'

function mockModel() {
  return {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    upsert: vi.fn(),
  }
}

export function createMockDb() {
  return {
    persona: mockModel(),
    contextLive: mockModel(),
    skill: mockModel(),
    skillHistory: mockModel(),
    post: mockModel(),
    comment: mockModel(),
    media: mockModel(),
    oAuthToken: mockModel(),
    job: mockModel(),
    imagePreference: mockModel(),
  }
}

export type MockDb = ReturnType<typeof createMockDb>
