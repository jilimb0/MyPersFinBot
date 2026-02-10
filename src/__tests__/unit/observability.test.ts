import { initObservability } from "../../bootstrap/observability"

jest.mock("../../sentry", () => ({
  initSentry: jest.fn(),
}))

jest.mock("../../health-server", () => ({
  startHealthServer: jest.fn(),
}))

import { startHealthServer } from "../../health-server"
import { initSentry } from "../../sentry"

describe("initObservability", () => {
  test("initializes sentry and health server", () => {
    initObservability()

    expect(initSentry).toHaveBeenCalled()
    expect(startHealthServer).toHaveBeenCalled()
  })
})
