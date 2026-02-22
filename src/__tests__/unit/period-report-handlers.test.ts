import type { TgTypes as Tg } from "@jilimb0/tgwrapper"
import { dbStorage } from "../../database/storage-db"
import { registerPeriodReportHandlers } from "../../handlers/period-report-handlers"

jest.mock("../../database/storage-db", () => ({
  dbStorage: {
    getUserLanguage: jest.fn(),
    getTransactionsByDateRange: jest.fn(),
  },
}))

type MessageHandler = (msg: Tg.Message) => void | Promise<void>

class MockBot {
  messageHandlers: MessageHandler[] = []
  sendMessage = jest.fn().mockResolvedValue({})
  on = jest.fn((event: string, handler: MessageHandler) => {
    if (event === "message") {
      this.messageHandlers.push(handler)
    }
  })

  async emitText(text: string) {
    const msg = { chat: { id: 1 }, text } as Tg.Message
    for (const handler of this.messageHandlers) {
      await handler(msg)
    }
  }
}

describe("period-report-handlers", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers().setSystemTime(new Date("2026-02-08T00:00:00Z"))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  test("/report_period prompt and invalid inputs", async () => {
    const bot = new MockBot()
    registerPeriodReportHandlers(bot as unknown as any)

    ;(dbStorage.getUserLanguage as jest.Mock).mockResolvedValue("en")
    await bot.emitText("/report_period")

    // invalid dates
    await bot.emitText("2026-13-01 2026-01-01")

    // start after end
    await bot.emitText("2026-02-10 2026-02-01")

    expect(bot.sendMessage).toHaveBeenCalled()
  })

  test("/report_period valid with type", async () => {
    const bot = new MockBot()
    registerPeriodReportHandlers(bot as unknown as any)

    ;(dbStorage.getUserLanguage as jest.Mock).mockResolvedValue("en")
    ;(dbStorage.getTransactionsByDateRange as jest.Mock).mockResolvedValue([
      {
        amount: 10,
        currency: "USD",
        type: "EXPENSE",
        category: "FOOD_DINING",
      },
    ])

    await bot.emitText("2026-02-01 2026-02-05 EXPENSE")

    expect(bot.sendMessage).toHaveBeenCalled()
  })

  test("/report_quarter and /report_year", async () => {
    const bot = new MockBot()
    registerPeriodReportHandlers(bot as unknown as any)
    ;(dbStorage.getUserLanguage as jest.Mock).mockResolvedValue("en")
    ;(dbStorage.getTransactionsByDateRange as jest.Mock).mockResolvedValue([
      {
        amount: 10,
        currency: "USD",
        type: "EXPENSE",
        category: "FOOD_DINING",
        date: new Date().toISOString(),
      },
    ])

    await bot.emitText("/report_quarter")
    await bot.emitText("/report_year")

    expect(bot.sendMessage).toHaveBeenCalled()
  })
})
