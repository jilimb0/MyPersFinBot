import type TelegramBot from "node-telegram-bot-api"

type JsonObject = Record<string, unknown>
type MessageHandler = (msg: TelegramBot.Message) => void | Promise<void>
type CallbackHandler =
  | ((query: TelegramBot.CallbackQuery) => void | Promise<void>)
  | undefined
type TextEventHandler = (
  msg: TelegramBot.Message,
  metadata: unknown
) => void | Promise<void>
type PollingErrorHandler = (error: unknown) => void | Promise<void>
type BotRuntime = {
  start(): Promise<void>
  shutdown(): Promise<void>
}
type TelegramUpdateLike = {
  message?: unknown
  callback_query?: unknown
}

interface TextListener {
  regexp: RegExp
  callback: (
    msg: TelegramBot.Message,
    match: RegExpExecArray | null
  ) => unknown | Promise<unknown>
}

export class TelegramBotTGWrapperAdapter {
  private readonly token: string
  private apiClient?: {
    callApiUnsafe(method: string, payload: JsonObject): Promise<unknown>
  }
  private runtime?: BotRuntime
  private runtimeTask?: Promise<void>
  private messageHandlers: MessageHandler[] = []
  private callbackHandlers: Array<NonNullable<CallbackHandler>> = []
  private textEventHandlers: TextEventHandler[] = []
  private pollingErrorHandlers: PollingErrorHandler[] = []
  private textListeners: TextListener[] = []
  private launched = false
  private readonly startupGraceMs = 250
  private keepAliveTimer?: NodeJS.Timeout

  private static runtimeDeps?: Promise<{
    ApiClient: new (options: {
      token: string
    }) => {
      callApiUnsafe(method: string, payload: JsonObject): Promise<unknown>
    }
    BotRuntime: new (
      source: unknown,
      options: { handleUpdate: (update: unknown) => Promise<void> }
    ) => {
      start(): Promise<void>
      shutdown(): Promise<void>
    }
    PollingSource: new (
      apiClient: unknown,
      options: { timeoutSeconds: number; limit: number }
    ) => unknown
  }>

  private static loadRuntimeDeps() {
    if (!TelegramBotTGWrapperAdapter.runtimeDeps) {
      const importFn = new Function("s", "return import(s)") as (
        s: string
      ) => Promise<unknown>
      TelegramBotTGWrapperAdapter.runtimeDeps = importFn(
        "@jilimb0/tgwrapper"
      ) as Promise<{
        ApiClient: new (options: {
          token: string
        }) => {
          callApiUnsafe(method: string, payload: JsonObject): Promise<unknown>
        }
        BotRuntime: new (
          source: unknown,
          options: { handleUpdate: (update: unknown) => Promise<void> }
        ) => {
          start(): Promise<void>
          shutdown(): Promise<void>
        }
        PollingSource: new (
          apiClient: unknown,
          options: { timeoutSeconds: number; limit: number }
        ) => unknown
      }>
    }
    return TelegramBotTGWrapperAdapter.runtimeDeps
  }

  constructor(token: string, _options?: { polling?: boolean }) {
    this.token = token
  }

  async launch(): Promise<void> {
    if (this.launched) return

    const { ApiClient, BotRuntime, PollingSource } =
      await TelegramBotTGWrapperAdapter.loadRuntimeDeps()

    if (!this.apiClient) {
      this.apiClient = new ApiClient({ token: this.token })
    }

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

    // Always surface runtime failures; do not silently swallow polling errors.
    void runtimeTask
      .then(() => {
        const stopped = new Error("Telegram runtime stopped unexpectedly")
        for (const handler of this.pollingErrorHandlers) {
          void handler(stopped)
        }
      })
      .catch((error) => {
        for (const handler of this.pollingErrorHandlers) {
          void handler(error)
        }
      })

    this.launched = true
    this.keepAliveTimer = setInterval(() => {
      // Keep process alive while bot runtime is active.
    }, 60_000)

    // Fail fast on immediate startup/polling errors (e.g. invalid token/network).
    await Promise.race([
      runtimeTask.then(() => {
        throw new Error("Telegram runtime stopped during startup")
      }),
      new Promise<void>((resolve) => {
        setTimeout(resolve, this.startupGraceMs)
      }),
    ])
  }

  async stopPolling(): Promise<void> {
    if (!this.launched || !this.runtime) return

    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer)
      this.keepAliveTimer = undefined
    }

    await this.runtime.shutdown()
    await this.runtimeTask
    this.launched = false
  }

  on(
    event: "message" | "text" | "callback_query" | "polling_error",
    listener:
      | MessageHandler
      | NonNullable<CallbackHandler>
      | TextEventHandler
      | PollingErrorHandler
  ): this {
    if (event === "message") {
      this.messageHandlers.push(listener as MessageHandler)
    } else if (event === "text") {
      this.textEventHandlers.push(listener as TextEventHandler)
    } else if (event === "polling_error") {
      this.pollingErrorHandlers.push(listener as PollingErrorHandler)
    } else {
      this.callbackHandlers.push(listener as NonNullable<CallbackHandler>)
    }
    return this
  }

  onText(
    regexp: RegExp,
    callback: (
      msg: TelegramBot.Message,
      match: RegExpExecArray | null
    ) => unknown | Promise<unknown>
  ): this {
    this.textListeners.push({ regexp, callback })
    return this
  }

  async sendMessage(
    chatId: number | string,
    text: string,
    options?: TelegramBot.SendMessageOptions
  ): Promise<TelegramBot.Message> {
    const payload: JsonObject = { chat_id: chatId, text }
    if (options) {
      Object.assign(payload, options as unknown as JsonObject)
    }

    const message = await this.getApiClient().callApiUnsafe("sendMessage", {
      ...payload,
    })

    return message as TelegramBot.Message
  }

  async sendDocument(
    chatId: number | string,
    document: unknown,
    options?: TelegramBot.SendDocumentOptions,
    fileOptions?: { filename?: string; contentType?: string }
  ): Promise<unknown> {
    const endpoint = `https://api.telegram.org/bot${this.token}/sendDocument`
    const form = new FormData()

    form.append("chat_id", String(chatId))

    if (Buffer.isBuffer(document)) {
      const filename = fileOptions?.filename || "document.bin"
      const contentType = fileOptions?.contentType || "application/octet-stream"
      const bytes = new Uint8Array(document)
      form.append(
        "document",
        new Blob([bytes], { type: contentType }),
        filename
      )
    } else {
      form.append("document", String(document))
    }

    if (options?.caption) form.append("caption", options.caption)
    if (options?.parse_mode) form.append("parse_mode", options.parse_mode)
    if (options?.disable_notification !== undefined) {
      form.append("disable_notification", String(options.disable_notification))
    }
    if (options?.reply_to_message_id !== undefined) {
      form.append("reply_to_message_id", String(options.reply_to_message_id))
    }
    if (options?.reply_markup) {
      form.append("reply_markup", JSON.stringify(options.reply_markup))
    }

    const response = await fetch(endpoint, {
      method: "POST",
      body: form,
    })

    const json = (await response.json()) as {
      ok: boolean
      result?: unknown
      description?: string
    }

    if (!json.ok) {
      throw new Error(json.description || "sendDocument failed")
    }

    return json.result
  }

  async answerCallbackQuery(
    callbackQueryId: string,
    options?: TelegramBot.AnswerCallbackQueryOptions
  ): Promise<boolean> {
    return (await this.getApiClient().callApiUnsafe("answerCallbackQuery", {
      callback_query_id: callbackQueryId,
      ...(options?.text ? { text: options.text } : {}),
      ...(options?.show_alert !== undefined
        ? { show_alert: options.show_alert }
        : {}),
      ...(options?.url ? { url: options.url } : {}),
      ...(options?.cache_time !== undefined
        ? { cache_time: options.cache_time }
        : {}),
    })) as boolean
  }

  async editMessageText(
    text: string,
    options: TelegramBot.EditMessageTextOptions
  ): Promise<TelegramBot.Message | boolean> {
    const payload: JsonObject = { text }
    Object.assign(payload, options as unknown as JsonObject)

    return (await this.getApiClient().callApiUnsafe("editMessageText", {
      ...payload,
    })) as TelegramBot.Message | boolean
  }

  async editMessageReplyMarkup(
    replyMarkup: TelegramBot.InlineKeyboardMarkup,
    options: TelegramBot.EditMessageReplyMarkupOptions
  ): Promise<TelegramBot.Message | boolean> {
    const payload: JsonObject = {
      reply_markup: replyMarkup as unknown as JsonObject,
    }
    Object.assign(payload, options as unknown as JsonObject)

    return (await this.getApiClient().callApiUnsafe("editMessageReplyMarkup", {
      ...payload,
    })) as TelegramBot.Message | boolean
  }

  async getFileLink(fileId: string): Promise<string> {
    const file = (await this.getApiClient().callApiUnsafe("getFile", {
      file_id: fileId,
    })) as { file_path?: string }

    if (!file.file_path) {
      throw new Error("file_path missing in getFile response")
    }

    return `https://api.telegram.org/file/bot${this.token}/${file.file_path}`
  }

  private getApiClient() {
    if (!this.apiClient) {
      throw new Error("Telegram API client is not initialized")
    }
    return this.apiClient
  }

  private async handleUpdate(update: unknown): Promise<void> {
    const candidate = update as TelegramUpdateLike
    if (candidate.message) {
      const msg = candidate.message as TelegramBot.Message

      for (const handler of this.messageHandlers) {
        await handler(msg)
      }

      const text = msg.text
      if (typeof text === "string") {
        for (const handler of this.textEventHandlers) {
          await handler(msg, candidate)
        }

        for (const listener of this.textListeners) {
          const match = listener.regexp.exec(text)
          if (!match) continue
          listener.regexp.lastIndex = 0
          await listener.callback(msg, match)
        }
      }
    }

    if (candidate.callback_query) {
      const query = candidate.callback_query as TelegramBot.CallbackQuery
      for (const handler of this.callbackHandlers) {
        await handler(query)
      }
    }
  }
}
