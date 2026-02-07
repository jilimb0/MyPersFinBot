import TelegramBot from "node-telegram-bot-api"
import * as cron from "node-cron"
import { reminderManager } from "./reminder-manager"
import { recurringManager } from "./recurring-manager"
import { autoDepositManager } from "./auto-deposit-manager"
import { autoIncomeManager } from "./auto-income-manager"
import { autoDebtPaymentManager } from "./auto-debt-payment"
import logger from "../logger"
import { config } from "../config"

export class Scheduler {
  private bot: TelegramBot
  private reminderTask?: cron.ScheduledTask
  private recurringTask?: cron.ScheduledTask
  private autoDepositTask?: cron.ScheduledTask
  private autoIncomeTask?: cron.ScheduledTask
  private autoDebtPaymentTask?: cron.ScheduledTask

  constructor(bot: TelegramBot) {
    this.bot = bot
  }

  start(): void {
    this.reminderTask = cron.schedule("0 * * * *", async () => {
      if (config.LOG_SCHEDULER_TICK) {
        logger.debug("⏰ Checking reminders...")
      }
      try {
        const reminders = await reminderManager.getPendingReminders()
        if (config.LOG_SCHEDULER_TICK) {
          logger.debug(`Found ${reminders.length} pending reminders`)
        }

        for (const reminder of reminders) {
          await reminderManager.sendReminder(this.bot, reminder)
        }
      } catch (error) {
        logger.error("Error processing reminders:", error)
      }
    })

    // Проверка recurring транзакций каждый день в 10:00
    this.recurringTask = cron.schedule("0 10 * * *", async () => {
      if (config.LOG_SCHEDULER_TICK) {
        logger.debug("🔄 Checking recurring transactions...")
      }
      try {
        const transactions = await recurringManager.getDueRecurring()
        if (config.LOG_SCHEDULER_TICK) {
          logger.debug(`Found ${transactions.length} due recurring transactions`)
        }

        for (const tx of transactions) {
          if (tx.autoExecute) {
            await recurringManager.executeRecurring(tx)
            if (config.LOG_SCHEDULER_TICK) {
              logger.debug(`Executed recurring transaction: ${tx.id}`)
            }
          } else {
            await this.bot.sendMessage(
              tx.userId,
              `🔄 *Recurring Transaction Due*\n\n` +
                `${tx.category}: ${tx.amount} ${tx.currency}\n\n` +
                `Execute now?`,
              { parse_mode: "Markdown" }
            )
          }
        }
      } catch (error) {
        logger.error("Error processing recurring transactions:", error)
      }
    })

    // Проверка auto-deposits каждый день в 11:00
    this.autoDepositTask = cron.schedule("0 11 * * *", async () => {
      if (config.LOG_SCHEDULER_TICK) {
        logger.debug("💰 Checking auto-deposits...")
      }
      try {
        const dueGoals = await autoDepositManager.getDueAutoDeposits()
        if (config.LOG_SCHEDULER_TICK) {
          logger.debug(
            `Found ${dueGoals.length} goals with due auto-deposits`
          )
        }

        for (const goal of dueGoals) {
          const success = await autoDepositManager.executeAutoDeposit(
            goal,
            this.bot
          )
          if (success) {
            if (config.LOG_SCHEDULER_TICK) {
              logger.debug(`Executed auto-deposit for goal: ${goal.name}`)
            }
          }
        }
      } catch (error) {
        logger.error("Error processing auto-deposits:", error)
      }
    })

    // Проверка auto-incomes каждый день в 12:00
    this.autoIncomeTask = cron.schedule("0 12 * * *", async () => {
      if (config.LOG_SCHEDULER_TICK) {
        logger.debug("💼 Checking auto-incomes...")
      }
      try {
        await autoIncomeManager.executeAllDue(this.bot)
      } catch (error) {
        logger.error("Error processing auto-incomes:", error)
      }
    })

    // Проверка auto-debt-payments каждый день в 12:30
    this.autoDebtPaymentTask = cron.schedule("30 12 * * *", async () => {
      if (config.LOG_SCHEDULER_TICK) {
        logger.debug("💸 Checking auto-debt-payments...")
      }
      try {
        await autoDebtPaymentManager.executeAllDue(this.bot)
      } catch (error) {
        logger.error("Error processing auto-debt-payments:", error)
      }
    })

    if (config.LOG_BOOT_DETAIL) {
      logger.info("✅ Scheduler started successfully")
    }
  }

  stop(): void {
    if (config.LOG_BOOT_DETAIL) {
      logger.info("⏹️ Stopping scheduler...")
    }
    this.reminderTask?.stop()
    this.recurringTask?.stop()
    this.autoDepositTask?.stop()
    this.autoIncomeTask?.stop()
    this.autoDebtPaymentTask?.stop()
    if (config.LOG_BOOT_DETAIL) {
      logger.info("✅ Scheduler stopped")
    }
  }
}
