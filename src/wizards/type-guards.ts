/**
 * Type guards and helpers for wizard state
 */

import { Language } from "../i18n"
import { WizardData, WizardState } from "./wizards"

/**
 * Check if state has data
 */
export function hasData(
  state: WizardState
): state is WizardState & { data: WizardData } {
  return state?.data !== undefined
}

/**
 * Check if state has lang
 */
export function hasLang(
  state: WizardState
): state is WizardState & { lang: Language } {
  return state?.lang !== undefined
}

/**
 * Get lang or default
 */
export function getLang(state: WizardState): Language {
  return state?.lang || "en"
}

/**
 * Check if data has specific field
 */
export function hasField<K extends keyof WizardData>(
  data: WizardData,
  field: K
): data is WizardData & Record<K, NonNullable<WizardData[K]>> {
  return data[field] !== undefined
}

/**
 * Safe regex match - returns groups or throws
 */
export function safeMatch(text: string, regex: RegExp): RegExpMatchArray {
  const match = text.match(regex)
  if (!match) {
    throw new Error(`Failed to match: ${text}`)
  }
  return match
}

/**
 * Get regex group or throw
 */
export function getGroup(match: RegExpMatchArray, index: number): string {
  const group = match[index]
  if (group === undefined) {
    throw new Error(`Group ${index} is undefined`)
  }
  return group
}

/**
 * Safe state access with defaults
 */
export function safeState<T extends keyof WizardState>(
  state: WizardState | undefined,
  key: T,
  defaultValue: NonNullable<WizardState[T]>
): NonNullable<WizardState[T]> {
  if (!state || state[key] === undefined) {
    return defaultValue
  }
  return state[key] as NonNullable<WizardState[T]>
}

/**
 * Safe data access
 */
export function safeData<T extends keyof WizardData>(
  state: WizardState | undefined,
  key: T
): WizardData[T] | undefined {
  return state?.data?.[key]
}
