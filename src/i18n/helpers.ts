/**
 * i18n Helper Functions
 * Simplified translation functions with automatic language detection
 */

import { userContext } from "../services/user-context"
import { type Language, t } from "./index"

/**
 * Translate with automatic language detection from user context
 * Usage: await tUser(userId, 'mainMenu.welcome')
 */
export async function tUser(
  userId: string,
  key: string,
  params?: Record<string, string | number>
): Promise<string> {
  const lang = await userContext.getLang(userId)
  return t(lang, key, params)
}

/**
 * Get user language
 * Usage: const lang = await getUserLang(userId)
 */
export async function getUserLang(userId: string): Promise<Language> {
  return await userContext.getLang(userId)
}

/**
 * Set user language
 * Usage: await setUserLang(userId, 'ru')
 */
export async function setUserLang(
  userId: string,
  lang: Language
): Promise<void> {
  await userContext.setLanguage(userId, lang)
}

/**
 * Create a translator function bound to a specific user
 * Usage:
 * const translate = await createUserTranslator(userId);
 * const text = translate('mainMenu.welcome');
 */
export async function createUserTranslator(
  userId: string
): Promise<(key: string, params?: Record<string, string | number>) => string> {
  const lang = await userContext.getLang(userId)
  return (key: string, params?: Record<string, string | number>) =>
    t(lang, key, params)
}

/**
 * Batch translate multiple keys for a user
 * Usage: const texts = await tUserBatch(userId, ['key1', 'key2'])
 */
export async function tUserBatch(
  userId: string,
  keys: string[]
): Promise<string[]> {
  const lang = await userContext.getLang(userId)
  return keys.map((key) => t(lang, key))
}
