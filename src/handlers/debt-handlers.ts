import type { WizardManager } from "../wizards/wizards"
import { dbStorage as db } from "../database/storage-db"
import * as validators from "../validators"
import { formatAmount, formatMoney, handleInsufficientFunds } from "../utils"
import { showDebtsMenu } from "../menus"
import * as handlers from "./index"
import { reminderManager } from "../services/reminder-manager"
import { AppDataSource } from "../database/data-source"
import { Debt as DebtEntity } from "../database/entities/Debt"
import { randomUUID } from "crypto"

export async function handleDebtCreateDetails(
  wizard: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const state = wizard.getState(userId)
  if (!state) return false

  const debtType = state.data?.type
  if (!debtType) {
    await wizard.sendMessage(chatId, "❌ Debt type not found.")
    wizard.clearState(userId)
    await showDebtsMenu(wizard.getBot(), chatId, userId)
    return true
  }

  const parts = text.trim().split(/\s+/)

  if (parts.length < 2) {
    const defaultCurrency = await db.getDefaultCurrency(userId)
    await wizard.sendMessage(
      chatId,
      `❌ Invalid format. Use: Name Amount [Currency]\n\n` +
      `*Examples:*\n` +
      `• John 1000\n` +
      `• Maria 5000 ${defaultCurrency}`,
      {
        parse_mode: "Markdown",
        ...wizard.getBackButton(),
      }
    )
    return true
  }

  const name = parts[0]
  const amountText = parts.slice(1).join(" ")
  const defaultCurrency = await db.getDefaultCurrency(userId)
  const parsed = validators.parseAmountWithCurrency(amountText, defaultCurrency)

  if (!parsed || parsed.amount <= 0) {
    await wizard.sendMessage(
      chatId,
      `❌ Invalid format. Try: ${name} 100 or ${name} 100 ${defaultCurrency}`,
      wizard.getBackButton()
    )
    return true
  }

  // Store debt details and ask about due date
  await wizard.goToStep(userId, "DEBT_ASK_DUE_DATE", {
    name,
    amount: parsed.amount,
    currency: parsed.currency,
    type: debtType,
  })

  await wizard.sendMessage(
    chatId,
    `📅 Set a due date for this debt?

` +
    `Debt: *${name}* - ${formatMoney(parsed.amount, parsed.currency)}

` +
    `Enter date (DD.MM.YYYY) or tap Skip to create without reminder.`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        keyboard: [
          [{ text: "⏩ Skip" }],
          [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
        ],
        resize_keyboard: true,
      },
    }
  )

  return true
}

export async function handleDebtPartialAmount(
  wizard: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const state = wizard.getState(userId)
  if (!state) return false

  const debt = state.data.debt
  if (!debt) {
    await wizard.sendMessage(chatId, "❌ Error: Missing debt data")
    wizard.clearState(userId)
    await showDebtsMenu(wizard.getBot(), chatId, userId)
    return true
  }

  const defaultCurrency = await db.getDefaultCurrency(userId)
  const parsed = validators.parseAmountWithCurrency(text, defaultCurrency)
  if (!parsed) {
    await wizard.sendMessage(
      chatId,
      `❌ Invalid format. Try: 100 or 100 ${defaultCurrency}`,
      wizard.getBackButton()
    )
    return true
  }

  const remaining = debt.amount - debt.paidAmount

  if (parsed.amount <= 0) {
    await wizard.sendMessage(
      chatId,
      `❌ Amount must be greater than zero.`,
      wizard.getBackButton()
    )
    return true
  }

  if (parsed.amount > remaining) {
    await wizard.sendMessage(
      chatId,
      `❌ Error: Amount (${formatAmount(parsed.amount)}) exceeds remaining debt (${formatMoney(remaining, debt.currency)}).`,
      wizard.getBackButton()
    )
    return true
  }

  const balanceCount = (await db.getBalancesList(userId)).length
  if (balanceCount === 0) {
    await wizard.sendMessage(
      chatId,
      "⚠️ *No Balances Found*\n\n" +
      "Before making payments, you need at least one balance account.\n\n" +
      "💡 *Quick Start:*\n" +
      "1️⃣ Go to 💰 *Balances*\n" +
      "2️⃣ Tap ✨ *Add Balance*\n" +
      "3️⃣ Enter account name and amount",
      {
        parse_mode: "Markdown",
        reply_markup: {
          keyboard: [
            [{ text: "💳 Go to Balances" }],
            [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
          ],
          resize_keyboard: true,
        },
      }
    )
    return true
  }

  await wizard.goToStep(userId, "DEBT_PARTIAL_ACCOUNT", {
    payAmount: parsed.amount,
  })

  const promptText =
    debt.type === "I_OWE"
      ? "💳 Select account to pay from:"
      : "💰 Select account to add to:"

  await handlers.handleTxAccount(wizard, chatId, userId, promptText)
  return true
}

export async function handleDebtPartialAccount(
  wizard: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const state = wizard.getState(userId)
  if (!state) return false

  let cleanText = text
  if (text.startsWith("⭐ ")) {
    cleanText = text.substring(2)
  }

  const accountName = cleanText.split(" (")[0].trim()
  const debt = state.data.debt
  const payAmount = state.data.payAmount

  if (!debt || !payAmount) {
    await wizard.sendMessage(chatId, "❌ Error: Missing debt data")
    wizard.clearState(userId)
    await showDebtsMenu(wizard.getBot(), chatId, userId)
    return true
  }

  if (debt.type === "I_OWE") {
    const balances = await db.getBalancesList(userId)
    const balance = balances.find((b) => b.accountId === accountName)

    if (!balance) {
      await wizard.sendMessage(
        chatId,
        `❌ Error: Account "${accountName}" not found.`,
        wizard.getBackButton()
      )
      return true
    }

    if (balance.amount < payAmount) {
      await wizard.sendMessage(
        chatId,
        handleInsufficientFunds(
          accountName,
          balance.amount,
          balance.currency,
          state.data.currency
        ),
        {
          reply_markup: {
            keyboard: [
              [{ text: "💳 Go to Balances" }],
              [{ text: "💫 Change Amount" }, { text: "🏠 Main Menu" }],
            ],
            resize_keyboard: true,
          },
        }
      )
      return true
    }
  }

  const result = await db.updateDebtAmount(
    userId,
    debt.id,
    payAmount,
    accountName,
    debt.currency
  )

  if (!result.success) {
    await wizard.sendMessage(
      chatId,
      result.message || "❌ Error",
      wizard.getBackButton()
    )
    return true
  }

  const updatedDebt = await db.getDebtById(userId, debt.id)
  if (updatedDebt?.isPaid) {
    const closeMsg =
      debt.type === "I_OWE"
        ? "🎉 Debt fully paid and closed!"
        : "🎉 Debt fully received and closed!"
    await wizard.sendMessage(chatId, closeMsg)
  } else {
    const emoji = debt.type === "I_OWE" ? "💸" : "💰"
    const action = debt.type === "I_OWE" ? "Paid" : "Received"
    const remaining = updatedDebt
      ? updatedDebt.amount - updatedDebt.paidAmount
      : 0
    await wizard.sendMessage(
      chatId,
      `✅ ${emoji} ${action} ${formatMoney(payAmount, debt.currency)}. Remaining: ${formatMoney(remaining, debt.currency)}`
    )
  }

  wizard.clearState(userId)
  await showDebtsMenu(wizard.getBot(), chatId, userId)

  return true
}
