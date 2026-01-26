/**
 * Net worth formatting
 */

import { Balance, Debt } from "../../types"
import { dbStorage as db } from "../../database/storage-db"
import { formatMoney } from "../../utils"
import { convertBatchSync } from "../../fx"

/**
 * Formats net worth for a user
 * @param userId - User ID
 * @returns Formatted net worth string
 */
export async function formatNetWorth(userId: string): Promise<string> {
  const userData = await db.getUserData(userId)
  const balances = userData.balances
  const debts = userData.debts
  const defaultCurrency = userData.defaultCurrency

  if (balances.length === 0 && debts.length === 0) {
    return `Net Worth: 0 ${defaultCurrency}`
  }

  const balanceAmounts = balances.map((b: Balance) => ({
    amount: b.amount,
    from: b.currency,
    to: defaultCurrency,
  }))

  const convertedBalances =
    balanceAmounts.length > 0 ? convertBatchSync(balanceAmounts) : []

  const totalBalances = convertedBalances.reduce((sum, val) => sum + val, 0)

  const debtAmounts = debts.map((d: Debt) => ({
    amount: d.amount - d.paidAmount,
    from: d.currency,
    to: defaultCurrency,
  }))

  const convertedDebts =
    debtAmounts.length > 0 ? convertBatchSync(debtAmounts) : []

  let totalDebtsOwedToMe = 0
  let totalDebtsIOwe = 0

  debts.forEach((d: Debt, index: number) => {
    if (d.isPaid) return

    const debtValue = convertedDebts[index]
    if (d.type === "OWES_ME") {
      totalDebtsOwedToMe += debtValue!
    } else if (d.type === "I_OWE") {
      totalDebtsIOwe += debtValue!
    }
  })

  const netWorth = totalBalances + totalDebtsOwedToMe - totalDebtsIOwe

  const breakdown: string[] = []

  if (balances.length > 0) {
    breakdown.push("\n💳 *Balances:*")
    balances.forEach((b: Balance, index: number) => {
      const val = convertedBalances[index]
      if (Math.abs(val!) > 0.1) {
        if (b.currency === defaultCurrency) {
          breakdown.push(
            `  • ${b.accountId}: *${formatMoney(b.amount, b.currency)}*`
          )
        } else {
          breakdown.push(
            `  • ${b.accountId}: ${formatMoney(b.amount, b.currency)} _(≈${formatMoney(val!, defaultCurrency)})_`
          )
        }
      }
    })
    breakdown.push(`  ──────────────`)
    breakdown.push(
      `  💰 Total: *${formatMoney(totalBalances, defaultCurrency)}*`
    )
  }

  if (totalDebtsOwedToMe > 0) {
    breakdown.push(
      `\n📗 *They owe you:* +${formatMoney(totalDebtsOwedToMe, defaultCurrency)}`
    )
    debts.forEach((d: Debt, index: number) => {
      if (d.type === "OWES_ME" && !d.isPaid) {
        const val = convertedDebts[index]
        if (val! > 0.1) {
          const remaining = d.amount - d.paidAmount
          breakdown.push(
            `  • ${d?.counterparty}: ${formatMoney(remaining, d.currency)}`
          )
        }
      }
    })
  }

  if (totalDebtsIOwe > 0) {
    breakdown.push(
      `\n📕 *You owe:* -${formatMoney(totalDebtsIOwe, defaultCurrency)}`
    )
    debts.forEach((d: Debt, index: number) => {
      if (d.type === "I_OWE" && !d.isPaid) {
        const val = convertedDebts[index]
        if (val! > 0.1) {
          const remaining = d.amount - d.paidAmount
          breakdown.push(
            `  • ${d?.counterparty}: ${formatMoney(remaining, d.currency)}`
          )
        }
      }
    })
  }

  return `💎 *Net Worth:* \`${formatMoney(netWorth, defaultCurrency)}\n\`${breakdown.join("\n")}`
}
