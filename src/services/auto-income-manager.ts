/**
 * Auto-Income Manager
 * Handles automatic income transactions from income sources
 */

import { randomUUID } from "node:crypto"
import type TelegramBot from "node-telegram-bot-api"
import { AppDataSource } from "../database/data-source"
import { IncomeSource as IncomeSourceEntity } from "../database/entities/IncomeSource"
import { Transaction as TransactionEntity } from "../database/entities/Transaction"
import { dbStorage as db } from "../database/storage-db"
import { IncomeCategory, TransactionType } from "../types"
import { escapeMarkdown, formatMoney } from "../utils"

class AutoIncomeManager {
  /**
   * Get all income sources with active auto-create that are due today
   */
  async getDueAutoIncomes(): Promise<IncomeSourceEntity[]> {
    const incomeRepo = AppDataSource.getRepository(IncomeSourceEntity)

    const incomes = await incomeRepo
      .createQueryBuilder("income")
      .where("income.autoCreate IS NOT NULL")
      .getMany()

    const today = new Date()
    const dayOfMonth = today.getDate()
    const lastDayOfMonth = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      0
    ).getDate()

    return incomes.filter((income) => {
      if (!income.autoCreate?.enabled) return false

      if (income.frequency === "MONTHLY") {
        // Handle end of month (e.g., day 31 in Feb should execute on last day)
        const targetDay = Math.min(
          income.autoCreate.dayOfMonth || 1,
          lastDayOfMonth
        )
        return dayOfMonth === targetDay
      }

      return false
    })
  }

  /**
   * Execute auto-income for an income source
   */
  async executeAutoIncome(
    income: IncomeSourceEntity,
    bot?: TelegramBot
  ): Promise<boolean> {
    try {
      if (!income.autoCreate) return false

      const { currency, name } = income
      const { amount, accountId } = income.autoCreate

      if (!currency) {
        if (bot) {
          await bot.sendMessage(
            income.userId,
            "⚠️ *Auto-Income Failed*\n\n" +
              `Source: *${escapeMarkdown(name)}*\n` +
              "Reason: Currency not set.",
            { parse_mode: "Markdown" }
          )
        }
        return false
      }

      // Check if TO account exists
      const balance = await db.getBalance(income.userId, accountId, currency)
      if (!balance) {
        if (bot) {
          await bot.sendMessage(
            income.userId,
            "⚠️ *Auto-Income Failed*\n\n" +
              `Source: *${escapeMarkdown(name)}*\n` +
              `Reason: Account "${escapeMarkdown(accountId)}" not found.`,
            { parse_mode: "Markdown" }
          )
        }
        return false
      }

      // Create INCOME transaction
      const txId = randomUUID()
      const txData = {
        id: txId,
        userId: income.userId,
        date: new Date(),
        amount,
        currency,
        type: TransactionType.INCOME,
        category: IncomeCategory.SALARY, // Could be configurable
        toAccountId: accountId,
        description: `Auto-income: ${name}`,
      }

      const txRepo = AppDataSource.getRepository(TransactionEntity)
      await txRepo.save(txData)

      // Update balance
      await db.safeUpdateBalance(income.userId, accountId, amount, currency)

      // Clear cache
      db.clearCache(income.userId)

      // Send success notification
      if (bot) {
        await bot.sendMessage(
          income.userId,
          "💰 *Auto-Income Added*\n\n" +
            `💼 *${escapeMarkdown(name)}*\n\n` +
            `Amount: ${formatMoney(amount, currency)}\n` +
            `To: ${escapeMarkdown(accountId)}\n` +
            `Frequency: ${income.frequency}\n\n` +
            "✅ Income transaction created successfully!",
          { parse_mode: "Markdown" }
        )
      }

      return true
    } catch (error) {
      console.error(`Failed to execute auto-income for ${income.id}:`, error)
      return false
    }
  }

  /**
   * Execute all due auto-incomes
   */
  async executeAllDue(bot?: TelegramBot): Promise<void> {
    try {
      const dueIncomes = await this.getDueAutoIncomes()

      console.log(`[AutoIncome] Found ${dueIncomes.length} due auto-incomes`)

      for (const income of dueIncomes) {
        await this.executeAutoIncome(income, bot)
      }
    } catch (error) {
      console.error("[AutoIncome] Failed to execute due auto-incomes:", error)
    }
  }
}

export const autoIncomeManager = new AutoIncomeManager()
