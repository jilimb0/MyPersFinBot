import { initSentry } from "../sentry"
import { startHealthServer } from "../health-server"

export function initObservability() {
  initSentry()
  startHealthServer()
}
