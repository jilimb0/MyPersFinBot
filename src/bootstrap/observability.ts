import { isDevelopment } from "../config"
import { tgObservability } from "../observability/tgwrapper-observability"
import { initSentry } from "../sentry"

export async function initObservability() {
  initSentry()
  await tgObservability.init()
  if (isDevelopment()) {
    tgObservability.logInfo("observability.init")
  }
  tgObservability.increment("observability.init.count")
}
