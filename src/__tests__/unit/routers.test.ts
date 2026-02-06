import TelegramBot from "node-telegram-bot-api"
import { registerRouters } from "../../bootstrap/routers"

jest.mock("../../handlers/message", () => ({
  createMessageRouter: jest.fn(() => ({ listen: jest.fn() })),
}))

jest.mock("../../handlers/callback-router", () => ({
  registerCallbackRouter: jest.fn(),
}))

import { createMessageRouter } from "../../handlers/message"
import { registerCallbackRouter } from "../../handlers/callback-router"

class MockBot {
  on = jest.fn()
}

describe("registerRouters", () => {
  test("registers message and callback routers", () => {
    const bot = new MockBot() as unknown as TelegramBot

    const wizard = registerRouters(bot)

    expect(createMessageRouter).toHaveBeenCalled()
    expect(registerCallbackRouter).toHaveBeenCalledWith(bot, wizard)

    const router = (createMessageRouter as jest.Mock).mock.results[0]?.value
    expect(router.listen).toHaveBeenCalled()
  })
})
