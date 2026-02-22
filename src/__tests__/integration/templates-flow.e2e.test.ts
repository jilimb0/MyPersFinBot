import type { BotClient } from "@jilimb0/tgwrapper"
import { registerCallbackRouter } from "../../handlers/callback-router"
import { TransactionType } from "../../types"
import { WizardManager } from "../../wizards/wizards"
import { MockRouterBot } from "../helpers/mock-bot"

jest.mock("../../database/storage-db", () => ({
  dbStorage: {
    getTemplates: jest.fn(),
    deleteTemplate: jest.fn(),
  },
}))

import { dbStorage } from "../../database/storage-db"

const mockGetTemplates = dbStorage.getTemplates as jest.MockedFunction<
  typeof dbStorage.getTemplates
>
const mockDeleteTemplate = dbStorage.deleteTemplate as jest.MockedFunction<
  typeof dbStorage.deleteTemplate
>

describe("E2E templates flow", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetTemplates.mockResolvedValue([
      {
        id: "tmpl-1",
        name: "☕ Coffee",
        amount: 5,
        currency: "USD",
        category: "COFFEE",
        type: TransactionType.EXPENSE,
      },
    ])
    mockDeleteTemplate.mockResolvedValue(true)
  })

  test("tmpl_del removes template and refreshes list", async () => {
    const bot = new MockRouterBot() as unknown as BotClient
    const wizard = new WizardManager(bot)
    registerCallbackRouter(bot, wizard)

    await (bot as any).handlers.callback_query({
      id: "cb-1",
      data: "tmpl_del|tmpl-1",
      message: { chat: { id: 701 } },
    })

    expect(mockDeleteTemplate).toHaveBeenCalledWith("701", "tmpl-1")
    expect(bot.sendMessage).toHaveBeenCalled()
  })

  test("tmpl_cancel clears wizard state and shows manage menu", async () => {
    const bot = new MockRouterBot() as unknown as BotClient
    const wizard = new WizardManager(bot)
    registerCallbackRouter(bot, wizard)

    wizard.setState("702", {
      step: "TEMPLATE_EDIT_AMOUNT",
      data: { templateId: "tmpl-1" },
      returnTo: "templates",
      lang: "en",
    })

    await (bot as any).handlers.callback_query({
      id: "cb-2",
      data: "tmpl_cancel|tmpl-1",
      message: { chat: { id: 702 } },
    })

    expect(wizard.getState("702")).toBeUndefined()
    expect(bot.sendMessage).toHaveBeenCalled()
  })
})
