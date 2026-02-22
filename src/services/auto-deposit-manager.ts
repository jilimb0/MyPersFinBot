/**
 * Auto-Deposit Manager
 * Handles automatic deposits to goals
 */

import { randomUUID } from "node:crypto"
import type { BotClient } from "@jilimb0/tgwrapper"
import { AppDataSource } from "../database/data-source"
import { Goal as GoalEntity } from "../database/entities/Goal"
import { Transaction as TransactionEntity } from "../database/entities/Transaction"
import { dbStorage as db } from "../database/storage-db"
import { InternalCategory, TransactionType } from "../types"
import { escapeMarkdown, formatMoney } from "../utils"

class AutoDepositManager {
  /**
   * Get all goals with active auto-deposit that are due today
   */
  async getDueAutoDeposits(): Promise<GoalEntity[]> {
    const goalRepo = AppDataSource.getRepository(GoalEntity)

    const goals = await goalRepo
      .createQueryBuilder("goal")
      .where("goal.status = :status", { status: "ACTIVE" })
      .andWhere("goal.autoDeposit IS NOT NULL")
      .getMany()

    const today = new Date()
    const dayOfWeek = today.getDay() // 0-6 (Sunday=0)
    const dayOfMonth = today.getDate() // 1-31

    // Filter goals that are due today
    const dueGoals = goals.filter((goal) => {
      if (!goal.autoDeposit || !goal.autoDeposit.enabled) return false

      if (goal.autoDeposit.frequency === "WEEKLY") {
        return goal.autoDeposit.dayOfWeek === dayOfWeek
      }

      if (goal.autoDeposit.frequency === "MONTHLY") {
        // Handle end of month (e.g., day 31 in Feb should execute on last day)
        const lastDayOfMonth = new Date(
          today.getFullYear(),
          today.getMonth() + 1,
          0
        ).getDate()
        const targetDay = Math.min(
          goal.autoDeposit.dayOfMonth || 1,
          lastDayOfMonth
        )
        return dayOfMonth === targetDay
      }

      return false
    })

    return dueGoals
  }

  /**
   * Execute auto-deposit for a goal
   */
  async executeAutoDeposit(
    goal: GoalEntity,
    bot?: BotClient
  ): Promise<boolean> {
    try {
      if (!goal.autoDeposit) return false

      const { currency, name } = goal
      const { amount, accountId, frequency } = goal.autoDeposit

      // Check if balance exists and has enough funds
      const balance = await db.getBalance(goal.userId, accountId, currency)
      if (!balance) {
        if (bot) {
          await bot.sendMessage(
            goal.userId,
            "⚠️ *Auto-Deposit Failed*\n\n" +
              `Goal: *${escapeMarkdown(goal.name)}*\n` +
              `Reason: Account "${escapeMarkdown(accountId)}" not found.`,
            { parse_mode: "Markdown" }
          )
        }
        return false
      }

      if (balance.amount < amount) {
        if (bot) {
          await bot.sendMessage(
            goal.userId,
            "⚠️ *Auto-Deposit Failed*\n\n" +
              `Goal: *${escapeMarkdown(name)}*\n` +
              `Reason: Insufficient funds in "${escapeMarkdown(accountId)}"\n\n` +
              `Available: ${formatMoney(balance.amount, balance.currency)}\n` +
              `Required: ${formatMoney(amount, currency)}`,
            { parse_mode: "Markdown" }
          )
        }
        return false
      }

      // Create GOAL_DEPOSIT transaction
      const txId = randomUUID()
      const txData = {
        id: txId,
        userId: goal.userId,
        date: new Date(),
        amount,
        currency: goal.currency,
        type: TransactionType.EXPENSE,
        category: InternalCategory.GOAL_DEPOSIT,
        fromAccountId: accountId,
        description: `Auto-deposit to ${goal.name}`,
      }

      // Save transaction
      const txRepo = AppDataSource.getRepository(TransactionEntity)
      await txRepo.save(txData)

      // Update balance
      await db.safeUpdateBalance(
        goal.userId,
        accountId,
        -amount,
        balance.currency
      )

      // Update goal progress
      const goalRepo = AppDataSource.getRepository(GoalEntity)
      goal.currentAmount += amount

      // Check if goal is completed
      if (goal.currentAmount >= goal.targetAmount) {
        goal.status = "COMPLETED"
        goal.autoDeposit.enabled = false // Disable auto-deposit
      }

      await goalRepo.save(goal)

      // Clear cache
      db.clearCache(goal.userId)

      // Send success notification
      if (bot) {
        const remaining = goal.targetAmount - goal.currentAmount
        const progress = Math.round(
          (goal.currentAmount / goal.targetAmount) * 100
        )

        if (goal.status === "COMPLETED") {
          await bot.sendMessage(
            goal.userId,
            "🎉 *Goal Completed!*\n\n" +
              `🎯 *${escapeMarkdown(goal.name)}*\n\n` +
              `Auto-deposit: ${formatMoney(amount, goal.currency)}\n` +
              `From: ${escapeMarkdown(accountId)}\n\n` +
              `🎆 You've reached your goal of ${formatMoney(goal.targetAmount, goal.currency)}!\n\n` +
              "Auto-deposits have been disabled.",
            { parse_mode: "Markdown" }
          )
        } else {
          await bot.sendMessage(
            goal.userId,
            "✅ *Auto-Deposit Completed*\n\n" +
              `🎯 *${escapeMarkdown(goal.name)}*\n\n` +
              `Deposited: ${formatMoney(amount, goal.currency)}\n` +
              `From: ${escapeMarkdown(accountId)}\n` +
              `Frequency: ${frequency}\n\n` +
              `Progress: ${progress}%\n` +
              `Remaining: ${formatMoney(remaining, goal.currency)}`,
            { parse_mode: "Markdown" }
          )
        }
      }

      return true
    } catch (error) {
      console.error(
        `Failed to execute auto-deposit for goal ${goal.id}:`,
        error
      )
      return false
    }
  }
}

export const autoDepositManager = new AutoDepositManager()
