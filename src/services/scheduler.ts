import TelegramBot from "node-telegram-bot-api"
import * as cron from "node-cron"
import { reminderManager } from "./reminder-manager"
import { recurringManager } from "./recurring-manager"
import { autoDepositManager } from "./auto-deposit-manager"
import { autoIncomeManager } from "./auto-income-manager"
import { autoDebtPaymentManager } from "./auto-debt-payment"

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
    this.reminderTask = cron.schedule('0 * * * *', async () => {
      console.log('⏰ Checking reminders...')
      try {
        const reminders = await reminderManager.getPendingReminders()
        console.log(`Found ${reminders.length} pending reminders`)

        for (const reminder of reminders) {
          await reminderManager.sendReminder(this.bot, reminder)
        }
      } catch (error) {
        console.error('Error processing reminders:', error)
      }
    })

    // Проверка recurring транзакций каждый день в 10:00
    this.recurringTask = cron.schedule('0 10 * * *', async () => {
      console.log('🔄 Checking recurring transactions...')
      try {
        const transactions = await recurringManager.getDueRecurring()
        console.log(`Found ${transactions.length} due recurring transactions`)

        for (const tx of transactions) {
          if (tx.autoExecute) {
            await recurringManager.executeRecurring(tx)
            console.log(`Executed recurring transaction: ${tx.id}`)
          } else {
            await this.bot.sendMessage(
              tx.userId,
              `🔄 *Recurring Transaction Due*\n\n` +
              `${tx.category}: ${tx.amount} ${tx.currency}\n\n` +
              `Execute now?`,
              { parse_mode: 'Markdown' }
            )
          }
        }
      } catch (error) {
        console.error('Error processing recurring transactions:', error)
      }
    })

    // Проверка auto-deposits каждый день в 11:00
    this.autoDepositTask = cron.schedule('0 11 * * *', async () => {
      console.log('💰 Checking auto-deposits...')
      try {
        const dueGoals = await autoDepositManager.getDueAutoDeposits()
        console.log(`Found ${dueGoals.length} goals with due auto-deposits`)

        for (const goal of dueGoals) {
          const success = await autoDepositManager.executeAutoDeposit(goal, this.bot)
          if (success) {
            console.log(`Executed auto-deposit for goal: ${goal.name}`)
          }
        }
      } catch (error) {
        console.error('Error processing auto-deposits:', error)
      }
    })

    // Проверка auto-incomes каждый день в 12:00
    this.autoIncomeTask = cron.schedule('0 12 * * *', async () => {
      console.log('💼 Checking auto-incomes...')
      try {
        await autoIncomeManager.executeAllDue(this.bot)
      } catch (error) {
        console.error('Error processing auto-incomes:', error)
      }
    })

    // Проверка auto-debt-payments каждый день в 12:30
    this.autoDebtPaymentTask = cron.schedule('30 12 * * *', async () => {
      console.log('💸 Checking auto-debt-payments...')
      try {
        await autoDebtPaymentManager.executeAllDue(this.bot)
      } catch (error) {
        console.error('Error processing auto-debt-payments:', error)
      }
    })

    console.log('✅ Scheduler started successfully')
  }

  stop(): void {
    console.log('⏹️ Stopping scheduler...')
    this.reminderTask?.stop()
    this.recurringTask?.stop()
    this.autoDepositTask?.stop()
    this.autoIncomeTask?.stop()
    this.autoDebtPaymentTask?.stop()
    console.log('✅ Scheduler stopped')
  }
}
