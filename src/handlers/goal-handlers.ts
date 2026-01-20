import { WizardManager } from "../wizards/wizards"
import { dbStorage as db } from "../database/storage-db"
import * as validators from "../validators"
import * as handlers from "./index"
import { showGoalsMenu } from "../menus"
import { formatAmount, formatMoney, handleInsufficientFunds } from "../utils"
import { randomUUID } from "crypto"

export async function handleGoalInput(
  wizard: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const defaultCurrency = await db.getDefaultCurrency(userId)
  const parsed = validators.parseGoalInput(text, defaultCurrency)
  if (!parsed) {
    await wizard.sendMessage(
      chatId,
      validators.getValidationErrorMessage("goal"),
      wizard.getBackButton()
    )
    return true
  }

  const goalId = randomUUID()
  await db.addGoal(userId, {
    id: goalId,
    name: parsed.name,
    targetAmount: parsed.targetAmount,
    currentAmount: 0,
    currency: parsed.currency,
    status: "ACTIVE",
  })

  // Ask about deadline
  wizard.setState(userId, {
    step: "GOAL_ASK_DEADLINE",
    data: {
      goalId,
      name: parsed.name,
      targetAmount: parsed.targetAmount,
      currency: parsed.currency,
    },
  })

  await wizard.sendMessage(
    chatId,
    `🎯 Goal created: *${parsed.name}*\n\n` +
    `📅 Set a deadline for this goal?\n\n` +
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

export async function handleGoalDepositAmount(
  wizard: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const state = wizard.getState(userId)
  if (!state) return false

  const goal = state.data.goal
  if (!goal) {
    await wizard.sendMessage(chatId, "❌ Error: Missing goal data")
    wizard.clearState(userId)
    await showGoalsMenu(wizard.getBot(), chatId, userId)
    return true
  }

  const defaultCurrency = await db.getDefaultCurrency(userId)
  const parsed = validators.parseAmountWithCurrency(text, defaultCurrency)
  if (!parsed) {
    await wizard.sendMessage(
      chatId,
      `❌ Invalid amount. Try: 100 or 100 ${defaultCurrency}`,
      wizard.getBackButton()
    )
    return true
  }

  const remaining = goal.targetAmount - goal.currentAmount

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
      `❌ Error: Amount (${formatAmount(parsed.amount)}) exceeds remaining goal target (${formatMoney(remaining, goal.currency)}).`,
      wizard.getBackButton()
    )
    return true
  }

  const balanceCount = (await db.getBalancesList(userId)).length
  if (balanceCount === 0) {
    await wizard.sendMessage(
      chatId,
      "⚠️ *No Balances Found*\n\n" +
      "Before depositing to goals, you need at least one balance account.\n\n" +
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

  await wizard.goToStep(userId, "GOAL_DEPOSIT_ACCOUNT", {
    depositAmount: parsed.amount,
  })

  await handlers.handleTxAccount(wizard, chatId, userId, text)
  return true
}

export async function handleGoalDepositAccount(
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
  const goal = state.data.goal
  const amount = state.data.depositAmount || state.data.payAmount

  if (!goal || !amount) {
    await wizard.sendMessage(chatId, "❌ Error: Missing goal data")
    wizard.clearState(userId)
    await showGoalsMenu(wizard.getBot(), chatId, userId)
    return true
  }

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

  if (balance.amount < amount) {
    await wizard.sendMessage(
      chatId,
      handleInsufficientFunds(
        accountName,
        balance.amount,
        balance.currency,
        amount,
        goal.currency
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

  const result = await db.depositToGoal(
    userId,
    goal.id,
    amount,
    accountName,
    goal.currency
  )

  if (!result.success) {
    await wizard.sendMessage(
      chatId,
      result.message || "❌ Error",
      wizard.getBackButton()
    )
    return true
  }

  await wizard.sendMessage(
    chatId,
    `✅ 🎯 Deposited ${formatMoney(amount, goal.currency)} to "${goal.name}" from ${accountName}!`
  )
  wizard.clearState(userId)
  await showGoalsMenu(wizard.getBot(), chatId, userId)

  return true
}
