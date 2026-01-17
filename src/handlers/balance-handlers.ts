import { dbStorage as db } from "../database/storage-db"
import * as validators from "../validators"
import { formatMoney } from "../utils"
import { Currency, Transaction } from "../types"
import { WizardManager } from "../wizards/wizards"
import { showBalancesMenu } from "../menus"
import { TransactionType, InternalCategory } from "../types"

/**
 * Обработка выбора баланса из списка
 * Текст вида: "Card (USD)"
 */
export async function handleBalanceSelection(
  wizard: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  // Парсим текст вида "Card (USD)"
  const match = text.match(/^(.+?)\s+\(([A-Z]{3})\)$/)
  if (!match) return false

  const accountId = match[1].trim()
  const currency = match[2] as Currency

  const balance = await db.getBalance(userId, accountId, currency)
  if (!balance) {
    await wizard.sendMessage(
      chatId,
      "❌ Balance not found.",
      wizard.getBackButton()
    )
    return true
  }

  // Переходим в режим редактирования баланса
  await wizard.goToStep(userId, "BALANCE_EDIT_MENU", {
    accountId,
    currency,
    currentAmount: balance.amount,
  })

  await wizard.sendMessage(
    chatId,
    `✏️ *${accountId}* (${currency})\n\n` +
    `Balance: ${formatMoney(balance.amount, currency)}\n\n` +
    `💡 *Quick edit:*\n` +
    `• Enter number → update amount\n` +
    `• Enter text → rename account`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        keyboard: [
          [{ text: "🅰️ Set to Zero" }],
          [{ text: "🗑️ Delete Balance" }],
          [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
        ],
        resize_keyboard: true,
      },
    }
  )

  return true
}

/**
 * Умный парсер для редактирования баланса
 * Распознаёт числа (смена суммы) и текст (переименование)
 */
export async function handleBalanceEditMenu(
  wizard: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const state = wizard.getState(userId)
  if (!state?.data) return false

  const { accountId, currency, currentAmount } = state.data

  // Кнопки
  if (text === "🅰️ Set to Zero") {
    const balances = await db.getBalancesList(userId)
    const hasOtherBalances = balances.some(
      (b) => !(b.accountId === accountId && b.currency === currency)
    )

    await wizard.goToStep(userId, "BALANCE_SET_ZERO_CONFIRM", {
      accountId,
      currency,
      amount: currentAmount,
      hasOtherBalances,
    })

    const keyboard = []

    if (currentAmount > 0 && hasOtherBalances) {
      keyboard.push([{ text: "🔄 Transfer to another account" }])
    }

    keyboard.push(
      [{ text: "✅ Yes, Set to Zero" }],
      [{ text: "❌ No, Cancel" }],
      [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }]
    )

    const msg =
      currentAmount > 0
        ? `⚠️ Set ${accountId} to 0 ${currency}?\n\n` +
        `Current: ${formatMoney(currentAmount, currency)}\n\n` +
        (hasOtherBalances
          ? `You can transfer ${formatMoney(currentAmount, currency)} to another account first.`
          : `Balance will be cleared.`)
        : `⚠️ ${accountId} already has 0 ${currency}.`

    await wizard.sendMessage(chatId, msg, {
      reply_markup: {
        keyboard,
        resize_keyboard: true,
      },
    })
    return true
  }

  if (text === "🗑️ Delete Balance") {
    const balances = await db.getBalancesList(userId)
    const hasOtherBalances = balances.some(
      (b) => !(b.accountId === accountId && b.currency === currency)
    )

    await wizard.goToStep(userId, "BALANCE_DELETE_CONFIRM", {
      accountId,
      currency,
      amount: currentAmount,
      hasOtherBalances,
    })

    const keyboard = []

    if (currentAmount > 0 && hasOtherBalances) {
      keyboard.push([{ text: "🔄 Transfer to another account" }])
    }

    keyboard.push(
      [{ text: "✅ Yes, Delete Balance" }],
      [{ text: "❌ No, Cancel" }],
      [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }]
    )

    const msg =
      currentAmount > 0
        ? `⚠️ Delete ${accountId}?\n\n` +
        `Current balance: ${formatMoney(currentAmount, currency)}\n\n` +
        (hasOtherBalances
          ? `⚡️ Transfer to another account before deleting, or clear ${formatMoney(currentAmount, currency)}.`
          : `${formatMoney(currentAmount, currency)} will be cleared.`)
        : `⚠️ Delete ${accountId}?`

    await wizard.sendMessage(chatId, msg, {
      reply_markup: {
        keyboard,
        resize_keyboard: true,
      },
    })
    return true
  }

  // ✨ УМНЫЙ ПАРСЕР
  const trimmed = text.trim()

  // 1️⃣ Пробуем распарсить как ЧИСЛО
  const parsed = validators.parseAmountWithCurrency(trimmed, currency)

  if (parsed && parsed.amount > 0) {
    // ЭТО ЧИСЛО → меняем сумму
    await wizard.goToStep(userId, "BALANCE_CONFIRM_AMOUNT", {
      accountId,
      currency,
      newAmount: parsed.amount,
      currentAmount,
    })

    await wizard.sendMessage(
      chatId,
      `💰 *Confirm Amount Change*\n\n` +
      `Current: ${formatMoney(currentAmount, currency)}\n` +
      `New: ${formatMoney(parsed.amount, currency)}\n\n` +
      `✅ Yes / ❌ No?`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          keyboard: [
            [{ text: "✅ Yes" }],
            [{ text: "❌ No" }],
            [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
          ],
          resize_keyboard: true,
        },
      }
    )
    return true
  }

  // 2️⃣ Если не число, но содержит буквы → меняем имя
  if (/[a-zA-Zа-яА-ЯёЁ]/.test(trimmed) && trimmed.length > 0) {
    const newName = trimmed

    // Проверка на дубликат
    const balances = await db.getBalancesList(userId)
    const duplicate = balances.find(
      (b) =>
        b.accountId === newName &&
        !(b.accountId === accountId && b.currency === currency)
    )

    if (duplicate) {
      await wizard.sendMessage(
        chatId,
        `❌ Balance "${newName}" already exists.\n\nTry a different name.`,
        wizard.getBackButton()
      )
      return true
    }

    // Подтверждение переименования
    await wizard.goToStep(userId, "BALANCE_CONFIRM_RENAME", {
      accountId,
      currency,
      currentAmount,
      newName,
    })

    await wizard.sendMessage(
      chatId,
      `✏️ *Confirm Rename*\n\n` +
      `Old: "${accountId}"\n` +
      `New: "${newName}"\n\n` +
      `✅ Yes / ❌ No?`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          keyboard: [
            [{ text: "✅ Yes" }],
            [{ text: "❌ No" }],
            [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
          ],
          resize_keyboard: true,
        },
      }
    )
    return true
  }

  // 3️⃣ Ничего не подошло
  await wizard.sendMessage(
    chatId,
    "❌ Invalid input.\n\n" +
    "• Enter *number* to change amount (e.g., 500)\n" +
    "• Enter *text* to rename (e.g., MyCard)",
    { parse_mode: "Markdown", ...wizard.getBackButton() }
  )
  return true
}

/**
 * Подтверждение изменения суммы
 */
export async function handleBalanceConfirmAmount(
  wizard: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const state = wizard.getState(userId)
  if (!state?.data) return false

  const { accountId, currency, newAmount } = state.data

  if (text === "✅ Yes") {
    await db.safeUpdateBalance(userId, accountId, newAmount, currency)
    await wizard.sendMessage(
      chatId,
      `✅ ${accountId} updated to ${formatMoney(newAmount, currency)}`
    )
    await wizard.goToStep(userId, "BALANCE_LIST", {})
    await showBalancesMenu(wizard, chatId, userId)
    return true
  }

  if (text === "❌ No") {
    await wizard.goToStep(userId, "BALANCE_EDIT_MENU", {
      accountId,
      currency,
      currentAmount: state.data.currentAmount,
    })

    await wizard.sendMessage(
      chatId,
      `✏️ *${accountId}* (${currency})\n\n` +
      `Balance: ${formatMoney(state.data.currentAmount, currency)}\n\n` +
      `💡 *Quick edit:*\n` +
      `• Number → update amount\n` +
      `• Text → rename account`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          keyboard: [
            [{ text: "🅰️ Set to Zero" }],
            [{ text: "🗑️ Delete Balance" }],
            [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
          ],
          resize_keyboard: true,
        },
      }
    )
    return true
  }

  await wizard.sendMessage(
    chatId,
    "✅ Yes / ❌ No",
    wizard.getBackButton()
  )
  return true
}

/**
 * Подтверждение переименования
 */
export async function handleBalanceConfirmRename(
  wizard: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const state = wizard.getState(userId)
  if (!state?.data) return false

  const { accountId, currency, newName, currentAmount } = state.data

  if (text === "✅ Yes") {
    await db.renameBalance(userId, accountId, currency, newName)

    await wizard.sendMessage(
      chatId,
      `✅ Balance renamed from "${accountId}" to "${newName}"`
    )

    await wizard.goToStep(userId, "BALANCE_LIST", {})
    await showBalancesMenu(wizard, chatId, userId)
    return true
  }

  if (text === "❌ No") {
    await wizard.goToStep(userId, "BALANCE_EDIT_MENU", {
      accountId,
      currency,
      currentAmount,
    })

    await wizard.sendMessage(
      chatId,
      `✏️ *${accountId}* (${currency})\n\n` +
      `Balance: ${formatMoney(currentAmount, currency)}\n\n` +
      `💡 *Quick edit:*\n` +
      `• Number → update amount\n` +
      `• Text → rename account`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          keyboard: [
            [{ text: "🅰️ Set to Zero" }],
            [{ text: "🗑️ Delete Balance" }],
            [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
          ],
          resize_keyboard: true,
        },
      }
    )
    return true
  }

  return false
}

/**
 * Подтверждение обнуления баланса
 */
export async function handleBalanceSetToZero(
  wizard: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const state = wizard.getState(userId)
  if (!state?.data) return false

  const { accountId, currency, amount, hasOtherBalances } = state.data

  if (text === "✅ Yes, Set to Zero") {
    await db.convertBalanceAmount(userId, accountId, currency, 0)
    await wizard.sendMessage(
      chatId,
      `✅ Balance ${accountId} set to 0 ${currency}!`
    )
    wizard.clearState(userId)
    await showBalancesMenu(wizard, chatId, userId)
    return true
  }

  if (text === "🔄 Transfer to another account" && hasOtherBalances) {
    await wizard.goToStep(userId, "BALANCE_ZERO_SELECT_TARGET", {
      accountId,
      currency,
      amount,
    })

    const balanceList = await db.getBalancesList(userId)
    const otherBalances = balanceList.filter(
      (b) => !(b.accountId === accountId && b.currency === currency)
    )

    const rows = otherBalances.map((b) => [{
      text: `${b.accountId} ${b.currency}`,
    }])
    rows.push([{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }])

    await wizard.sendMessage(
      chatId,
      `🔄 Transfer ${formatMoney(amount, currency)} to:`,
      {
        reply_markup: {
          keyboard: rows,
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      }
    )
    return true
  }

  if (text === "❌ No, Cancel") {
    await wizard.goToStep(userId, "BALANCE_EDIT_MENU", {
      accountId,
      currency,
      currentAmount: amount,
    })

    await wizard.sendMessage(
      chatId,
      `✏️ *${accountId}* (${currency})\n\n` +
      `Balance: ${formatMoney(amount, currency)}\n\n` +
      `💡 *Quick edit:*\n` +
      `• Number → update amount\n` +
      `• Text → rename account`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          keyboard: [
            [{ text: "🅰️ Set to Zero" }],
            [{ text: "🗑️ Delete Balance" }],
            [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
          ],
          resize_keyboard: true,
        },
      }
    )
    return true
  }

  return false
}

/**
 * Подтверждение удаления баланса
 */
export async function handleBalanceDelete(
  wizard: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const state = wizard.getState(userId)
  if (!state?.data) return false

  const { accountId, currency, amount, hasOtherBalances } = state.data

  if (text === "✅ Yes, Delete Balance") {
    await db.deleteBalance(userId, accountId, currency)
    const msg =
      amount > 0
        ? `🗑️ Balance ${accountId} deleted and ${formatMoney(amount, currency)} cleared.`
        : `🗑️ Balance ${accountId} deleted.`

    await wizard.sendMessage(chatId, msg)
    wizard.clearState(userId)
    await showBalancesMenu(wizard, chatId, userId)
    return true
  }

  if (text === "🔄 Transfer to another account" && hasOtherBalances) {
    await wizard.goToStep(userId, "BALANCE_DELETE_SELECT_TARGET", {
      accountId,
      currency,
      amount,
    })

    const balanceList = await db.getBalancesList(userId)
    const otherBalances = balanceList.filter(
      (b) => !(b.accountId === accountId && b.currency === currency)
    )

    const rows = otherBalances.map((b) => [{
      text: `${b.accountId} ${b.currency}`,
    }])
    rows.push([{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }])

    await wizard.sendMessage(
      chatId,
      `🔄 Transfer ${formatMoney(amount, currency)} to:`,
      {
        reply_markup: {
          keyboard: rows,
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      }
    )
    return true
  }

  if (text === "❌ No, Cancel") {
    await wizard.goToStep(userId, "BALANCE_EDIT_MENU", {
      accountId,
      currency,
      currentAmount: amount,
    })

    await wizard.sendMessage(
      chatId,
      `✏️ *${accountId}* (${currency})\n\n` +
      `Balance: ${formatMoney(amount, currency)}\n\n` +
      `💡 *Quick edit:*\n` +
      `• Number → update amount\n` +
      `• Text → rename account`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          keyboard: [
            [{ text: "🅰️ Set to Zero" }],
            [{ text: "🗑️ Delete Balance" }],
            [{ text: "⬅️ Back" }, { text: "🏠 Main Menu" }],
          ],
          resize_keyboard: true,
        },
      }
    )
    return true
  }

  return false
}

/**
 * Выбор целевого счета для трансфера при удалении баланса
 */
export async function handleBalanceDeleteSelectTarget(
  wizard: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const state = wizard.getState(userId)
  if (!state?.data) return false

  const match = text.match(/^(.+?)\s+([A-Z]{3})$/)
  if (!match) {
    await wizard.sendMessage(
      chatId,
      "❌ Select a balance from buttons.",
      wizard.getBackButton()
    )
    return true
  }

  const targetAccountId = match[1].trim()
  const targetCurrency = match[2] as Currency

  const { accountId, currency, amount } = state.data

  // Создаём транзакцию трансфера
  const transaction: Transaction = {
    id: Date.now().toString(),
    date: new Date(),
    amount,
    currency,
    type: TransactionType.TRANSFER,
    category: InternalCategory.TRANSFER,
    description: `Transfer before deleting ${accountId}`,
    fromAccountId: accountId,
    toAccountId: targetAccountId,
  }

  await db.addTransaction(userId, transaction)

  // Списываем с исходного счёта
  await db.safeUpdateBalance(userId, accountId, -amount, currency)
  // Зачисляем на целевой счёт
  await db.safeUpdateBalance(userId, targetAccountId, amount, targetCurrency)

  // Удаляем исходный баланс
  await db.deleteBalance(userId, accountId, currency)

  await wizard.sendMessage(
    chatId,
    `✅ Transferred ${formatMoney(amount, currency)} to ${targetAccountId} and deleted ${accountId}.`
  )

  wizard.clearState(userId)
  await showBalancesMenu(wizard, chatId, userId)
  return true
}

/**
 * Выбор целевого счета для трансфера при обнулении баланса
 */
export async function handleBalanceZeroSelectTarget(
  wizard: WizardManager,
  chatId: number,
  userId: string,
  text: string
): Promise<boolean> {
  const state = wizard.getState(userId)
  if (!state?.data) return false

  const match = text.match(/^(.+?)\s+([A-Z]{3})$/)
  if (!match) {
    await wizard.sendMessage(
      chatId,
      "❌ Select a balance from buttons.",
      wizard.getBackButton()
    )
    return true
  }

  const targetAccountId = match[1].trim()
  const targetCurrency = match[2] as Currency

  const { accountId, currency, amount } = state.data

  // Создаём транзакцию трансфера
  const transaction: Transaction = {
    id: Date.now().toString(),
    date: new Date(),
    amount,
    currency,
    type: TransactionType.TRANSFER,
    category: InternalCategory.TRANSFER,
    description: `Transfer before zeroing ${accountId}`,
    fromAccountId: accountId,
    toAccountId: targetAccountId,
  }

  await db.addTransaction(userId, transaction)

  // Списываем с исходного счёта и обнуляем
  await db.convertBalanceAmount(userId, accountId, currency, 0)
  // Зачисляем на целевой счёт
  await db.safeUpdateBalance(userId, targetAccountId, amount, targetCurrency)

  const msg = `✅ Transferred ${formatMoney(amount, currency)} to ${targetAccountId}!\n\n` +
    `Balance ${accountId} set to 0 ${currency}.`

  await wizard.sendMessage(chatId, msg)

  wizard.clearState(userId)
  await showBalancesMenu(wizard, chatId, userId)
  return true
}
