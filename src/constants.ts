// ⚠️ DEPRECATED: Static keyboards removed
// Use dynamic keyboard generators from i18n/keyboards.ts instead

// Example migration:
// OLD: import { MAIN_MENU_KEYBOARD } from './constants'
// NEW: import { getMainMenuKeyboard } from './i18n/keyboards'
//      const keyboard = getMainMenuKeyboard(lang)

// Backwards compatibility exports (will be removed in future)
import { getMainMenuKeyboard, getSettingsKeyboard, getAnalyticsKeyboard, getStatsKeyboard, getBackAndMainKeyboard } from './i18n/keyboards'

// Default language for backwards compatibility
const DEFAULT_LANG = 'en'

export const MAIN_MENU_KEYBOARD = getMainMenuKeyboard(DEFAULT_LANG)
export const SETTINGS_KEYBOARD = {
  keyboard: getSettingsKeyboard(DEFAULT_LANG).keyboard,
  resize_keyboard: true,
}
export const STATS_KEYBOARD = {
  keyboard: getStatsKeyboard(DEFAULT_LANG).keyboard,
  resize_keyboard: true,
}
export const BACK_N_MAIN_KEYBOARD = {
  keyboard: getBackAndMainKeyboard(DEFAULT_LANG).keyboard,
  resize_keyboard: true,
}
export const ANALYTICS_KEYBOARD = {
  keyboard: getAnalyticsKeyboard(DEFAULT_LANG).keyboard,
  resize_keyboard: true,
}
