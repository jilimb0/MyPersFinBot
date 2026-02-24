import { DatabaseStorage } from "../../database/storage-db"

const mockCacheManager = {
  invalidateUserData: jest.fn(),
  invalidateUserSettings: jest.fn(),
  invalidateUserLanguage: jest.fn(),
  invalidateBalances: jest.fn(),
  invalidateTransactions: jest.fn(),
  invalidateAllUserCaches: jest.fn(),
}

jest.mock("../../services/cache-manager", () => ({
  getCacheManager: () => mockCacheManager,
}))

let currentUser: any

const mockUserRepo = {
  findOne: jest.fn(async () => currentUser),
  save: jest.fn(async (user) => {
    currentUser = { ...user }
    return currentUser
  }),
  create: jest.fn((payload) => payload),
}

jest.mock("../../database/data-source", () => ({
  AppDataSource: {
    getRepository: jest.fn(() => mockUserRepo),
  },
}))

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    defaultCurrency: "USD",
    language: "en",
    subscriptionTier: "free",
    premiumExpiresAt: null,
    trialStartedAt: null,
    trialExpiresAt: null,
    trialUsed: false,
    transactionsThisMonth: 0,
    transactionsMonthKey: null,
    voiceInputsToday: 0,
    voiceDayKey: null,
    lastPaymentAt: null,
    lastPaymentProvider: null,
    lastPaymentReference: null,
    subscriptionPaused: false,
    pausedRemainingMs: 0,
    pausedTier: null,
    ...overrides,
  }
}

describe("DatabaseStorage subscription pause/resume", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    currentUser = makeUser()
  })

  test("pauseSubscription stores remaining time and marks user as paused", async () => {
    const remainingMs = 10 * 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000
    currentUser = makeUser({
      subscriptionTier: "premium",
      premiumExpiresAt: new Date(Date.now() + remainingMs),
    })

    const db = new DatabaseStorage()
    const status = await db.pauseSubscription("user-1")

    expect(status.subscriptionPaused).toBe(true)
    expect(status.pausedRemainingMs).toBeGreaterThan(0)
    expect(status.tier).toBe("free")
    expect(currentUser.subscriptionTier).toBe("free")
    expect(currentUser.subscriptionPaused).toBe(true)
    expect(currentUser.pausedRemainingMs).toBeGreaterThan(0)
    expect(currentUser.pausedTier).toBe("premium")
  })

  test("recordPayment resumes premium and adds paused carryover time", async () => {
    const carryMs = 10 * 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000
    currentUser = makeUser({
      subscriptionTier: "free",
      subscriptionPaused: true,
      pausedRemainingMs: carryMs,
    })

    const db = new DatabaseStorage()
    const startedAt = Date.now()
    const status = await db.recordPayment("user-1", "manual", "ref-1", 30)
    const expectedMin = startedAt + 30 * 24 * 60 * 60 * 1000 + carryMs

    expect(status.tier).toBe("premium")
    expect(status.subscriptionPaused).toBe(false)
    expect(status.pausedRemainingMs).toBe(0)
    expect(status.premiumExpiresAt).not.toBeNull()
    expect((status.premiumExpiresAt as Date).getTime()).toBeGreaterThanOrEqual(
      expectedMin - 2000
    )
  })

  test("setSubscriptionTier free clears pause fields", async () => {
    currentUser = makeUser({
      subscriptionTier: "free",
      subscriptionPaused: true,
      pausedRemainingMs: 123456,
    })

    const db = new DatabaseStorage()
    const status = await db.setSubscriptionTier("user-1", "free")

    expect(status.subscriptionPaused).toBe(false)
    expect(status.pausedRemainingMs).toBe(0)
    expect(currentUser.subscriptionPaused).toBe(false)
    expect(currentUser.pausedRemainingMs).toBe(0)
  })

  test("resumePausedSubscription restores paused tier with remaining duration", async () => {
    const carryMs = 3 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000
    currentUser = makeUser({
      subscriptionTier: "free",
      subscriptionPaused: true,
      pausedRemainingMs: carryMs,
      pausedTier: "trial",
      trialUsed: true,
    })

    const db = new DatabaseStorage()
    const status = await db.resumePausedSubscription("user-1")

    expect(status.subscriptionPaused).toBe(false)
    expect(status.pausedRemainingMs).toBe(0)
    expect(status.tier).toBe("trial")
    expect(status.trialExpiresAt).not.toBeNull()
  })
})
