import { randomUUID } from "node:crypto"
import type TelegramBot from "node-telegram-bot-api"
import type { Balance } from "../database/entities/Balance"
import { dbStorage as db } from "../database/storage-db"
import { type Language, resolveLanguage, t } from "../i18n"
import { showBalancesMenu } from "../menus-i18n"
import {
  type Currency,
  InternalCategory,
  type Transaction,
  TransactionType,
} from "../types"
import { escapeMarkdown, formatMoney } from "../utils"
import * as validators from "../validators"
import type { WizardManager } from "../wizards/wizards"

/**
 * Handle one-step balance creation like goals and debts
 * Format: "AccountName amount CURRENCY" or "AccountName amount"
 * Examples: "Cash 1000 USD", "Bank Card 500"
 */
export async function handleBalanceCreate(
  wizard: WizardManager,
  chatId: number,
  userId: string,
  text: string,
  lang: Language
): Promise<boolean> {
  const defaultCurrency = await db.getDefaultCurrency(userId)
  const parsed = validators.parseBalanceInput(text)

  if (!parsed) {
    // Try without explicit currency
    const match = text.match(/^(.+?)\s+([0-9]+(?:\.[0-9]{1,2})?)$/)
    if (match) {
      if (!match[1] || !match[2]) {
        await wizard.sendMessage(chatId, t(lang, "balances.invalidFormatShort"))
        return true
      }
      const accountId = match[1].trim()
      const amount = parseFloat(match[2])

      if (accountId && !Number.isNaN(amount) && amount >= 0) {
        // Valid input without currency
        const existing = await db.getBalance(userId, accountId, defaultCurrency)

        if (existing) {
          await wizard.sendMessage(
            chatId,
            t(lang, "balances.alreadyExistsMessage", {
              accountId,
              currency: defaultCurrency,
              amount: formatMoney(existing.amount, defaultCurrency),
            }),
            {
              parse_mode: "Markdown",
              ...wizard.getBackButton(lang),
            }
          )
          return true
        }

        await db.addBalance(userId, {
          accountId,
          amount,
          currency: defaultCurrency,
          lastUpdated: new Date().toISOString(),
        })

        await wizard.sendMessage(
          chatId,
          t(lang, "balances.createdWithAmount", {
            accountId,
            amount: formatMoney(amount, defaultCurrency),
          }),
          { parse_mode: "Markdown" }
        )

        wizard.clearState(userId)
        await showBalancesMenu(wizard, chatId, userId, lang)
        return true
      }
    }

    // ✅ Check if user entered just account name (no amount)
    const justName = text.trim()
    if (justName && !justName.match(/[0-9]/)) {
      // Valid account name without numbers
      const existing = await db.getBalance(userId, justName, defaultCurrency)

      if (existing) {
        await wizard.sendMessage(
          chatId,
          t(lang, "balances.alreadyExistsMessage", {
            accountId: justName,
            currency: defaultCurrency,
            amount: formatMoney(existing.amount, defaultCurrency),
          }),
          {
            parse_mode: "Markdown",
            ...wizard.getBackButton(lang),
          }
        )
        return true
      }

      await db.addBalance(userId, {
        accountId: justName,
        amount: 0,
        currency: defaultCurrency,
        lastUpdated: new Date().toISOString(),
      })

      await wizard.sendMessage(
        chatId,
        t(lang, "balances.createdWithAmount", {
          accountId: justName,
          amount: formatMoney(0, defaultCurrency),
        }),
        { parse_mode: "Markdown" }
      )

      wizard.clearState(userId)
      await showBalancesMenu(wizard, chatId, userId, lang)
      return true
    }

    await wizard.sendMessage(
      chatId,
      validators.getValidationErrorMessage(lang, "balance"),
      wizard.getBackButton(lang)
    )
    return true
  }

  // Check for duplicate
  const existing = await db.getBalance(
    userId,
    parsed.accountId,
    parsed.currency
  )

  if (existing) {
    await wizard.sendMessage(
      chatId,
      t(lang, "balances.alreadyExistsMessage", {
        accountId: parsed.accountId,
        currency: parsed.currency,
        amount: formatMoney(existing.amount, parsed.currency),
      }),
      {
        parse_mode: "Markdown",
        ...wizard.getBackButton(lang),
      }
    )
    return true
  }

  await db.addBalance(userId, parsed as Balance)

  await wizard.sendMessage(
    chatId,
    t(lang, "balances.createdWithAmount", {
      accountId: parsed.accountId,
      amount: formatMoney(parsed.amount, parsed.currency),
    }),
    { parse_mode: "Markdown" }
  )

  wizard.clearState(userId)
  await showBalancesMenu(wizard, chatId, userId, lang)
  return true
}

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
  // Get state and lang
  const state = wizard.getState(userId)
  if (!state) return false
  const lang = resolveLanguage(state?.lang)

  // Парсим текст вида "Card (USD)"
  const match = text.match(/^(.+?)\s+\(([A-Z]{3})\)$/)
  if (!match) return false
  if (!match[1] || !match[2]) return false

  const accountId = match[1].trim()
  const currency = match[2] as Currency

  const balance = await db.getBalance(userId, accountId, currency)
  if (!balance) {
    await wizard.sendMessage(
      chatId,
      t(lang, "errors.notFound"),
      wizard.getBackButton(lang)
    )
    return true
  }

  // Переходим в режим редактирования баланса
  await wizard.goToStep(userId, "BALANCE_EDIT_MENU", {
    accountId,
    currency,
    currentAmount: balance.amount,
  })

  const keyboard: TelegramBot.KeyboardButton[][] = []

  if (balance.amount > 0) {
    keyboard.push([{ text: t(lang, "balances.setToZero") }])
  }

  keyboard.push(
    [{ text: t(lang, "common.delete") }],
    [
      { text: t(lang, "common.back") },
      { text: t(lang, "mainMenu.mainMenuButton") },
    ]
  )

  await wizard.sendMessage(
    chatId,
    `${t(lang, "balances.editTitle", {
      accountId: escapeMarkdown(accountId),
      currency,
    })}\n\n` +
      `${t(lang, "balances.balanceLine", {
        amount: formatMoney(balance.amount, currency),
      })}\n\n` +
      `${t(lang, "balances.quickEditTitle")}\n` +
      `${t(lang, "balances.quickEditNumber")}\n` +
      `${t(lang, "balances.quickEditText")}`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        keyboard,
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
  // Get state and lang
  const state = wizard.getState(userId)
  if (!state) return false
  const lang = resolveLanguage(state?.lang)

  if (!state.data) return true
  const { accountId, currency, currentAmount } = state.data

  // Back button - just redraw menu
  if (text === t(lang, "common.back")) {
    wizard.clearState(userId)
    await showBalancesMenu(wizard, chatId, userId, lang)
    return true
  }

  // Кнопки (проверяем БЕЗ эмодзи, так как они могут не передаваться)
  if (
    text === t(lang, "balances.setToZero") ||
    text === t(lang, "balances.setToZero")
  ) {
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
      keyboard.push([{ text: t(lang, "balances.transferToAnother") }])
    }

    keyboard.push(
      [{ text: t(lang, "common.yesSetToZero") }],
      [
        { text: t(lang, "common.back") },
        { text: t(lang, "mainMenu.mainMenuButton") },
      ]
    )

    const msg =
      t(lang, "balances.setToZeroConfirm", {
        accountId: escapeMarkdown(accountId),
        currency,
      }) +
      "\n\n" +
      `${t(lang, "balances.currentLine", {
        amount: formatMoney(currentAmount, currency),
      })}\n\n` +
      (hasOtherBalances
        ? t(lang, "balances.canTransferFirst", {
            amount: formatMoney(currentAmount, currency),
          })
        : t(lang, "balances.willBeCleared"))

    await wizard.sendMessage(chatId, msg, {
      reply_markup: {
        keyboard,
        resize_keyboard: true,
      },
    })
    return true
  }

  if (text === t(lang, "common.delete") || text === t(lang, "common.delete")) {
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
      keyboard.push([{ text: t(lang, "balances.transferToAnother") }])
    }

    keyboard.push(
      [{ text: t(lang, "balances.yesDelete") }],
      [
        { text: t(lang, "common.back") },
        { text: t(lang, "mainMenu.mainMenuButton") },
      ]
    )

    const msg =
      t(lang, "balances.deleteConfirmTitle", {
        accountId: escapeMarkdown(accountId),
      }) +
      (currentAmount > 0
        ? `\n\n${t(lang, "balances.currentBalanceLine", {
            amount: formatMoney(currentAmount, currency),
          })}\n\n` +
          (hasOtherBalances
            ? t(lang, "balances.deleteTransferHint", {
                amount: formatMoney(currentAmount, currency),
              })
            : t(lang, "balances.deleteClearHint", {
                amount: formatMoney(currentAmount, currency),
              }))
        : "")

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
      `${t(lang, "balances.confirmAmountTitle")}\n\n` +
        `${t(lang, "balances.currentLine", {
          amount: formatMoney(currentAmount, currency),
        })}\n` +
        `${t(lang, "balances.newLine", {
          amount: formatMoney(parsed.amount, currency),
        })}\n\n` +
        `${t(lang, "balances.confirmYesNo")}`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          keyboard: [
            [{ text: t(lang, "common.yes") }],
            [{ text: t(lang, "common.no") }],
            [
              { text: t(lang, "common.back") },
              { text: t(lang, "mainMenu.mainMenuButton") },
            ],
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
        t(lang, "balances.renameDuplicate", { name: escapeMarkdown(newName) }),
        wizard.getBackButton(lang)
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
      `${t(lang, "balances.confirmRenameTitle")}\n\n` +
        `${t(lang, "balances.confirmRenameOld", {
          name: escapeMarkdown(accountId),
        })}\n` +
        `${t(lang, "balances.confirmRenameNew", {
          name: escapeMarkdown(newName),
        })}\n\n` +
        `${t(lang, "balances.confirmYesNo")}`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          keyboard: [
            [{ text: t(lang, "common.yes") }],
            [{ text: t(lang, "common.no") }],
            [
              { text: t(lang, "common.back") },
              { text: t(lang, "mainMenu.mainMenuButton") },
            ],
          ],
          resize_keyboard: true,
        },
      }
    )
    return true
  }

  // 3️⃣ Ничего не подошло
  await wizard.sendMessage(chatId, t(lang, "balances.invalidInput"), {
    parse_mode: "Markdown",
    ...wizard.getBackButton(lang),
  })
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
  // Get state and lang
  const state = wizard.getState(userId)
  if (!state) return false
  const lang = resolveLanguage(state?.lang)

  if (!state.data) return true
  const { accountId, currency, newAmount, currentAmount } = state.data

  if (text === t(lang, "common.yes")) {
    await db.safeUpdateBalance(userId, accountId, newAmount, currency)
    await wizard.goToStep(userId, "BALANCE_LIST", {})
    await showBalancesMenu(wizard, chatId, userId, lang)
    return true
  }

  if (text === t(lang, "common.no")) {
    await wizard.goToStep(userId, "BALANCE_EDIT_MENU", {
      accountId,
      currency,
      currentAmount: state?.data?.currentAmount,
    })

    await wizard.sendMessage(
      chatId,
      `${t(lang, "balances.editTitle", {
        accountId: escapeMarkdown(accountId),
        currency,
      })}\n\n` +
        `${t(lang, "balances.balanceLine", {
          amount: formatMoney(state?.data?.currentAmount, currency),
        })}\n\n` +
        `${t(lang, "balances.quickEditTitle")}\n` +
        `${t(lang, "balances.quickEditNumber")}\n` +
        `${t(lang, "balances.quickEditText")}`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          keyboard: [
            [{ text: t(lang, "balances.setToZero") }],
            [{ text: t(lang, "common.delete") }],
            [
              { text: t(lang, "common.back") },
              { text: t(lang, "mainMenu.mainMenuButton") },
            ],
          ],
          resize_keyboard: true,
        },
      }
    )
    return true
  }

  // Fallback: любой другой ввод - возврат к редактированию
  await wizard.goToStep(userId, "BALANCE_EDIT_MENU", {
    accountId,
    currency,
    currentAmount,
  })

  // Формируем кнопки в зависимости от баланса
  const keyboard: TelegramBot.KeyboardButton[][] = []
  if (currentAmount > 0) {
    keyboard.push([{ text: t(lang, "balances.setToZero") }])
  }
  keyboard.push(
    [{ text: t(lang, "common.delete") }],
    [
      { text: t(lang, "common.back") },
      { text: t(lang, "mainMenu.mainMenuButton") },
    ]
  )

  await wizard.sendMessage(
    chatId,
    `${t(lang, "balances.editTitle", {
      accountId: escapeMarkdown(accountId),
      currency,
    })}\n\n` +
      `${t(lang, "balances.balanceLine", {
        amount: formatMoney(currentAmount, currency),
      })}\n\n` +
      `${t(lang, "balances.quickEditTitle")}\n` +
      `${t(lang, "balances.quickEditNumber")}\n` +
      `${t(lang, "balances.quickEditText")}`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        keyboard,
        resize_keyboard: true,
      },
    }
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
  // Get state and lang
  const state = wizard.getState(userId)
  if (!state) return false
  const lang = resolveLanguage(state?.lang)

  if (!state.data) return true
  const { accountId, currency, newName, currentAmount } = state.data

  if (text === t(lang, "common.yes")) {
    await db.renameBalance(userId, accountId, currency, newName)

    await wizard.goToStep(userId, "BALANCE_LIST", {})
    await showBalancesMenu(wizard, chatId, userId, lang)
    return true
  }

  if (text === t(lang, "common.no")) {
    await wizard.goToStep(userId, "BALANCE_EDIT_MENU", {
      accountId,
      currency,
      currentAmount,
    })

    await wizard.sendMessage(
      chatId,
      `${t(lang, "balances.editTitle", {
        accountId: escapeMarkdown(accountId),
        currency,
      })}\n\n` +
        `${t(lang, "balances.balanceLine", {
          amount: formatMoney(currentAmount, currency),
        })}\n\n` +
        `${t(lang, "balances.quickEditTitle")}\n` +
        `${t(lang, "balances.quickEditNumber")}\n` +
        `${t(lang, "balances.quickEditText")}`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          keyboard: [
            [{ text: t(lang, "balances.setToZero") }],
            [{ text: t(lang, "common.delete") }],
            [
              { text: t(lang, "common.back") },
              { text: t(lang, "mainMenu.mainMenuButton") },
            ],
          ],
          resize_keyboard: true,
        },
      }
    )
    return true
  }

  await wizard.goToStep(userId, "BALANCE_EDIT_MENU", {
    accountId,
    currency,
    currentAmount,
  })

  // Формируем кнопки в зависимости от баланса
  const keyboard: TelegramBot.KeyboardButton[][] = []
  if (currentAmount > 0) {
    keyboard.push([{ text: t(lang, "balances.setToZero") }])
  }
  keyboard.push(
    [{ text: t(lang, "common.delete") }],
    [
      { text: t(lang, "common.back") },
      { text: t(lang, "mainMenu.mainMenuButton") },
    ]
  )

  await wizard.sendMessage(
    chatId,
    `${t(lang, "balances.editTitle", {
      accountId: escapeMarkdown(accountId),
      currency,
    })}\n\n` +
      `${t(lang, "balances.balanceLine", {
        amount: formatMoney(currentAmount, currency),
      })}\n\n` +
      `${t(lang, "balances.quickEditTitle")}\n` +
      `${t(lang, "balances.quickEditNumber")}\n` +
      `${t(lang, "balances.quickEditText")}`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        keyboard,
        resize_keyboard: true,
      },
    }
  )
  return true
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

  const lang = resolveLanguage(state?.lang)

  const { accountId, currency, amount, hasOtherBalances } = state.data

  if (text === t(lang, "common.yesSetToZero")) {
    await db.convertBalanceAmount(userId, accountId, currency, 0)
    wizard.clearState(userId)
    await showBalancesMenu(wizard, chatId, userId, lang)
    return true
  }

  if (text === t(lang, "balances.transferToAnother") && hasOtherBalances) {
    await wizard.goToStep(userId, "BALANCE_ZERO_SELECT_TARGET", {
      accountId,
      currency,
      amount,
    })

    const balanceList = await db.getBalancesList(userId)
    const otherBalances = balanceList.filter(
      (b) => !(b.accountId === accountId && b.currency === currency)
    )

    const rows = otherBalances.map((b) => [
      {
        text: `${b.accountId} ${b.currency}`,
      },
    ])
    rows.push([
      { text: t(lang, "common.back") },
      { text: t(lang, "mainMenu.mainMenuButton") },
    ])

    await wizard.sendMessage(
      chatId,
      t(lang, "balances.transferToPrompt", {
        amount: formatMoney(amount, currency),
      }),
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

  // Fallback: любой другой ввод (включая Back) - возврат к редактированию
  wizard.clearState(userId)
  await showBalancesMenu(wizard, chatId, userId, lang)
  return true
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
  const lang = resolveLanguage(state?.lang)

  const { accountId, currency, amount, hasOtherBalances } = state.data

  if (text === t(lang, "balances.yesDelete")) {
    await db.deleteBalance(userId, accountId, currency)
    wizard.clearState(userId)
    await showBalancesMenu(wizard, chatId, userId, lang)
    return true
  }

  if (text === t(lang, "balances.transferToAnother") && hasOtherBalances) {
    await wizard.goToStep(userId, "BALANCE_DELETE_SELECT_TARGET", {
      accountId,
      currency,
      amount,
    })

    const balanceList = await db.getBalancesList(userId)
    const otherBalances = balanceList.filter(
      (b) => !(b.accountId === accountId && b.currency === currency)
    )

    const rows = otherBalances.map((b) => [
      {
        text: `${b.accountId} ${b.currency}`,
      },
    ])
    rows.push([
      { text: t(lang, "common.back") },
      { text: t(lang, "mainMenu.mainMenuButton") },
    ])

    await wizard.sendMessage(
      chatId,
      t(lang, "balances.transferToPrompt", {
        amount: formatMoney(amount, currency),
      }),
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

  // Fallback: любой другой ввод (включая Back) - возврат к редактированию
  wizard.clearState(userId)
  await showBalancesMenu(wizard, chatId, userId, lang)
  return true
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
  const lang = resolveLanguage(state?.lang)

  const match = text.match(/^(.+?)\s+([A-Z]{3})$/)
  if (!match) {
    await wizard.sendMessage(
      chatId,
      t(lang, "balances.selectFromButtons"),
      wizard.getBackButton(lang)
    )
    return true
  }

  if (!match[1] || !match[2]) return true
  if (!match[1]) return false
  const targetAccountId = match[1].trim()
  const targetCurrency = match[2] as Currency

  const { accountId, currency, amount } = state.data

  // Создаём транзакцию трансфера
  const transaction: Transaction = {
    id: randomUUID(),
    date: new Date(),
    amount,
    currency,
    type: TransactionType.TRANSFER,
    category: InternalCategory.TRANSFER,
    description: t(lang, "balances.transferDescDelete", { accountId }),
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

  wizard.clearState(userId)
  await showBalancesMenu(wizard, chatId, userId, lang)
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
  const lang = resolveLanguage(state?.lang)

  const match = text.match(/^(.+?)\s+([A-Z]{3})$/)
  if (!match) {
    await wizard.sendMessage(
      chatId,
      t(lang, "balances.selectFromButtons"),
      wizard.getBackButton(lang)
    )
    return true
  }

  if (!match[1]) return false
  const targetAccountId = match[1].trim()
  const targetCurrency = match[2] as Currency

  const { accountId, currency, amount } = state.data

  // Создаём транзакцию трансфера
  const transaction: Transaction = {
    id: randomUUID(),
    date: new Date(),
    amount,
    currency,
    type: TransactionType.TRANSFER,
    category: InternalCategory.TRANSFER,
    description: t(lang, "balances.transferDescZero", { accountId }),
    fromAccountId: accountId,
    toAccountId: targetAccountId,
  }

  await db.addTransaction(userId, transaction)

  // Списываем с исходного счёта и обнуляем
  await db.convertBalanceAmount(userId, accountId, currency, 0)
  // Зачисляем на целевой счёт
  await db.safeUpdateBalance(userId, targetAccountId, amount, targetCurrency)

  wizard.clearState(userId)
  await showBalancesMenu(wizard, chatId, userId, lang)
  return true
}
