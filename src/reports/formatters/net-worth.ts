/**
 * Net worth formatting
 */

import { Balance, Debt } from "../../types"
import { dbStorage as db } from "../../database/storage-db"
import { formatMoney } from "../../utils"
import { convertBatchSync } from "../../fx"
import { t } from "../../i18n"

/**
 * Formats net worth for a user
 * @param userId - User ID
 * @returns Formatted net worth string
 */
export async function formatNetWorth(userId: string): Promise<string> {
  const lang = await db.getUserLanguage(userId)
  const userData = await db.getUserData(userId)
  const balances = userData.balances
  const debts = userData.debts
  const defaultCurrency = userData.defaultCurrency

  if (balances.length === 0 && debts.length === 0) {
    return t(lang, "reports.netWorth.empty", { currency: defaultCurrency })
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
    breakdown.push(`\n${t(lang, "reports.netWorth.balancesTitle")}`)
    balances.forEach((b: Balance, index: number) => {
      const val = convertedBalances[index]
      if (Math.abs(val!) > 0.1) {
        if (b.currency === defaultCurrency) {
          breakdown.push(
            t(lang, "reports.netWorth.balanceLine", {
              account: b.accountId,
              amount: formatMoney(b.amount, b.currency),
              approx: "",
            })
          )
        } else {
          breakdown.push(
            t(lang, "reports.netWorth.balanceLine", {
              account: b.accountId,
              amount: formatMoney(b.amount, b.currency),
              approx: t(lang, "reports.netWorth.approx", {
                amount: formatMoney(val!, defaultCurrency),
              }),
            })
          )
        }
      }
    })
    breakdown.push(`  ──────────────`)
    breakdown.push(
      t(lang, "reports.netWorth.totalBalances", {
        amount: formatMoney(totalBalances, defaultCurrency),
      })
    )
  }

  if (totalDebtsOwedToMe > 0) {
    breakdown.push(
      t(lang, "reports.netWorth.owedToMe", {
        amount: formatMoney(totalDebtsOwedToMe, defaultCurrency),
      })
    )
    debts.forEach((d: Debt, index: number) => {
      if (d.type === "OWES_ME" && !d.isPaid) {
        const val = convertedDebts[index]
        if (val! > 0.1) {
          const remaining = d.amount - d.paidAmount
          breakdown.push(
            t(lang, "reports.netWorth.debtLine", {
              counterparty: d?.counterparty,
              amount: formatMoney(remaining, d.currency),
            })
          )
        }
      }
    })
  }

  if (totalDebtsIOwe > 0) {
    breakdown.push(
      t(lang, "reports.netWorth.iOwe", {
        amount: formatMoney(totalDebtsIOwe, defaultCurrency),
      })
    )
    debts.forEach((d: Debt, index: number) => {
      if (d.type === "I_OWE" && !d.isPaid) {
        const val = convertedDebts[index]
        if (val! > 0.1) {
          const remaining = d.amount - d.paidAmount
          breakdown.push(
            t(lang, "reports.netWorth.debtLine", {
              counterparty: d?.counterparty,
              amount: formatMoney(remaining, d.currency),
            })
          )
        }
      }
    })
  }

  return `${t(lang, "reports.netWorth.title", {
    amount: formatMoney(netWorth, defaultCurrency),
  })}\n${breakdown.join("\n")}`
}
