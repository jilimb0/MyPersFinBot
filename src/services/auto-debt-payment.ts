/**
 * Auto-Debt Payment Manager
 * Handles automatic debt payments
 */

import { randomUUID } from "node:crypto"
import type { BotClient } from "@jilimb0/tgwrapper"
import { AppDataSource } from "../database/data-source"
import { Debt as DebtEntity } from "../database/entities/Debt"
import { Transaction as TransactionEntity } from "../database/entities/Transaction"
import { dbStorage as db } from "../database/storage-db"
import { InternalCategory, TransactionType } from "../types"
import { escapeMarkdown, formatMoney } from "../utils"

class AutoDebtPaymentManager {
  /**
   * Get all debts with active auto-payment that are due today
   */
  async getDueAutoPayments(): Promise<DebtEntity[]> {
    const debtRepo = AppDataSource.getRepository(DebtEntity)

    const debts = await debtRepo
      .createQueryBuilder("debt")
      .where("debt.isPaid = :isPaid", { isPaid: false })
      .andWhere("debt.autoPayment IS NOT NULL")
      .getMany()

    const today = new Date()
    const dayOfMonth = today.getDate()
    const lastDayOfMonth = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      0
    ).getDate()

    return debts.filter((debt) => {
      if (!debt.autoPayment?.enabled) return false

      if (debt.autoPayment.frequency === "MONTHLY") {
        // Handle end of month (e.g., day 31 in Feb should execute on last day)
        const targetDay = Math.min(
          debt.autoPayment.dayOfMonth || 1,
          lastDayOfMonth
        )
        return dayOfMonth === targetDay
      }

      return false
    })
  }

  /**
   * Execute auto-payment for a debt
   */
  async executeAutoPayment(
    debt: DebtEntity,
    bot?: BotClient
  ): Promise<boolean> {
    try {
      if (!debt.autoPayment) return false

      const { currency, name, counterparty } = debt
      const { amount, accountId } = debt.autoPayment

      // Check if FROM account exists and has enough funds
      const balance = await db.getBalance(debt.userId, accountId, currency)
      if (!balance) {
        if (bot) {
          await bot.sendMessage(
            debt.userId,
            "⚠️ *Auto-Payment Failed*\n\n" +
              `Debt: *${escapeMarkdown(name)}* (${escapeMarkdown(counterparty || "")})\n` +
              `Reason: Account "${escapeMarkdown(accountId)}" not found.`,
            { parse_mode: "Markdown" }
          )
        }
        return false
      }

      if (balance.amount < amount) {
        if (bot) {
          await bot.sendMessage(
            debt.userId,
            "⚠️ *Auto-Payment Failed*\n\n" +
              `Debt: *${escapeMarkdown(name)}* (${escapeMarkdown(counterparty || "")})\n` +
              `Reason: Insufficient funds in "${escapeMarkdown(accountId)}"\n\n` +
              `Available: ${formatMoney(balance.amount, currency)}\n` +
              `Required: ${formatMoney(amount, currency)}`,
            { parse_mode: "Markdown" }
          )
        }
        return false
      }

      // Create DEBT_REPAYMENT transaction
      const txId = randomUUID()
      const txData = {
        id: txId,
        userId: debt.userId,
        date: new Date(),
        amount,
        currency,
        type: TransactionType.EXPENSE,
        category: InternalCategory.DEBT_REPAYMENT,
        fromAccountId: accountId,
        description: `Auto-payment: ${name} (${counterparty})`,
      }

      const txRepo = AppDataSource.getRepository(TransactionEntity)
      await txRepo.save(txData)

      // Update balance
      await db.safeUpdateBalance(debt.userId, accountId, -amount, currency)

      // Update debt
      const debtRepo = AppDataSource.getRepository(DebtEntity)
      debt.paidAmount += amount

      // Check if debt is fully paid
      if (debt.paidAmount >= debt.amount) {
        debt.isPaid = true
        debt.autoPayment.enabled = false // Disable auto-payment
      }

      await debtRepo.save(debt)

      // Clear cache
      db.clearCache(debt.userId)

      // Send success notification
      if (bot) {
        const remaining = debt.amount - debt.paidAmount
        const progress = Math.round((debt.paidAmount / debt.amount) * 100)

        if (debt.isPaid) {
          await bot.sendMessage(
            debt.userId,
            "🎉 *Debt Fully Paid!*\n\n" +
              `💸 *${escapeMarkdown(name)}* (${escapeMarkdown(counterparty || "")})\n\n` +
              `Final payment: ${formatMoney(amount, currency)}\n` +
              `From: ${escapeMarkdown(accountId)}\n\n` +
              "🎆 Debt cleared! Auto-payments disabled.",
            { parse_mode: "Markdown" }
          )
        } else {
          await bot.sendMessage(
            debt.userId,
            "✅ *Auto-Payment Completed*\n\n" +
              `💸 *${escapeMarkdown(name)}* (${escapeMarkdown(counterparty || "")})\n\n` +
              `Paid: ${formatMoney(amount, currency)}\n` +
              `From: ${escapeMarkdown(accountId)}\n` +
              `Frequency: ${debt.autoPayment.frequency}\n\n` +
              `Progress: ${progress}%\n` +
              `Remaining: ${formatMoney(remaining, currency)}`,
            { parse_mode: "Markdown" }
          )
        }
      }

      return true
    } catch (error) {
      console.error(
        `Failed to execute auto-payment for debt ${debt.id}:`,
        error
      )
      return false
    }
  }

  /**
   * Execute all due auto-payments
   */
  async executeAllDue(bot?: BotClient): Promise<void> {
    try {
      const dueDebts = await this.getDueAutoPayments()

      console.log(
        `[AutoDebtPayment] Found ${dueDebts.length} due auto-payments`
      )

      for (const debt of dueDebts) {
        await this.executeAutoPayment(debt, bot)
      }
    } catch (error) {
      console.error(
        "[AutoDebtPayment] Failed to execute due auto-payments:",
        error
      )
    }
  }
}

export const autoDebtPaymentManager = new AutoDebtPaymentManager()
