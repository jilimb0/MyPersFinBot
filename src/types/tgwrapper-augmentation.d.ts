declare module "@jilimb0/tgwrapper" {
  type TgPayloads = TelegramApiMethodPayloads

  export interface ReplyKeyboardMarkup {
    keyboard: KeyboardButton[][]
    resize_keyboard?: boolean
    one_time_keyboard?: boolean
    selective?: boolean
  }

  export interface InlineKeyboardMarkup {
    inline_keyboard: InlineKeyboardButton[][]
  }

  export type SendMessageOptions = Omit<
    TgPayloads["sendMessage"],
    "chat_id" | "text"
  > & {
    reply_markup?: ReplyKeyboardMarkup | InlineKeyboardMarkup
  }

  export type SendDocumentOptions = Omit<
    TgPayloads["sendDocument"],
    "chat_id" | "document"
  > & {
    reply_markup?: ReplyKeyboardMarkup | InlineKeyboardMarkup
  }

  export interface AnswerCallbackQueryOptions {
    callback_query_id?: string
    text?: string
    show_alert?: boolean
    url?: string
    cache_time?: number
  }

  export interface LabeledPrice {
    label: string
    amount: number
  }

  export interface SendInvoiceOptions {
    title: string
    description: string
    payload: string
    provider_token?: string
    currency: string
    prices: LabeledPrice[]
    start_parameter?: string
    photo_url?: string
    photo_size?: number
    photo_width?: number
    photo_height?: number
    need_name?: boolean
    need_phone_number?: boolean
    need_email?: boolean
    need_shipping_address?: boolean
    is_flexible?: boolean
    disable_notification?: boolean
    reply_to_message_id?: number
    allow_sending_without_reply?: boolean
    reply_markup?: InlineKeyboardMarkup
  }

  export interface PreCheckoutQuery {
    id: string
    from: User
    currency: string
    total_amount: number
    invoice_payload: string
    shipping_option_id?: string
    order_info?: Record<string, unknown>
  }

  export interface SuccessfulPayment {
    currency: string
    total_amount: number
    invoice_payload: string
    telegram_payment_charge_id: string
    provider_payment_charge_id?: string
  }

  export interface AnswerPreCheckoutQueryOptions {
    pre_checkout_query_id: string
    ok: boolean
    error_message?: string
  }

  export type EditMessageTextOptions = Omit<
    TgPayloads["editMessageText"],
    "text"
  > & {
    reply_markup?: InlineKeyboardMarkup
  }

  export interface EditMessageReplyMarkupOptions {
    chat_id?: number
    message_id?: number
    inline_message_id?: string
  }

  export interface BotClient {
    launch?(): Promise<void>
    stopPolling(): Promise<void>

    on(event: "message", listener: (msg: Message) => void): this
    on(event: "callback_query", listener: (query: CallbackQuery) => void): this
    on(
      event: "pre_checkout_query",
      listener: (query: PreCheckoutQuery) => void
    ): this
    on(event: "polling_error", listener: (error: unknown) => void): this

    sendMessage(
      chatId: number | string,
      text: string,
      options?: SendMessageOptions
    ): Promise<Message>

    sendDocument(
      chatId: number | string,
      document: unknown,
      options?: SendDocumentOptions,
      fileOptions?: {
        filename?: string
        contentType?: string
      }
    ): Promise<unknown>

    sendInvoice(
      chatId: number | string,
      options: SendInvoiceOptions
    ): Promise<Message>

    answerCallbackQuery(
      callbackQueryId: string,
      options?: AnswerCallbackQueryOptions
    ): Promise<boolean>

    answerPreCheckoutQuery(
      options: AnswerPreCheckoutQueryOptions
    ): Promise<boolean>

    editMessageText(
      text: string,
      options: EditMessageTextOptions
    ): Promise<Message | boolean>

    editMessageReplyMarkup(
      replyMarkup: InlineKeyboardMarkup,
      options: EditMessageReplyMarkupOptions
    ): Promise<Message | boolean>

    getFileLink(fileId: string): Promise<string>
  }

  export namespace TgTypes {
    export type Message = import("@jilimb0/tgwrapper").Message
    export type CallbackQuery = import("@jilimb0/tgwrapper").CallbackQuery
    export type KeyboardButton = import("@jilimb0/tgwrapper").KeyboardButton
    export type InlineKeyboardButton =
      import("@jilimb0/tgwrapper").InlineKeyboardButton
    export type ReplyKeyboardMarkup =
      import("@jilimb0/tgwrapper").ReplyKeyboardMarkup
    export type InlineKeyboardMarkup =
      import("@jilimb0/tgwrapper").InlineKeyboardMarkup
    export type SendMessageOptions =
      import("@jilimb0/tgwrapper").SendMessageOptions
    export type SendDocumentOptions =
      import("@jilimb0/tgwrapper").SendDocumentOptions
    export type AnswerCallbackQueryOptions =
      import("@jilimb0/tgwrapper").AnswerCallbackQueryOptions
    export type SendInvoiceOptions =
      import("@jilimb0/tgwrapper").SendInvoiceOptions
    export type LabeledPrice = import("@jilimb0/tgwrapper").LabeledPrice
    export type PreCheckoutQuery = import("@jilimb0/tgwrapper").PreCheckoutQuery
    export type SuccessfulPayment =
      import("@jilimb0/tgwrapper").SuccessfulPayment
    export type AnswerPreCheckoutQueryOptions =
      import("@jilimb0/tgwrapper").AnswerPreCheckoutQueryOptions
    export type EditMessageTextOptions =
      import("@jilimb0/tgwrapper").EditMessageTextOptions
    export type EditMessageReplyMarkupOptions =
      import("@jilimb0/tgwrapper").EditMessageReplyMarkupOptions
  }
}
