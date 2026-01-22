/**
 * User Context Service
 * Manages user-specific data like language preferences
 */

import { Language } from '../i18n';
import { dbStorage as db } from '../database/storage-db';

class UserContextService {
  private contexts: Map<string, UserContext> = new Map();

  /**
   * Get user context (creates if doesn't exist)
   */
  async getContext(userId: string): Promise<UserContext> {
    if (!this.contexts.has(userId)) {
      const lang = await db.getUserLanguage(userId);
      this.contexts.set(userId, new UserContext(userId, lang));
    }
    return this.contexts.get(userId)!;
  }

  /**
   * Set user language and update database
   */
  async setLanguage(userId: string, lang: Language): Promise<void> {
    const context = await this.getContext(userId);
    context.lang = lang;
    await db.setUserLanguage(userId, lang);
  }

  /**
   * Get user language (convenience method)
   */
  async getLang(userId: string): Promise<Language> {
    const context = await this.getContext(userId);
    return context.lang;
  }

  /**
   * Clear context (for testing or cleanup)
   */
  clearContext(userId: string): void {
    this.contexts.delete(userId);
  }

  /**
   * Clear all contexts
   */
  clearAll(): void {
    this.contexts.clear();
  }
}

class UserContext {
  constructor(
    public userId: string,
    public lang: Language = 'en'
  ) {}
}

// Singleton instance
export const userContext = new UserContextService();
export { UserContext };
