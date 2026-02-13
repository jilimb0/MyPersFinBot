import { DatabaseStorage } from "../../database/storage-db"

const mockCacheManager = {
  getUserLanguage: jest.fn(),
  setUserLanguage: jest.fn(),
  getUserSettings: jest.fn(),
  setUserSettings: jest.fn(),
  updateUserSettings: jest.fn(),
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

const mockUserRepo = {
  findOne: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
}

jest.mock("../../database/data-source", () => ({
  AppDataSource: {
    getRepository: jest.fn(() => mockUserRepo),
  },
}))

describe("DatabaseStorage cache integration", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test("getUserLanguage returns cached value", async () => {
    mockCacheManager.getUserLanguage.mockResolvedValue("uk")
    const db = new DatabaseStorage()

    const lang = await db.getUserLanguage("user-1")

    expect(lang).toBe("uk")
    expect(mockUserRepo.findOne).not.toHaveBeenCalled()
  })

  test("getDefaultCurrency returns cached settings", async () => {
    mockCacheManager.getUserSettings.mockResolvedValue({
      defaultCurrency: "EUR",
    })
    const db = new DatabaseStorage()

    const currency = await db.getDefaultCurrency("user-2")

    expect(currency).toBe("EUR")
    expect(mockUserRepo.findOne).not.toHaveBeenCalled()
  })

  test("setUserLanguage updates cache", async () => {
    mockUserRepo.findOne.mockResolvedValue({
      id: "user-3",
      defaultCurrency: "USD",
      reminderSettings: {
        enabled: true,
        time: "09:00",
        timezone: "UTC",
        channels: { telegram: true },
        notifyBefore: { debts: 1, goals: 3, income: 0 },
      },
    })

    const db = new DatabaseStorage()
    await db.setUserLanguage("user-3", "es")

    expect(mockCacheManager.setUserLanguage).toHaveBeenCalledWith(
      "user-3",
      "es"
    )
    expect(mockCacheManager.updateUserSettings).toHaveBeenCalledWith("user-3", {
      language: "es",
    })
  })

  test("setDefaultCurrency updates cache", async () => {
    mockUserRepo.findOne.mockResolvedValue({
      id: "user-4",
      defaultCurrency: "USD",
      reminderSettings: {
        enabled: true,
        time: "09:00",
        timezone: "UTC",
        channels: { telegram: true },
        notifyBefore: { debts: 1, goals: 3, income: 0 },
      },
    })

    const db = new DatabaseStorage()
    await db.setDefaultCurrency("user-4", "PLN")

    expect(mockCacheManager.updateUserSettings).toHaveBeenCalledWith("user-4", {
      defaultCurrency: "PLN",
    })
  })

  test("clearCache user invalidates settings and language", async () => {
    const db = new DatabaseStorage()
    await db.clearCache("user-5", "user")

    expect(mockCacheManager.invalidateUserData).toHaveBeenCalledWith("user-5")
    expect(mockCacheManager.invalidateUserSettings).toHaveBeenCalledWith(
      "user-5"
    )
    expect(mockCacheManager.invalidateUserLanguage).toHaveBeenCalledWith(
      "user-5"
    )
  })
})
