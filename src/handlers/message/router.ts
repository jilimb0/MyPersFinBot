/**
 * Message Router - handles all incoming text messages
 */

import type { BotClient } from "@jilimb0/tgwrapper"
import { config } from "../../config"
import { dbStorage as db } from "../../database/storage-db"
import { type Language, resolveLanguage } from "../../i18n"
import logger from "../../logger"
import { securityCheck } from "../../security"
import type { WizardManager } from "../../wizards/wizards"
import type { MessageContext, MessageHandler, MessageRoute } from "./types"

/**
 * MessageRouter - centralized message routing
 */
export class MessageRouter {
  private routes: MessageRoute[] = []

  constructor(
    private bot: BotClient,
    private wizardManager: WizardManager
  ) {}

  /**
   * Register a message route
   */
  register(
    pattern: MessageRoute["pattern"],
    handler: MessageHandler,
    description?: string
  ): void {
    this.routes.push({ pattern, handler, description })
  }

  /**
   * Register multiple routes
   */
  registerRoutes(routes: MessageRoute[]): void {
    this.routes.push(...routes)
  }

  /**
   * Start listening to messages
   */
  listen(): void {
    this.bot.on("message", async (msg) => {
      try {
        // Security check
        if (!(await securityCheck(this.bot, msg))) {
          return
        }

        const chatId = msg.chat.id
        const userId = chatId.toString()
        const text = msg.text?.trim()

        if (typeof db.updateTelegramProfile === "function") {
          await db.updateTelegramProfile(userId, msg.from?.username ?? null)
        }

        if (!text) return
        await this.wizardManager.hydrateState(userId)

        // Get user language
        const storedLang = await db.getUserLanguage(userId)
        const lang = resolveLanguage(storedLang)

        // Create context
        const context: MessageContext = {
          bot: this.bot,
          msg,
          chatId,
          userId,
          text,
          lang,
          wizardManager: this.wizardManager,
          db,
        }

        // Try to match and handle
        const handled = await this.matchAndHandle(context)

        if (!handled) {
          logger.warn("Unhandled message", { userId, text, lang })
        }
      } catch (error) {
        logger.error("Message router error", error, {
          chatId: msg.chat.id.toString(),
          text: msg.text,
        })
      }
    })

    if (config.LOG_BOOT_DETAIL) {
      logger.info(`✅ MessageRouter listening (${this.routes.length} routes)`)
    }
  }

  /**
   * Match text against routes and handle
   */
  private async matchAndHandle(context: MessageContext): Promise<boolean> {
    for (const route of this.routes) {
      if (this.isMatch(route.pattern, context.text, context.lang)) {
        try {
          const result = await route.handler(context)
          // Handler returns false if it didn't actually handle the message
          if (result === false) {
            continue
          }
          return true
        } catch (error) {
          logger.error("Handler error", error, {
            pattern: route.description || String(route.pattern),
            text: context.text,
          })
          // Continue to next route on error
        }
      }
    }

    if (this.wizardManager.isInWizard(context.userId)) {
      return await this.wizardManager.handleWizardInput(
        context.chatId,
        context.userId,
        context.text
      )
    }

    return false
  }

  /**
   * Check if pattern matches text
   */
  private isMatch(
    pattern: MessageRoute["pattern"],
    text: string,
    lang: Language
  ): boolean {
    if (typeof pattern === "string") {
      return text === pattern
    }

    if (pattern instanceof RegExp) {
      return pattern.test(text)
    }

    if (typeof pattern === "function") {
      return pattern(text, lang)
    }

    return false
  }
}
