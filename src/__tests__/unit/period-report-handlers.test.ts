import type TelegramBot from "@telegram-api"
import { dbStorage } from "../../database/storage-db"
import { registerPeriodReportHandlers } from "../../handlers/period-report-handlers"

jest.mock("../../database/storage-db", () => ({
  dbStorage: {
    getUserLanguage: jest.fn(),
    getTransactionsByDateRange: jest.fn(),
  },
}))

type TextHandler = (
  msg: TelegramBot.Message,
  match?: RegExpExecArray | null
) => void

class MockBot {
  onTextHandlers: Array<{ re: RegExp; handler: TextHandler }> = []
  sendMessage = jest.fn().mockResolvedValue({})
  onText = jest.fn((re: RegExp, handler: TextHandler) => {
    this.onTextHandlers.push({ re, handler })
  })
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
    const bot = new MockBot() as unknown as TelegramBot
    registerPeriodReportHandlers(bot)

    const promptHandler = (bot as any).onTextHandlers.find((h: any) =>
      h.re.source.includes("/report_period")
    )

    ;(dbStorage.getUserLanguage as jest.Mock).mockResolvedValue("en")
    await promptHandler.handler({ chat: { id: 1 } })

    const periodHandler = (bot as any).onTextHandlers.find((h: any) =>
      h.re.source.includes("\\d{4}-\\d{2}-\\d{2}")
    )

    // invalid dates
    await periodHandler.handler({ chat: { id: 1 } }, [
      "",
      "2026-13-01",
      "2026-01-01",
    ])

    // start after end
    await periodHandler.handler({ chat: { id: 1 } }, [
      "",
      "2026-02-10",
      "2026-02-01",
    ])

    expect((bot as any).sendMessage).toHaveBeenCalled()
  })

  test("/report_period valid with type", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    registerPeriodReportHandlers(bot)

    const periodHandler = (bot as any).onTextHandlers.find((h: any) =>
      h.re.source.includes("\\d{4}-\\d{2}-\\d{2}")
    )

    ;(dbStorage.getUserLanguage as jest.Mock).mockResolvedValue("en")
    ;(dbStorage.getTransactionsByDateRange as jest.Mock).mockResolvedValue([
      {
        amount: 10,
        currency: "USD",
        type: "EXPENSE",
        category: "FOOD_DINING",
      },
    ])

    await periodHandler.handler({ chat: { id: 1 } }, [
      "",
      "2026-02-01",
      "2026-02-05",
      " EXPENSE",
      "EXPENSE",
    ])

    expect((bot as any).sendMessage).toHaveBeenCalled()
  })

  test("/report_quarter and /report_year", async () => {
    const bot = new MockBot() as unknown as TelegramBot
    registerPeriodReportHandlers(bot)
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

    const quarterHandler = (bot as any).onTextHandlers.find((h: any) =>
      h.re.source.includes("/report_quarter")
    )

    const yearHandler = (bot as any).onTextHandlers.find((h: any) =>
      h.re.source.includes("/report_year")
    )

    await quarterHandler.handler({ chat: { id: 1 } })
    await yearHandler.handler({ chat: { id: 1 } })

    expect((bot as any).sendMessage).toHaveBeenCalled()
  })
})
