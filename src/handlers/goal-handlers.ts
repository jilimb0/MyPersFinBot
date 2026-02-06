import { WizardManager } from "../wizards/wizards"
import { dbStorage as db } from "../database/storage-db"
import * as validators from "../validators"
import * as handlers from "./index"
import { showGoalsMenu } from "../menus-i18n"
import { formatAmount, formatMoney, handleInsufficientFunds } from "../utils"
import { randomUUID } from "crypto"
import { t } from "../i18n"
import { Goal } from "../types"

export async function handleGoalInput(
  wizard: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const defaultCurrency = await db.getDefaultCurrency(userId)
  const parsed = validators.parseGoalInput(text, defaultCurrency)
  const state = wizard.getState(userId)
  const lang = state?.lang || "en"
  if (!parsed) {
    await wizard.sendMessage(
      chatId,
      validators.getValidationErrorMessage(lang, "goal"),
      wizard.getBackButton(lang)
    )
    return true
  }

  // ✅ Check for duplicate goal name
  const userData = await db.getUserData(userId)
  const existingGoal = userData.goals.find(
    (g: Goal) => g.name === parsed.name && g.status === "ACTIVE"
  )

  if (existingGoal) {
    await wizard.sendMessage(
      chatId,
      t(lang, "goals.duplicate", { name: parsed.name }),
      {
        parse_mode: "Markdown",
        ...wizard.getBackButton(lang),
      }
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
  await wizard.goToStep(userId, "GOAL_ASK_DEADLINE", {
    goalId,
    name: parsed.name,
    targetAmount: parsed.targetAmount,
    currency: parsed.currency,
  })

  await wizard.sendMessage(
    chatId,
    t(lang, "goals.createdWithDeadlinePrompt", {
      name: parsed.name,
      skipLabel: t(lang, "common.skip"),
    }),
    {
      parse_mode: "Markdown",
      reply_markup: {
        keyboard: [
          [{ text: t(state?.lang || "en", "common.skip") }],
          [
            { text: t(state?.lang || "en", "common.back") },
            { text: t(state?.lang || "en", "mainMenu.mainMenuButton") },
          ],
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
  const lang = state?.lang || "en"
  const goal = state?.data?.goal
  if (!goal) {
    await wizard.sendMessage(
      chatId,
      t(state?.lang || "en", "goals.errorMissingData")
    )
    wizard.clearState(userId)
    await showGoalsMenu(wizard.getBot(), chatId, userId, state?.lang || "en")
    return true
  }

  const defaultCurrency = await db.getDefaultCurrency(userId)
  const parsed = validators.parseAmountWithCurrency(text, defaultCurrency)
  if (!parsed) {
    await wizard.sendMessage(
      chatId,
      t(lang, "validation.invalidAmountExample", {
        currency: defaultCurrency,
      }),
      wizard.getBackButton(lang)
    )
    return true
  }

  const remaining = goal.targetAmount - goal.currentAmount

  if (parsed.amount <= 0) {
    await wizard.sendMessage(
      chatId,
      t(lang, "errors.amountMustBePositive"),
      wizard.getBackButton(lang)
    )
    return true
  }

  if (parsed.amount > remaining) {
    await wizard.sendMessage(
      chatId,
      t(lang, "wizard.goal.amountExceedsRemaining", {
        amount: formatAmount(parsed.amount),
        remaining: formatMoney(remaining, goal.currency),
      }),
      wizard.getBackButton(lang)
    )
    return true
  }

  const balanceCount = (await db.getBalancesList(userId)).length
  if (balanceCount === 0) {
    await wizard.sendMessage(chatId, t(lang, "wizard.goal.noBalances"), {
      parse_mode: "Markdown",
      reply_markup: {
        keyboard: [
          [{ text: t(state?.lang || "en", "transactions.goToBalances") }],
          [
            { text: t(state?.lang || "en", "common.back") },
            { text: t(state?.lang || "en", "mainMenu.mainMenuButton") },
          ],
        ],
        resize_keyboard: true,
      },
    })
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

  const lang = state?.lang || "en"
  const accountName = cleanText.split(" (")[0]?.trim() || ""
  const goal = state?.data?.goal
  const amount = state?.data?.depositAmount || state?.data?.payAmount

  if (!goal || !amount) {
    await wizard.sendMessage(
      chatId,
      t(state?.lang || "en", "goals.errorMissingData")
    )
    wizard.clearState(userId)
    await showGoalsMenu(wizard.getBot(), chatId, userId, state?.lang || "en")
    return true
  }

  const balances = await db.getBalancesList(userId)
  const balance = balances.find((b) => b.accountId === accountName)

  if (!balance) {
    await wizard.sendMessage(
      chatId,
      t(lang, "errors.accountNotFound", { account: accountName }),
      wizard.getBackButton(lang)
    )
    return true
  }

  if (balance.amount < amount) {
    await wizard.sendMessage(
      chatId,
      handleInsufficientFunds(
        lang,
        accountName,
        balance.amount,
        balance.currency,
        amount,
        goal.currency
      ),
      {
        reply_markup: {
          keyboard: [
            [{ text: t(state?.lang || "en", "transactions.goToBalances") }],
            [
              { text: t(state?.lang || "en", "goals.changeAmount") },
              { text: t(state?.lang || "en", "mainMenu.mainMenuButton") },
            ],
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
      result.message || t(lang, "common.error"),
      wizard.getBackButton(lang)
    )
    return true
  }

  await wizard.sendMessage(
    chatId,
    `✅ 🎯 Deposited ${formatMoney(amount, goal.currency)} to "${goal.name}" from ${accountName}!`
  )
  wizard.clearState(userId)
  await showGoalsMenu(wizard.getBot(), chatId, userId, state?.lang || "en")

  return true
}
