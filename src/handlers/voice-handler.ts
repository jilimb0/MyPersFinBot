import { exec } from "node:child_process"
import { randomUUID } from "node:crypto"
import fs, { existsSync, unlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { promisify } from "node:util"
import type { BotClient, TgTypes as Tg } from "@jilimb0/tgwrapper"
import { request } from "undici"
import { config } from "../config"
import { dbStorage as db } from "../database/storage-db"
import { resolveLanguage, t } from "../i18n"
import { sendPremiumRequiredMessage } from "../monetization/premium-gate"
import { assemblyAIService } from "../services/assemblyai-service"
import { nlpParser } from "../services/nlp-parser"
import { type TransactionCategory, TransactionType } from "../types"
import { escapeMarkdown, formatMoney } from "../utils"
import type { WizardManager } from "../wizards/wizards"

const execAsync = promisify(exec)

export async function handleVoiceMessage(
  bot: BotClient,
  msg: Tg.Message,
  wizard: WizardManager
): Promise<void> {
  const chatId = msg.chat.id
  const userId = chatId.toString()
  const voice = msg.voice
  const state = wizard.getState(userId)
  const lang = resolveLanguage(state?.lang)
  if (!voice) return

  try {
    const premiumEnabled = await db.canUsePremiumFeature(userId)
    if (!premiumEnabled) {
      await sendPremiumRequiredMessage(
        bot,
        chatId,
        lang,
        t(lang, "commands.monetization.featureVoice")
      )
      return
    }
    const usage = await db.checkAndConsumeUsage(userId, "voice")
    if (!usage.allowed) return

    await bot.sendMessage(chatId, t(lang, "voiceHandler.processing"))

    const fileLink = await bot.getFileLink(voice.file_id)

    // Download voice file using undici
    const { statusCode, body } = await request(fileLink)
    if (statusCode !== 200) {
      throw new Error(`Failed to download voice file: HTTP ${statusCode}`)
    }

    // Read response body as buffer
    const chunks = []
    for await (const chunk of body) {
      chunks.push(chunk)
    }
    const audioData = Buffer.concat(chunks)

    const ogaPath = join(tmpdir(), `voice_${Date.now()}.oga`)
    writeFileSync(ogaPath, audioData)

    const wavPath = join(tmpdir(), `voice_${Date.now()}.wav`)

    try {
      await convertOgaToWav(ogaPath, wavPath)
    } catch (conversionError: any) {
      if (existsSync(ogaPath)) {
        unlinkSync(ogaPath)
      }

      const errorMsg = conversionError.message.includes("FFmpeg")
        ? t(lang, "voiceHandler.ffmpegNotInstalledMessage")
        : t(lang, "voiceHandler.conversionFailed")

      await bot.sendMessage(chatId, errorMsg, { parse_mode: "Markdown" })
      return
    }

    if (!existsSync(wavPath)) {
      unlinkSync(ogaPath)
      await bot.sendMessage(
        chatId,
        t(lang, "voiceHandler.conversionFailedLong"),
        { parse_mode: "Markdown" }
      )
      return
    }

    unlinkSync(ogaPath)

    const text = await convertVoiceToText(wavPath)

    if (existsSync(wavPath)) {
      unlinkSync(wavPath)
    }

    if (!text) {
      await bot.sendMessage(
        chatId,
        t(lang, "voiceHandler.notConfiguredMessage"),
        { parse_mode: "Markdown" }
      )
      return
    }

    await bot.sendMessage(chatId, t(lang, "voiceHandler.recognized", { text }))

    await handleNLPInput(bot, chatId, userId, text, wizard)
  } catch (error: any) {
    console.error("Voice processing error:", error)

    const state = wizard.getState(userId)
    const lang = resolveLanguage(state?.lang)
    let errorMsg = t(lang, "voiceHandler.processingFailed")

    if (error.message?.includes("FFmpeg")) {
      errorMsg = t(lang, "voiceHandler.ffmpegMissingMessage")
    } else {
      errorMsg += ` ${t(lang, "voiceHandler.tryTextInput")}`
    }

    await bot.sendMessage(chatId, errorMsg, { parse_mode: "Markdown" })
  }
}

export async function handleNLPInput(
  bot: BotClient,
  chatId: number,
  userId: string,
  text: string,
  wizard: WizardManager
): Promise<void> {
  const state = wizard.getState(userId)
  const lang = resolveLanguage(state?.lang)

  try {
    const defaultCurrency = await db.getDefaultCurrency(userId)

    const result = nlpParser.parse(text, defaultCurrency)

    if (!result || !result.amount) {
      await bot.sendMessage(
        chatId,
        t(lang, "voiceHandler.couldNotUnderstandMessage")
      )
      return
    }

    const emoji = result.type === TransactionType.INCOME ? "💰" : "💸"
    const sign = result.type === TransactionType.INCOME ? "+" : "-"
    const typeLabel =
      result.type === TransactionType.INCOME
        ? t(lang, "voiceHandler.types.income")
        : t(lang, "voiceHandler.types.expense")

    const confirmMsg =
      `${t(lang, "voiceHandler.confirm.title", {
        emoji,
        type: typeLabel,
      })}\n\n` +
      `${t(lang, "voiceHandler.confirm.amount", {
        amount: `${sign}${formatMoney(result.amount, defaultCurrency, true)}`,
      })}\n` +
      `${t(lang, "voiceHandler.confirm.category", {
        category: escapeMarkdown(result.category),
      })}\n` +
      `${t(lang, "voiceHandler.confirm.description", {
        description: escapeMarkdown(result.description),
      })}\n` +
      `${t(lang, "voiceHandler.confirm.confidence", {
        confidence: (result.confidence * 100).toFixed(0),
      })}\n\n` +
      `${t(lang, "voiceHandler.confirm.isCorrect")}`

    await bot.sendMessage(chatId, confirmMsg, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: t(lang, "common.yesSave"),
              callback_data: `nlp_confirm|${result.amount}|${result.type}|${result.category}|${result.description}`,
            },
          ],
          [
            {
              text: t(lang, "common.editCategory"),
              callback_data: `nlp_edit_category|${result.amount}|${result.type}|${result.description}`,
            },
          ],
          [
            {
              text: t(lang, "common.cancel"),
              callback_data: "nlp_cancel",
            },
          ],
        ],
      },
    })
  } catch (error) {
    console.error("NLP parsing error:", error)
    await bot.sendMessage(chatId, t(lang, "voiceHandler.failedToParse"))
  }
}

export async function handleNLPCallback(
  bot: BotClient,
  query: Tg.CallbackQuery,
  wizard: WizardManager
): Promise<void> {
  const chatId = query.message?.chat.id
  const userId = query.from.id.toString()
  const data = query.data

  if (!chatId || !data) return

  const state = wizard.getState(userId)
  const lang = resolveLanguage(state?.lang)

  try {
    if (data === "nlp_cancel") {
      await bot.editMessageText(t(lang, "voiceHandler.transactionCancelled"), {
        chat_id: chatId,
        message_id: query.message?.message_id,
      })
      await bot.answerCallbackQuery(query.id)
      return
    }

    if (data.startsWith("nlp_confirm|")) {
      const [, amountStr, type, category, description] = data.split("|")
      const amount = parseFloat(amountStr!)

      const balances = await db.getBalancesList(userId)
      if (balances.length === 0) {
        await bot.editMessageText(t(lang, "voiceHandler.noAccountsFound"), {
          chat_id: chatId,
          message_id: query.message?.message_id,
        })
        await bot.answerCallbackQuery(query.id)
        return
      }

      const defaultAccount = balances[0]?.accountId
      const currency = await db.getDefaultCurrency(userId)

      try {
        await db.addTransaction(userId, {
          id: randomUUID(),
          date: new Date(),
          amount,
          currency,
          type: type as TransactionType,
          category: category as TransactionCategory,
          description,
          fromAccountId: type === "EXPENSE" ? defaultAccount : undefined,
          toAccountId: type === "INCOME" ? defaultAccount : undefined,
        })
      } catch (error) {
        if ((error as { code?: string }).code === "SUBSCRIPTION_LIMIT_EXCEEDED") {
          await bot.editMessageText(
            `🚫 Free limit reached: ${config.FREE_TRANSACTIONS_PER_MONTH} transactions/month.\nUse /trial or /premium to continue.`,
            {
              chat_id: chatId,
              message_id: query.message?.message_id,
            }
          )
          await bot.answerCallbackQuery(query.id)
          return
        }
        throw error
      }

      const emoji = type === "INCOME" ? "💰" : "💸"
      const sign = type === "INCOME" ? "+" : "-"

      await bot.editMessageText(
        t(lang, "voiceHandler.transactionSaved", {
          emoji,
          amount: `${sign}${formatMoney(amount, currency, true)}`,
          description: description || "",
        }),
        {
          chat_id: chatId,
          message_id: query.message?.message_id,
        }
      )

      await bot.answerCallbackQuery(query.id, { text: t(lang, "common.save") })
      return
    }

    if (data.startsWith("nlp_edit_category|")) {
      const [, amountStr, type, description] = data.split("|")

      await bot.editMessageText(t(lang, "voiceHandler.selectCategory"), {
        chat_id: chatId,
        message_id: query.message?.message_id,
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: t(lang, "buttons.food"),
                callback_data: `nlp_set_cat|${amountStr}|${type}|Food|${description}`,
              },
              {
                text: t(lang, "buttons.transport"),
                callback_data: `nlp_set_cat|${amountStr}|${type}|Transport|${description}`,
              },
            ],
            [
              {
                text: t(lang, "buttons.shopping"),
                callback_data: `nlp_set_cat|${amountStr}|${type}|Shopping|${description}`,
              },
              {
                text: t(lang, "buttons.entertainment"),
                callback_data: `nlp_set_cat|${amountStr}|${type}|Entertainment|${description}`,
              },
            ],
            [
              {
                text: t(lang, "buttons.bills"),
                callback_data: `nlp_set_cat|${amountStr}|${type}|Bills|${description}`,
              },
              {
                text: t(lang, "buttons.health"),
                callback_data: `nlp_set_cat|${amountStr}|${type}|Health|${description}`,
              },
            ],
            [
              {
                text: t(lang, "buttons.salary"),
                callback_data: `nlp_set_cat|${amountStr}|${type}|Salary|${description}`,
              },
              {
                text: t(lang, "buttons.other"),
                callback_data: `nlp_set_cat|${amountStr}|${type}|Other|${description}`,
              },
            ],
            [
              {
                text: t(lang, "buttons.back"),
                callback_data: `nlp_confirm|${amountStr}|${type}|Other|${description}`,
              },
            ],
          ],
        },
      })
      await bot.answerCallbackQuery(query.id)
      return
    }

    if (data.startsWith("nlp_set_cat|")) {
      const [, amountStr, type, category, description] = data.split("|")
      const confirmData = `nlp_confirm|${amountStr}|${type}|${category}|${description}`

      await bot.answerCallbackQuery(query.id)

      const newQuery = { ...query, data: confirmData }
      await handleNLPCallback(bot, newQuery, wizard)
      return
    }

    await bot.answerCallbackQuery(query.id)
  } catch (error) {
    console.error("NLP callback error:", error)
    await bot.answerCallbackQuery(query.id, { text: t(lang, "common.error") })
  }
}

async function convertOgaToWav(
  ogaPath: string,
  wavPath: string
): Promise<void> {
  console.log(`🔄 Converting: ${ogaPath} → ${wavPath}`)

  try {
    if (!existsSync(ogaPath)) {
      throw new Error(`Source file not found: ${ogaPath}`)
    }

    const command = `ffmpeg -i "${ogaPath}" -acodec pcm_s16le -ar 16000 -ac 1 -f wav -y "${wavPath}" 2>&1`

    console.log("📞 Running FFmpeg...")
    const { stdout, stderr } = await execAsync(command)

    if (!existsSync(wavPath)) {
      console.error("❌ FFmpeg did not create output file")
      console.error("FFmpeg output:", stderr || stdout)
      throw new Error("FFmpeg failed to create WAV file")
    }

    const stats = fs.statSync(wavPath)
    const fileSizeKB = (stats.size / 1024).toFixed(2)

    if (stats.size === 0) {
      console.error("❌ WAV file is empty (0 bytes)")
      throw new Error("WAV file is empty")
    }

    console.log(
      `✅ Converted successfully: ${ogaPath} → ${wavPath} (${fileSizeKB} KB)`
    )
  } catch (error: any) {
    console.error("❌ FFmpeg conversion error:", error.message)

    if (
      error.message.includes("command not found") ||
      error.message.includes("not recognized") ||
      error.code === "ENOENT"
    ) {
      console.error("💡 FFmpeg is not installed!")
      console.error(
        "📦 Install: brew install ffmpeg (macOS) or apt-get install ffmpeg (Linux)"
      )
      throw new Error(
        "FFmpeg is not installed. Install it with: brew install ffmpeg (macOS) or apt-get install ffmpeg (Linux)"
      )
    }

    throw new Error(`Failed to convert audio: ${error.message}`)
  }
}

async function convertVoiceToText(filePath: string): Promise<string | null> {
  try {
    if (!assemblyAIService.isAvailable()) {
      console.log("⚠️ AssemblyAI not configured. Voice file:", filePath)
      console.log("💡 Set ASSEMBLYAI_API_KEY to enable voice transcription")
      console.log(
        "💡 Or user can use text input: '50 coffee', 'потратил 100 на такси', etc."
      )
      return null
    }

    const text = await assemblyAIService.transcribeFile(filePath)
    return text
  } catch (error) {
    console.error("Voice transcription error:", error)
    return null
  }
}
