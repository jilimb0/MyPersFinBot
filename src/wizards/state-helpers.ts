/**
 * Safe state helpers
 */

import { Language } from "../i18n"
import { WizardState, WizardData } from "../wizards/wizards"

/**
 * Get lang with fallback
 */
export function getLang(state: WizardState | undefined): Language {
  return state?.lang || "en"
}

/**
 * Get data or throw
 */
export function getData(state: WizardState): WizardData {
  if (!state?.data) {
    throw new Error("STATE_DATA_UNDEFINED")
  }
  return state?.data
}

/**
 * Check if state has data
 */
export function hasData(
  state: WizardState
): state is WizardState & { data: WizardData } {
  return state?.data !== undefined
}

/**
 * Get history with fallback
 */
export function getHistory(state: WizardState): string[] {
  return state.history || []
}

/**
 * Get last history step
 */
export function getLastStep(state: WizardState): string | undefined {
  const history = getHistory(state)
  return history[history.length - 1]
}
