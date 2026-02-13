import { startHealthServer } from "../health-server"
import { initSentry } from "../sentry"

export function initObservability() {
  initSentry()
  startHealthServer()
}
