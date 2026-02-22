import type { BotClient } from "@jilimb0/tgwrapper"
import {
  handleStatementPreviewAction,
  handleStatementUpload,
} from "../../handlers/upload-statement-handlers"
import { t } from "../../i18n"

jest.mock("../../parsers", () => ({
  BankParserFactory: {
    parseAuto: jest.fn(),
  },
}))

jest.mock("../../database/storage-db", () => ({
  dbStorage: {
    getDefaultCurrency: jest.fn(),
    getBalancesList: jest.fn(),
    validateTransactionsBatch: jest.fn(),
    addTransactionsBatch: jest.fn(),
  },
}))

const { BankParserFactory } = jest.requireMock("../../parsers")
const { dbStorage } = jest.requireMock("../../database/storage-db")

class MockWizard {
  private state: any
  constructor(state?: any) {
    this.state = state || null
  }
  getState() {
    return this.state
  }
  setState(_: string, next: any) {
    this.state = next
  }
  clearState() {
    this.state = null
  }
  async sendMessage() {}
}

class MockBot {
  sendMessage = jest.fn().mockResolvedValue({})
  getFileLink = jest.fn().mockResolvedValue("http://file")
}

describe("upload-statement-handlers", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    dbStorage.getDefaultCurrency.mockResolvedValue("USD")
    ;(global as any).fetch = jest.fn().mockResolvedValue({
      text: async () => "content",
    })
  })

  describe("handleStatementUpload", () => {
    test("rejects when no document", async () => {
      const bot = new MockBot() as unknown as BotClient
      const wizard = new MockWizard({ lang: "en" })
      await handleStatementUpload(
        bot,
        { chat: { id: 1 } } as any,
        "u1",
        wizard as any
      )
      expect(bot.sendMessage).toHaveBeenCalledWith(
        1,
        t("en", "import.invalidFile")
      )
    })

    test("rejects unsupported format", async () => {
      const bot = new MockBot() as unknown as BotClient
      const wizard = new MockWizard({ lang: "en" })
      const msg = {
        chat: { id: 1 },
        document: { file_name: "report.pdf", file_id: "1" },
      } as any
      await handleStatementUpload(bot, msg, "u1", wizard as any)
      expect(bot.sendMessage).toHaveBeenCalledWith(
        1,
        t("en", "import.unsupportedFormat"),
        expect.anything()
      )
    })

    test("handles parsing errors and no transactions", async () => {
      BankParserFactory.parseAuto.mockResolvedValue({
        errors: ["bad line"],
        transactions: [],
        bankType: "TestBank",
      })
      const bot = new MockBot() as unknown as BotClient
      const wizard = new MockWizard({ lang: "en" })
      const msg = {
        chat: { id: 1 },
        document: { file_name: "report.csv", file_id: "1" },
      } as any
      await handleStatementUpload(bot, msg, "u1", wizard as any)
      expect(bot.sendMessage).toHaveBeenCalledWith(
        1,
        expect.stringContaining(t("en", "import.parsingErrors")),
        expect.anything()
      )
      expect(bot.sendMessage).toHaveBeenCalledWith(
        1,
        t("en", "import.noTransactions")
      )
    })

    test("shows preview when transactions exist", async () => {
      BankParserFactory.parseAuto.mockResolvedValue({
        errors: [],
        transactions: [
          {
            type: "EXPENSE",
            amount: 10,
            currency: "USD",
            date: "2026-01-01",
            description: "Coffee",
            category: "FOOD_DINING",
          },
        ],
        bankType: "TestBank",
      })
      const bot = new MockBot() as unknown as BotClient
      const wizard = new MockWizard({ lang: "en" })
      const msg = {
        chat: { id: 1 },
        document: { file_name: "report.csv", file_id: "1" },
      } as any
      await handleStatementUpload(bot, msg, "u1", wizard as any)
      expect(bot.sendMessage).toHaveBeenCalled()
    })
  })

  describe("handleStatementPreviewAction", () => {
    test("importAll no accounts", async () => {
      dbStorage.getBalancesList.mockResolvedValue([])
      const wizard = new MockWizard({
        step: "STATEMENT_PREVIEW",
        data: { transactions: [], lang: "en" },
      })
      const sendSpy = jest.spyOn(wizard, "sendMessage")
      await handleStatementPreviewAction(
        wizard as any,
        1,
        "u1",
        t("en", "common.importAll")
      )
      expect(sendSpy).toHaveBeenCalledWith(
        1,
        t("en", "import.noAccounts"),
        expect.anything()
      )
    })

    test("edit and import path", async () => {
      const wizard = new MockWizard({
        step: "STATEMENT_PREVIEW",
        data: {
          transactions: [
            {
              type: "EXPENSE",
              amount: 10,
              currency: "USD",
              date: "2026-01-01",
              description: "Coffee",
            },
          ],
          lang: "en",
        },
      })
      const result = await handleStatementPreviewAction(
        wizard as any,
        1,
        "u1",
        t("en", "common.editAndImport")
      )
      expect(result).toBe(true)
      expect(wizard.getState().step).toBe("STATEMENT_EDIT")
    })

    test("review list path", async () => {
      const wizard = new MockWizard({
        step: "STATEMENT_PREVIEW",
        data: {
          transactions: [
            {
              type: "EXPENSE",
              amount: 10,
              currency: "USD",
              date: "2026-01-01",
              description: "Coffee",
            },
          ],
          lang: "en",
        },
      })
      const result = await handleStatementPreviewAction(
        wizard as any,
        1,
        "u1",
        t("en", "import.review")
      )
      expect(result).toBe(true)
    })

    test("cancel clears state", async () => {
      const wizard = new MockWizard({
        step: "STATEMENT_PREVIEW",
        data: { transactions: [], lang: "en" },
      })
      await handleStatementPreviewAction(
        wizard as any,
        1,
        "u1",
        t("en", "common.cancel")
      )
      expect(wizard.getState()).toBe(null)
    })
  })
})
