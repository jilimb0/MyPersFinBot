/**
 * Bot initialization module
 */

import { performance } from "node:perf_hooks"
import type { BotClient, TgTypes as Tg } from "@jilimb0/tgwrapper"
import { config, isDevelopment } from "../config"
import logger from "../logger"
import { tgObservability } from "../observability/tgwrapper-observability"

type JsonObject = Record<string, unknown>
type MessageHandler = (msg: Tg.Message) => void | Promise<void>
type CallbackHandler = (query: Tg.CallbackQuery) => void | Promise<void>
type PreCheckoutHandler = (
  query: Tg.PreCheckoutQuery
) => void | Promise<void>
type PollingErrorHandler = (error: unknown) => void | Promise<void>

type ApiClientLike = {
  callApiUnsafe(method: string, payload: JsonObject): Promise<unknown>
  sendDocument(
    chatId: number | string,
    document: Blob | Uint8Array | ArrayBuffer,
    extra?: JsonObject
  ): Promise<unknown>
  getFileLink(fileId: string): Promise<string>
  editMessageText(payload: JsonObject): Promise<unknown>
  editMessageReplyMarkup(payload: JsonObject): Promise<unknown>
}

type BotRuntimeLike = {
  start(): Promise<void>
  shutdown(): Promise<void>
}

type RuntimeDeps = {
  ApiClient: new (options: { token: string }) => ApiClientLike
  BotRuntime: new (
    source: unknown,
    options: { handleUpdate: (update: unknown) => Promise<void> }
  ) => BotRuntimeLike
  PollingSource: new (
    apiClient: unknown,
    options: { timeoutSeconds: number; limit: number }
  ) => unknown
}

const dynamicImport: (specifier: string) => Promise<unknown> = new Function(
  "s",
  "return import(s)"
) as (specifier: string) => Promise<unknown>

let runtimeDepsPromise: Promise<RuntimeDeps> | undefined

async function loadRuntimeDeps(): Promise<RuntimeDeps> {
  if (runtimeDepsPromise) return await runtimeDepsPromise

  runtimeDepsPromise = (async () => {
    try {
      return (await dynamicImport("@jilimb0/tgwrapper")) as RuntimeDeps
    } catch {
      return (await dynamicImport(
        "@jilimb0/tgwrapper/dist/index.js"
      )) as RuntimeDeps
    }
  })()

  return await runtimeDepsPromise
}

type TelegramUpdateLike = {
  message?: unknown
  callback_query?: unknown
  pre_checkout_query?: unknown
}

class TgWrapperBot {
  private readonly token: string
  private apiClient?: ApiClientLike
  private runtime?: BotRuntimeLike
  private runtimeTask?: Promise<void>
  private keepAliveTimer?: NodeJS.Timeout
  private launched = false
  private readonly startupGraceMs = 250
  private messageHandlers: MessageHandler[] = []
  private callbackHandlers: CallbackHandler[] = []
  private preCheckoutHandlers: PreCheckoutHandler[] = []
  private pollingErrorHandlers: PollingErrorHandler[] = []

  constructor(token: string) {
    this.token = token
  }

  async launch(): Promise<void> {
    if (this.launched) return

    const { ApiClient, BotRuntime, PollingSource } = await loadRuntimeDeps()

    this.apiClient = new ApiClient({ token: this.token })
    tgObservability.increment("bot.runtime.launch.attempt")

    const source = new PollingSource(this.apiClient, {
      timeoutSeconds: 30,
      limit: 100,
    })

    this.runtime = new BotRuntime(source, {
      handleUpdate: async (update: unknown) => {
        await this.handleUpdate(update)
      },
    })

    const runtimeTask = this.runtime.start()
    this.runtimeTask = runtimeTask
    void runtimeTask
      .then(() => {
        tgObservability.logError("bot.runtime.stopped.unexpected")
        tgObservability.increment("bot.runtime.stopped")
        const stopped = new Error("Telegram runtime stopped unexpectedly")
        tgObservability.onRuntimeError(stopped)
        // Fail-fast to avoid silent successful process exit when runtime dies.
        console.error("❌ Telegram runtime stopped unexpectedly")
        process.exitCode = 1
        setImmediate(() => process.exit(1))
        for (const handler of this.pollingErrorHandlers) {
          void handler(stopped)
        }
      })
      .catch((error) => {
        tgObservability.onRuntimeError(error)
        tgObservability.logError("bot.runtime.error", {
          message:
            error instanceof Error ? error.message : "unknown runtime error",
        })
        tgObservability.increment("bot.runtime.error")
        console.error("❌ Telegram runtime error:", error)
        process.exitCode = 1
        setImmediate(() => process.exit(1))
        for (const handler of this.pollingErrorHandlers) {
          void handler(error)
        }
      })

    this.launched = true
    // Keep process alive even if runtime implementation does not hold active handles.
    if (!this.keepAliveTimer) {
      this.keepAliveTimer = setInterval(() => {}, 60_000)
    }

    await Promise.race([
      runtimeTask.then(() => {
        throw new Error("Telegram runtime stopped during startup")
      }),
      new Promise<void>((resolve) => {
        setTimeout(resolve, this.startupGraceMs)
      }),
    ])
    if (isDevelopment()) {
      tgObservability.logInfo("bot.runtime.launch.success")
    }
    tgObservability.increment("bot.runtime.launch.success")
  }

  async stopPolling(): Promise<void> {
    if (!this.launched || !this.runtime) return
    await this.runtime.shutdown()
    if (this.runtimeTask) {
      await this.runtimeTask.catch((error) => {
        tgObservability.onRuntimeError(error)
      })
    }
    this.launched = false
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer)
      this.keepAliveTimer = undefined
    }
    tgObservability.logInfo("bot.runtime.shutdown")
    tgObservability.increment("bot.runtime.shutdown")
  }

  on(
    event:
      | "message"
      | "callback_query"
      | "pre_checkout_query"
      | "polling_error",
    listener:
      | MessageHandler
      | CallbackHandler
      | PreCheckoutHandler
      | PollingErrorHandler
  ): this {
    if (event === "message") {
      this.messageHandlers.push(listener as MessageHandler)
    } else if (event === "callback_query") {
      this.callbackHandlers.push(listener as CallbackHandler)
    } else if (event === "pre_checkout_query") {
      this.preCheckoutHandlers.push(listener as PreCheckoutHandler)
    } else {
      this.pollingErrorHandlers.push(listener as PollingErrorHandler)
    }
    return this
  }

  async sendMessage(
    chatId: number | string,
    text: string,
    options?: Tg.SendMessageOptions
  ): Promise<Tg.Message> {
    return await tgObservability.instrumentTelegramCall(
      "sendMessage",
      async () => {
        const payload: JsonObject = { chat_id: chatId, text }
        if (options) {
          Object.assign(payload, options as unknown as JsonObject)
        }
        return (await this.getApiClient().callApiUnsafe(
          "sendMessage",
          payload
        )) as Tg.Message
      }
    )
  }

  async sendDocument(
    chatId: number | string,
    document: unknown,
    options?: Tg.SendDocumentOptions,
    _fileOptions?: { filename?: string; contentType?: string }
  ): Promise<unknown> {
    return await tgObservability.instrumentTelegramCall(
      "sendDocument",
      async () => {
        const apiClient = this.getApiClient()
        if (document instanceof Blob || document instanceof Uint8Array) {
          return await apiClient.sendDocument(
            chatId,
            document,
            (options as unknown as JsonObject) || {}
          )
        }
        if (Buffer.isBuffer(document)) {
          return await apiClient.sendDocument(
            chatId,
            new Uint8Array(document),
            (options as unknown as JsonObject) || {}
          )
        }
        if (document instanceof ArrayBuffer) {
          return await apiClient.sendDocument(
            chatId,
            document,
            (options as unknown as JsonObject) || {}
          )
        }
        if (typeof document === "string") {
          return await apiClient.callApiUnsafe("sendDocument", {
            chat_id: chatId,
            document,
            ...((options as unknown as JsonObject) || {}),
          })
        }
        throw new Error("Unsupported document type for sendDocument")
      }
    )
  }

  async answerCallbackQuery(
    callbackQueryId: string,
    options?: Tg.AnswerCallbackQueryOptions
  ): Promise<boolean> {
    await tgObservability.instrumentTelegramCall(
      "answerCallbackQuery",
      async () => {
        const payload: JsonObject = { callback_query_id: callbackQueryId }
        if (options) {
          Object.assign(payload, options as unknown as JsonObject)
        }
        await this.getApiClient().callApiUnsafe("answerCallbackQuery", payload)
      }
    )
    return true
  }

  async sendInvoice(
    chatId: number | string,
    options: Tg.SendInvoiceOptions
  ): Promise<Tg.Message> {
    return await tgObservability.instrumentTelegramCall(
      "sendInvoice",
      async () =>
        (await this.getApiClient().callApiUnsafe("sendInvoice", {
          chat_id: chatId,
          ...((options as unknown as JsonObject) || {}),
        })) as Tg.Message
    )
  }

  async answerPreCheckoutQuery(
    options: Tg.AnswerPreCheckoutQueryOptions
  ): Promise<boolean> {
    await tgObservability.instrumentTelegramCall(
      "answerPreCheckoutQuery",
      async () => {
        await this.getApiClient().callApiUnsafe(
          "answerPreCheckoutQuery",
          options as unknown as JsonObject
        )
      }
    )
    return true
  }

  async editMessageText(
    text: string,
    options: Tg.EditMessageTextOptions
  ): Promise<Tg.Message | boolean> {
    return await tgObservability.instrumentTelegramCall(
      "editMessageText",
      async () =>
        (await this.getApiClient().editMessageText({
          ...((options as unknown as JsonObject) || {}),
          text,
        })) as Tg.Message | boolean
    )
  }

  async editMessageReplyMarkup(
    replyMarkup: Tg.InlineKeyboardMarkup,
    options: Tg.EditMessageReplyMarkupOptions
  ): Promise<Tg.Message | boolean> {
    return await tgObservability.instrumentTelegramCall(
      "editMessageReplyMarkup",
      async () =>
        (await this.getApiClient().editMessageReplyMarkup({
          ...((options as unknown as JsonObject) || {}),
          reply_markup: replyMarkup,
        })) as Tg.Message | boolean
    )
  }

  async getFileLink(fileId: string): Promise<string> {
    return await tgObservability.instrumentTelegramCall(
      "getFileLink",
      async () => await this.getApiClient().getFileLink(fileId)
    )
  }

  private getApiClient(): ApiClientLike {
    if (!this.apiClient) {
      throw new Error("Bot has not been launched yet")
    }
    return this.apiClient
  }

  private async handleUpdate(update: unknown): Promise<void> {
    const started = performance.now()
    const candidate = update as TelegramUpdateLike
    if (candidate.message) {
      const msg = candidate.message as Tg.Message
      await this.dispatchMessage(msg)
      tgObservability.onBotUpdate("message")
      tgObservability.increment("bot.update.message")
      tgObservability.observe(
        "bot.update.handle.ms",
        performance.now() - started,
        { type: "message" }
      )
      return
    }
    if (candidate.callback_query) {
      const query = candidate.callback_query as Tg.CallbackQuery
      await this.dispatchCallback(query)
      tgObservability.onBotUpdate("callback_query")
      tgObservability.increment("bot.update.callback_query")
      tgObservability.observe(
        "bot.update.handle.ms",
        performance.now() - started,
        { type: "callback_query" }
      )
      return
    }
    if (candidate.pre_checkout_query) {
      const query = candidate.pre_checkout_query as Tg.PreCheckoutQuery
      await this.dispatchPreCheckout(query)
      tgObservability.onBotUpdate("pre_checkout_query")
      tgObservability.increment("bot.update.pre_checkout_query")
      tgObservability.observe(
        "bot.update.handle.ms",
        performance.now() - started,
        { type: "pre_checkout_query" }
      )
      return
    }
  }

  private async dispatchMessage(msg: Tg.Message): Promise<void> {
    for (const handler of this.messageHandlers) {
      await handler(msg)
    }
  }

  private async dispatchCallback(query: Tg.CallbackQuery): Promise<void> {
    for (const handler of this.callbackHandlers) {
      await handler(query)
    }
  }

  private async dispatchPreCheckout(query: Tg.PreCheckoutQuery): Promise<void> {
    for (const handler of this.preCheckoutHandlers) {
      await handler(query)
    }
  }
}

export interface BotContext {
  bot: BotClient
}

/**
 * Create bot instance (minimal - just the bot itself)
 * Everything else (scheduler, commands, handlers, wizards) loaded later
 */
export async function createBot(token: string): Promise<BotContext> {
  const bot = new TgWrapperBot(token)
  await bot.launch()
  if (config.LOG_BOOT_DETAIL) {
    logger.info("✅ Bot instance created")
  }

  return { bot: bot as unknown as BotClient }
}

/**
 * Stop bot and cleanup
 */
export async function stopBot(context: BotContext): Promise<void> {
  const { bot } = context

  if (config.LOG_BOOT_DETAIL) {
    logger.info("⏳ Stopping bot...")
  }
  await bot.stopPolling()
  if (config.LOG_BOOT_DETAIL) {
    logger.info("✅ Bot stopped")
  }
}
