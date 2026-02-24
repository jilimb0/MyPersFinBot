import { initObservability } from "../../bootstrap/observability"

jest.mock("../../sentry", () => ({
  initSentry: jest.fn(),
}))

jest.mock("../../observability/tgwrapper-observability", () => ({
  tgObservability: {
    init: jest.fn().mockResolvedValue(undefined),
    logInfo: jest.fn(),
    increment: jest.fn(),
  },
}))

import { tgObservability } from "../../observability/tgwrapper-observability"
import { initSentry } from "../../sentry"

describe("initObservability", () => {
  test("initializes sentry and health server", async () => {
    await initObservability()

    expect(initSentry).toHaveBeenCalled()
    expect(tgObservability.init).toHaveBeenCalled()
  })
})
