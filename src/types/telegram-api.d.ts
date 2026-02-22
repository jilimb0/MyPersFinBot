declare module "@telegram-api" {
  type TgUser = import("@jilimb0/tgwrapper").User
  type TgChat = import("@jilimb0/tgwrapper").Chat
  type TgMessage = import("@jilimb0/tgwrapper").Message
  type TgCallbackQuery = import("@jilimb0/tgwrapper").CallbackQuery
  type TgPayloads = import("@jilimb0/tgwrapper").TelegramApiMethodPayloads

  namespace TelegramBot {
    type User = Pick<
      TgUser,
      "id" | "is_bot" | "first_name" | "username" | "language_code"
    >

    type Chat = Pick<
      TgChat,
      "id" | "type" | "title" | "username" | "first_name" | "last_name"
    >

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

    type Message = Pick<TgMessage, "message_id" | "chat" | "from" | "date"> & {
      document?: Document
      text?: string
      voice?: Voice
    }

    type CallbackQuery = Pick<
      TgCallbackQuery,
      "id" | "from" | "data" | "message" | "inline_message_id"
    >

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

    type SendMessageOptions = Omit<
      TgPayloads["sendMessage"],
      "chat_id" | "text"
    > & {
      reply_markup?: ReplyKeyboardMarkup | InlineKeyboardMarkup
    }

    type SendDocumentOptions = Omit<
      TgPayloads["sendDocument"],
      "chat_id" | "document"
    > & {
      reply_markup?: ReplyKeyboardMarkup | InlineKeyboardMarkup
    }

    interface AnswerCallbackQueryOptions {
      callback_query_id?: string
      text?: string
      show_alert?: boolean
      url?: string
      cache_time?: number
    }

    type EditMessageTextOptions = Omit<
      TgPayloads["editMessageText"],
      "text"
    > & {
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
