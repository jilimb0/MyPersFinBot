describe("E2E admin API subscription pause/resume", () => {
  const port = 3117
  const host = "127.0.0.1"
  const token = "e2e-admin-token"
  const baseUrl = `http://${host}:${port}`

  let startHealthServer: () => unknown
  let stopHealthServer: () => void
  let initializeDatabase: () => Promise<unknown>
  let closeDatabase: () => Promise<void>
  let initializeCache: () => Promise<unknown>
  let closeCache: () => Promise<void>

  beforeAll(async () => {
    jest.resetModules()
    process.env.NODE_ENV = "test"
    process.env.USE_REDIS = "false"
    process.env.HEALTH_HOST = host
    process.env.HEALTH_PORT = String(port)
    process.env.ADMIN_API_TOKEN = token

    const cacheModule = await import("../../cache")
    initializeCache = cacheModule.initializeCache
    closeCache = cacheModule.closeCache

    const dbModule = await import("../../database/data-source")
    initializeDatabase = dbModule.initializeDatabase
    closeDatabase = dbModule.closeDatabase

    const healthModule = await import("../../health-server")
    startHealthServer = healthModule.startHealthServer
    stopHealthServer = healthModule.stopHealthServer

    await initializeCache()
    await initializeDatabase()
    startHealthServer()
    await new Promise((resolve) => setTimeout(resolve, 100))
  })

  afterAll(async () => {
    stopHealthServer()
    await closeDatabase()
    await closeCache()
  })

  async function post(path: string, body: Record<string, unknown>) {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-admin-token": token,
      },
      body: JSON.stringify(body),
    })
    const json = (await response.json()) as Record<string, unknown>
    return { response, json }
  }

  test("payment -> pause -> payment carries remaining time", async () => {
    const userId = `e2e-user-${Date.now()}`

    const first = await post("/admin/payment", {
      userId,
      provider: "e2e",
      reference: `e2e-${Date.now()}`,
      premiumDays: 30,
    })
    expect(first.response.ok).toBe(true)
    expect((first.json.status as { tier: string }).tier).toBe("premium")
    const firstExpiryRaw = (first.json.status as { premiumExpiresAt?: string })
      .premiumExpiresAt
    expect(firstExpiryRaw).toBeTruthy()

    const paused = await post("/admin/subscription/pause", { userId })
    expect(paused.response.ok).toBe(true)
    const pausedStatus = paused.json.status as {
      subscriptionPaused: boolean
      pausedRemainingMs: number
      tier: string
    }
    expect(pausedStatus.subscriptionPaused).toBe(true)
    expect(pausedStatus.pausedRemainingMs).toBeGreaterThan(0)
    expect(pausedStatus.tier).toBe("free")

    const second = await post("/admin/payment", {
      userId,
      provider: "e2e",
      reference: `e2e-resume-${Date.now()}`,
      premiumDays: 30,
    })
    expect(second.response.ok).toBe(true)
    const secondStatus = second.json.status as {
      tier: string
      subscriptionPaused: boolean
      pausedRemainingMs: number
      premiumExpiresAt?: string
    }
    expect(secondStatus.tier).toBe("premium")
    expect(secondStatus.subscriptionPaused).toBe(false)
    expect(secondStatus.pausedRemainingMs).toBe(0)
    expect(secondStatus.premiumExpiresAt).toBeTruthy()

    const expiresAtMs = new Date(secondStatus.premiumExpiresAt as string).getTime()
    const now = Date.now()
    const fiftyDaysMs = 50 * 24 * 60 * 60 * 1000
    expect(expiresAtMs - now).toBeGreaterThan(fiftyDaysMs)

    const monetization = await fetch(`${baseUrl}/admin/monetization?token=${token}`)
    expect(monetization.ok).toBe(true)
    const report = (await monetization.json()) as {
      users: Array<{
        userId: string
        subscriptionPaused: boolean
        pausedRemainingMs: number
      }>
    }
    const target = report.users.find((u) => u.userId === userId)
    expect(target).toBeTruthy()
    expect(target?.subscriptionPaused).toBe(false)
    expect(target?.pausedRemainingMs).toBe(0)
  }, 20000)
})
