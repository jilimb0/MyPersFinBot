/**
 * Transaction history formatting
 */

import { Transaction } from "../../types"
import { dbStorage as db } from "../../database/storage-db"
import { formatMoney } from "../../utils"
import { Language, t } from "../../i18n"
import {
  formatDate,
  getCategoryEmoji,
  getTransactionSign,
  getTransactionLabel,
  getTransactionAccount,
} from "../helpers"

/**
 * Formats a single transaction line
 * @param tx - Transaction object
 * @returns Formatted transaction string
 */
function formatTransactionLine(lang: Language, tx: Transaction): string {
  const date = new Date(tx.date)
  const dateStr = formatDate(date)
  const emoji = getCategoryEmoji(tx.category)
  const sign = getTransactionSign(tx.type)
  const account = getTransactionAccount(tx)
  const label = getTransactionLabel(lang, tx)

  return t(lang, "reports.transactions.line", {
    date: dateStr,
    emoji,
    label,
    sign,
    amount: formatMoney(tx.amount, tx.currency),
    account,
  })
}

/**
 * Formats transaction history for a user
 * @param userId - User ID
 * @param limit - Number of transactions to show (default: 10)
 * @returns Formatted transaction history string
 */
export async function formatTransactionHistory(
  userId: string,
  limit: number = 10
): Promise<string> {
  const lang = await db.getUserLanguage(userId)
  const transactions = await db.getTransactionHistory(userId, limit)

  if (transactions.length === 0) {
    return t(lang, "reports.transactions.empty")
  }

  const lines = transactions.map((tx) => formatTransactionLine(lang, tx))

  return `${t(lang, "reports.transactions.title")}\n\n${lines.join("\n")}`
}
