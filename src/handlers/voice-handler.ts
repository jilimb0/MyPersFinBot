import TelegramBot from "node-telegram-bot-api"
import { nlpParser } from "../services/nlp-parser"
import { assemblyAIService } from "../services/assemblyai-service"
import { dbStorage as db } from "../database/storage-db"
import { TransactionCategory, TransactionType } from "../types"
import { formatMoney } from "../utils"
import axios from "axios"
import { unlinkSync, writeFileSync, existsSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"
import { randomUUID } from "crypto"
import { exec } from "child_process"
import { promisify } from "util"
import fs from "fs"

const execAsync = promisify(exec)

export async function handleVoiceMessage(
  bot: TelegramBot,
  msg: TelegramBot.Message
): Promise<void> {
  const chatId = msg.chat.id
  const userId = chatId.toString()
  const voice = msg.voice

  if (!voice) return

  try {
    await bot.sendMessage(chatId, "🎤 Processing voice message...")

    const fileLink = await bot.getFileLink(voice.file_id)
    const response = await axios.get(fileLink, { responseType: "arraybuffer" })

    const ogaPath = join(tmpdir(), `voice_${Date.now()}.oga`)
    writeFileSync(ogaPath, response.data)

    const wavPath = join(tmpdir(), `voice_${Date.now()}.wav`)

    try {
      await convertOgaToWav(ogaPath, wavPath)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (conversionError: any) {
      if (existsSync(ogaPath)) {
        unlinkSync(ogaPath)
      }

      const errorMsg = conversionError.message.includes("FFmpeg")
        ? "❌ **FFmpeg is not installed** ⚠️\n\n" +
        "**Admin needs to install FFmpeg:**\n" +
        "• macOS: `brew install ffmpeg`\n" +
        "• Linux: `apt-get install ffmpeg`\n\n" +
        "**Meanwhile, you can type:**\n" +
        "• `50 coffee` ☕\n" +
        "• `100 taxi` 🚕\n" +
        "• `потратил 200 на еду` 🍔"
        : "❌ Audio conversion failed. Please try text input."

      await bot.sendMessage(chatId, errorMsg, { parse_mode: "Markdown" })
      return
    }

    if (!existsSync(wavPath)) {
      unlinkSync(ogaPath)
      await bot.sendMessage(
        chatId,
        "❌ Failed to convert audio. Please use text input.\n\n" +
        "Examples: `50 coffee`, `100 taxi`, `потратил 200 на еду`",
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
        "🎤 *Voice transcription not configured*\n\n" +
        "To enable voice messages, admin needs to set ASSEMBLYAI_API_KEY.\n\n" +
        "**Meanwhile, you can:**\n\n" +
        "**Option 1: Use Telegram's transcription** 📝\n" +
        "1. Tap and hold your voice message\n" +
        "2. Select \"Transcribe\"\n" +
        "3. Copy the text and send it to me\n\n" +
        "**Option 2: Just type** ⌨️\n" +
        "Examples:\n" +
        "• `50 coffee` ☕\n" +
        "• `100 taxi` 🚕\n" +
        "• `потратил 200 на еду` 🍔\n" +
        "• `витратив полтинник на каву` ☕\n" +
        "• `зарплата пришла` 💰",
        { parse_mode: "Markdown" }
      )
      return
    }

    await bot.sendMessage(chatId, `📝 Recognized: "${text}"`)

    await handleNLPInput(bot, chatId, userId, text)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("Voice processing error:", error)

    let errorMsg = "❌ Failed to process voice message."

    if (error.message && error.message.includes("FFmpeg")) {
      errorMsg = "❌ FFmpeg is not installed.⚠️" +
        "**Admin: Install FFmpeg**" +
        "\u2022 macOS: `brew install ffmpeg`" +
        "\u2022 Linux: `apt-get install ffmpeg`" +
        "**You can use text instead:**" +
        "\u2022 `50 coffee` ☕️" +
        "\u2022 `100 taxi` 🚕"
    } else {
      errorMsg += " Please try text input."
    }

    await bot.sendMessage(chatId, errorMsg, { parse_mode: "Markdown" })
  }
}

export async function handleNLPInput(
  bot: TelegramBot,
  chatId: number,
  userId: string,
  text: string
): Promise<void> {
  try {
    const defaultCurrency = await db.getDefaultCurrency(userId)

    const result = nlpParser.parse(text, defaultCurrency)

    if (!result || !result.amount) {
      await bot.sendMessage(
        chatId,
        "❓ I couldn't understand that. Try:\n\n" +
        "• \"50 coffee\"\n" +
        "• \"потратил 100 на такси\"\n" +
        "• \"зарплата пришла 5000\"\n" +
        "• \"витратив полтинник на каву\""
      )
      return
    }

    const emoji = result.type === TransactionType.INCOME ? "💰" : "💸"
    const sign = result.type === TransactionType.INCOME ? "+" : "-"
    const typeLabel = result.type === TransactionType.INCOME ? "Income" : "Expense"

    const confirmMsg =
      `${emoji} *Confirm ${typeLabel}*\n\n` +
      `Amount: ${sign}${formatMoney(result.amount, defaultCurrency, true)}\n` +
      `Category: ${result.category}\n` +
      `Description: ${result.description}\n` +
      `Confidence: ${(result.confidence * 100).toFixed(0)}%\n\n` +
      `Is this correct?`

    await bot.sendMessage(chatId, confirmMsg, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "✅ Yes, Save",
              callback_data: `nlp_confirm|${result.amount}|${result.type}|${result.category}|${result.description}`,
            },
          ],
          [
            {
              text: "✏️ Edit Category",
              callback_data: `nlp_edit_category|${result.amount}|${result.type}|${result.description}`,
            },
          ],
          [
            {
              text: "❌ Cancel",
              callback_data: "nlp_cancel",
            },
          ],
        ],
      },
    })
  } catch (error) {
    console.error("NLP parsing error:", error)
    await bot.sendMessage(
      chatId,
      "❌ Failed to parse input. Please try again."
    )
  }
}

export async function handleNLPCallback(
  bot: TelegramBot,
  query: TelegramBot.CallbackQuery
): Promise<void> {
  const chatId = query.message?.chat.id
  const userId = query.from.id.toString()
  const data = query.data

  if (!chatId || !data) return

  try {
    if (data === "nlp_cancel") {
      await bot.editMessageText("❌ Transaction cancelled", {
        chat_id: chatId,
        message_id: query.message?.message_id,
      })
      await bot.answerCallbackQuery(query.id)
      return
    }

    if (data.startsWith("nlp_confirm|")) {
      const [, amountStr, type, category, description] = data.split("|")
      const amount = parseFloat(amountStr)

      const balances = await db.getBalancesList(userId)
      if (balances.length === 0) {
        await bot.editMessageText(
          "❌ No accounts found. Please create a balance account first.",
          {
            chat_id: chatId,
            message_id: query.message?.message_id,
          }
        )
        await bot.answerCallbackQuery(query.id)
        return
      }

      const defaultAccount = balances[0].accountId
      const currency = await db.getDefaultCurrency(userId)

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

      const emoji = type === "INCOME" ? "💰" : "💸"
      const sign = type === "INCOME" ? "+" : "-"

      await bot.editMessageText(
        `✅ ${emoji} Transaction saved!\n\n` +
        `${sign}${formatMoney(amount, currency, true)} - ${description}`,
        {
          chat_id: chatId,
          message_id: query.message?.message_id,
        }
      )

      await bot.answerCallbackQuery(query.id, { text: "✅ Saved!" })
      return
    }

    if (data.startsWith("nlp_edit_category|")) {
      const [, amountStr, type, description] = data.split("|")

      await bot.editMessageText(
        "🏷️ Select category:",
        {
          chat_id: chatId,
          message_id: query.message?.message_id,
          reply_markup: {
            inline_keyboard: [
              [
                { text: "🍔 Food", callback_data: `nlp_set_cat|${amountStr}|${type}|Food|${description}` },
                { text: "🚗 Transport", callback_data: `nlp_set_cat|${amountStr}|${type}|Transport|${description}` },
              ],
              [
                { text: "🛍️ Shopping", callback_data: `nlp_set_cat|${amountStr}|${type}|Shopping|${description}` },
                { text: "🎮 Entertainment", callback_data: `nlp_set_cat|${amountStr}|${type}|Entertainment|${description}` },
              ],
              [
                { text: "💡 Bills", callback_data: `nlp_set_cat|${amountStr}|${type}|Bills|${description}` },
                { text: "🏥 Health", callback_data: `nlp_set_cat|${amountStr}|${type}|Health|${description}` },
              ],
              [
                { text: "💼 Salary", callback_data: `nlp_set_cat|${amountStr}|${type}|Salary|${description}` },
                { text: "📦 Other", callback_data: `nlp_set_cat|${amountStr}|${type}|Other|${description}` },
              ],
              [
                { text: "⬅️ Back", callback_data: `nlp_confirm|${amountStr}|${type}|Other|${description}` },
              ],
            ],
          },
        }
      )
      await bot.answerCallbackQuery(query.id)
      return
    }

    if (data.startsWith("nlp_set_cat|")) {
      const [, amountStr, type, category, description] = data.split("|")
      const confirmData = `nlp_confirm|${amountStr}|${type}|${category}|${description}`

      await bot.answerCallbackQuery(query.id)

      const newQuery = { ...query, confirmData }
      await handleNLPCallback(bot, newQuery)
      return
    }

    await bot.answerCallbackQuery(query.id)
  } catch (error) {
    console.error("NLP callback error:", error)
    await bot.answerCallbackQuery(query.id, { text: "❌ Error" })
  }
}

async function convertOgaToWav(ogaPath: string, wavPath: string): Promise<void> {
  console.log(`🔄 Converting: ${ogaPath} → ${wavPath}`)

  try {
    if (!existsSync(ogaPath)) {
      throw new Error(`Source file not found: ${ogaPath}`)
    }

    const command = `ffmpeg -i "${ogaPath}" -acodec pcm_s16le -ar 16000 -ac 1 -f wav -y "${wavPath}" 2>&1`

    console.log(`📞 Running FFmpeg...`)
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

    console.log(`✅ Converted successfully: ${ogaPath} → ${wavPath} (${fileSizeKB} KB)`)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("❌ FFmpeg conversion error:", error.message)

    if (error.message.includes("command not found") ||
      error.message.includes("not recognized") ||
      error.code === "ENOENT") {
      console.error("💡 FFmpeg is not installed!")
      console.error("📦 Install: brew install ffmpeg (macOS) or apt-get install ffmpeg (Linux)")
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
      console.log("💡 Or user can use text input: '50 coffee', 'потратил 100 на такси', etc.")
      return null
    }

    const text = await assemblyAIService.transcribeFile(filePath)
    return text
  } catch (error) {
    console.error("Voice transcription error:", error)
    return null
  }
}
