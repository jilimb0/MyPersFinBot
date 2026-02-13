/**
 * Keyboard constants for backward compatibility
 *
 * DEPRECATED: Use i18n/keyboards instead
 *
 * These constants provide backwards compatibility for code that imports
 * keyboards from './constants'. New code should import from 'i18n/keyboards'
 * and pass the language parameter.
 */

import {
  getAnalyticsKeyboard,
  getBackAndMainKeyboard,
  getMainMenuKeyboard,
  getSettingsKeyboard,
  getStatsKeyboard,
} from "../i18n/keyboards"

// Default language for backwards compatibility
const DEFAULT_LANG = "en"

/**
 * @deprecated Use getMainMenuKeyboard(lang) from 'i18n/keyboards' instead
 */
export const MAIN_MENU_KEYBOARD = getMainMenuKeyboard(DEFAULT_LANG)

/**
 * @deprecated Use getSettingsKeyboard(lang) from 'i18n/keyboards' instead
 */
export const SETTINGS_KEYBOARD = {
  keyboard: getSettingsKeyboard(DEFAULT_LANG).keyboard,
  resize_keyboard: true,
}

/**
 * @deprecated Use getStatsKeyboard(lang) from 'i18n/keyboards' instead
 */
export const STATS_KEYBOARD = {
  keyboard: getStatsKeyboard(DEFAULT_LANG).keyboard,
  resize_keyboard: true,
}

/**
 * @deprecated Use getBackAndMainKeyboard(lang) from 'i18n/keyboards' instead
 */
export const BACK_N_MAIN_KEYBOARD = {
  keyboard: getBackAndMainKeyboard(DEFAULT_LANG).keyboard,
  resize_keyboard: true,
}

/**
 * @deprecated Use getAnalyticsKeyboard(lang) from 'i18n/keyboards' instead
 */
export const ANALYTICS_KEYBOARD = {
  keyboard: getAnalyticsKeyboard(DEFAULT_LANG).keyboard,
  resize_keyboard: true,
}
