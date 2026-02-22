declare module "node-telegram-bot-api" {
  namespace TelegramBot {
    interface User {
      id: number
      is_bot?: boolean
      first_name?: string
      username?: string
      language_code?: string
    }

    interface Chat {
      id: number
      type?: string
      title?: string
      username?: string
      first_name?: string
      last_name?: string
    }

    interface Document {
      file_id: string
      file_name?: string
      mime_type?: string
      file_size?: number
    }

    interface Voice {
      file_id: string
      duration?: number
      mime_type?: string
      file_size?: number
    }

    interface Message {
      message_id: number
      chat: Chat
      from?: User
      date?: number
      text?: string
      document?: Document
      voice?: Voice
    }

    interface CallbackQuery {
      id: string
      from: User
      data?: string
      message?: Message
      inline_message_id?: string
    }

    interface KeyboardButton {
      text: string
    }

    interface InlineKeyboardButton {
      text: string
      callback_data?: string
      url?: string
    }

    interface ReplyKeyboardMarkup {
      keyboard: KeyboardButton[][]
      resize_keyboard?: boolean
      one_time_keyboard?: boolean
      selective?: boolean
    }

    interface InlineKeyboardMarkup {
      inline_keyboard: InlineKeyboardButton[][]
    }

    interface SendMessageOptions {
      parse_mode?: string
      disable_web_page_preview?: boolean
      disable_notification?: boolean
      reply_to_message_id?: number
      reply_markup?: ReplyKeyboardMarkup | InlineKeyboardMarkup
    }

    interface SendDocumentOptions {
      caption?: string
      parse_mode?: string
      disable_notification?: boolean
      reply_to_message_id?: number
      reply_markup?: ReplyKeyboardMarkup | InlineKeyboardMarkup
    }

    interface AnswerCallbackQueryOptions {
      callback_query_id?: string
      text?: string
      show_alert?: boolean
      url?: string
      cache_time?: number
    }

    interface EditMessageTextOptions {
      chat_id?: number
      message_id?: number
      inline_message_id?: string
      parse_mode?: string
      disable_web_page_preview?: boolean
      reply_markup?: InlineKeyboardMarkup
    }

    interface EditMessageReplyMarkupOptions {
      chat_id?: number
      message_id?: number
      inline_message_id?: string
    }

    interface PollingOptions {
      polling?: boolean
    }
  }

  class TelegramBot {
    constructor(token: string, options?: TelegramBot.PollingOptions)

    launch?(): Promise<void>
    stopPolling(): Promise<void>

    on(event: "message", listener: (msg: TelegramBot.Message) => void): this
    on(
      event: "text",
      listener: (msg: TelegramBot.Message, metadata: unknown) => void
    ): this
    on(
      event: "callback_query",
      listener: (query: TelegramBot.CallbackQuery) => void
    ): this
    on(event: "polling_error", listener: (error: unknown) => void): this

    onText(
      regexp: RegExp,
      callback: (
        msg: TelegramBot.Message,
        match: RegExpExecArray | null
      ) => unknown | Promise<unknown>
    ): this

    sendMessage(
      chatId: number | string,
      text: string,
      options?: TelegramBot.SendMessageOptions
    ): Promise<TelegramBot.Message>

    sendDocument(
      chatId: number | string,
      document: unknown,
      options?: TelegramBot.SendDocumentOptions,
      fileOptions?: {
        filename?: string
        contentType?: string
      }
    ): Promise<unknown>

    sendDocument(
      chatId: number | string,
      document: unknown,
      options?: TelegramBot.SendDocumentOptions
    ): Promise<unknown>

    answerCallbackQuery(
      callbackQueryId: string,
      options?: TelegramBot.AnswerCallbackQueryOptions
    ): Promise<boolean>

    editMessageText(
      text: string,
      options: TelegramBot.EditMessageTextOptions
    ): Promise<TelegramBot.Message | boolean>

    editMessageReplyMarkup(
      replyMarkup: TelegramBot.InlineKeyboardMarkup,
      options: TelegramBot.EditMessageReplyMarkupOptions
    ): Promise<TelegramBot.Message | boolean>

    getFileLink(fileId: string): Promise<string>
  }

  export = TelegramBot
}
