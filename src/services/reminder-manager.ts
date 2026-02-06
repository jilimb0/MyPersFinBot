import { AppDataSource } from "../database/data-source"
import { Reminder } from "../database/entities/Reminder"
import { User } from "../database/entities/User"
import { Debt } from "../database/entities/Debt"
import { Goal } from "../database/entities/Goal"
import { IncomeSource } from "../database/entities/IncomeSource"
import { ReminderSettings } from "../types"
import TelegramBot from "node-telegram-bot-api"
import { randomUUID } from "crypto"
import dayjs from "dayjs"
import utc from "dayjs/plugin/utc"
import timezone from "dayjs/plugin/timezone"
import { Language, t } from "../i18n"
import { formatDateDisplay } from "../utils"

dayjs.extend(utc)
dayjs.extend(timezone)

export class ReminderManager {
  // Create monthly reminders for debt until due date
  async createDebtReminder(userId: string, debt: Debt): Promise<void> {
    if (!debt.dueDate) return undefined

    const userRepo = AppDataSource.getRepository(User)
    const user = await userRepo.findOne({ where: { id: userId } })

    if (!user?.reminderSettings?.enabled) return undefined

    // Delete existing reminders for this debt
    await this.deleteRemindersForEntity(userId, debt.id)

    const now = dayjs()
    const dueDate = dayjs(debt.dueDate)
    const remaining = debt.amount - debt.paidAmount

    // If already overdue or due today
    if (dueDate.isBefore(now, "day") || dueDate.isSame(now, "day")) {
      return undefined
    }

    // Calculate months until due
    let currentMonth = now.startOf("month")
    const reminderRepo = AppDataSource.getRepository(Reminder)

    while (currentMonth.isBefore(dueDate, "month")) {
      const reminderDate = currentMonth.add(1, "day").toDate() // 1st day of month
      const monthsLeft = dueDate.diff(currentMonth, "month", true)
      const monthlyAmount = monthsLeft > 0 ? remaining / monthsLeft : remaining

      const message = await this.formatDebtMonthlyReminder(
        userId,
        debt,
        remaining,
        monthlyAmount,
        Math.ceil(monthsLeft)
      )

      const reminder = reminderRepo.create({
        id: randomUUID(),
        userId,
        type: "DEBT",
        entityId: debt.id,
        reminderDate,
        message,
        isProcessed: false,
        createdAt: new Date(),
      })
      await reminderRepo.save(reminder)

      currentMonth = currentMonth.add(1, "month")
    }

    // Final reminder 1 day before due
    const finalReminderDate = dueDate.subtract(1, "day").toDate()
    if (dayjs(finalReminderDate).isAfter(now)) {
      const finalMessage = await this.formatDebtFinalReminder(
        userId,
        debt,
        remaining
      )
      const finalReminder = reminderRepo.create({
        id: randomUUID(),
        userId,
        type: "DEBT",
        entityId: debt.id,
        reminderDate: finalReminderDate,
        message: finalMessage,
        isProcessed: false,
        createdAt: new Date(),
      })
      await reminderRepo.save(finalReminder)
    }
  }

  // Create monthly reminders for goal until deadline
  async createGoalReminder(userId: string, goal: Goal): Promise<void> {
    if (!goal.deadline) return undefined

    const userRepo = AppDataSource.getRepository(User)
    const user = await userRepo.findOne({ where: { id: userId } })

    if (!user?.reminderSettings?.enabled) return undefined

    // Delete existing reminders for this goal
    await this.deleteRemindersForEntity(userId, goal.id)

    const now = dayjs()
    const deadline = dayjs(goal.deadline)
    const remaining = goal.targetAmount - goal.currentAmount

    if (deadline.isBefore(now, "day") || deadline.isSame(now, "day")) {
      return undefined
    }

    // Calculate months until deadline
    let currentMonth = now.startOf("month")
    const reminderRepo = AppDataSource.getRepository(Reminder)

    while (currentMonth.isBefore(deadline, "month")) {
      const reminderDate = currentMonth.add(1, "day").toDate() // 1st day of month
      const monthsLeft = deadline.diff(currentMonth, "month", true)
      const monthlyAmount = monthsLeft > 0 ? remaining / monthsLeft : remaining

      const message = await this.formatGoalMonthlyReminder(
        userId,
        goal,
        remaining,
        monthlyAmount,
        Math.ceil(monthsLeft)
      )

      const reminder = reminderRepo.create({
        id: randomUUID(),
        userId,
        type: "GOAL",
        entityId: goal.id,
        reminderDate,
        message,
        isProcessed: false,
        createdAt: new Date(),
      })
      await reminderRepo.save(reminder)

      currentMonth = currentMonth.add(1, "month")
    }

    // Final reminder 3 days before deadline
    const finalReminderDate = deadline.subtract(3, "day").toDate()
    if (dayjs(finalReminderDate).isAfter(now)) {
      const finalMessage = await this.formatGoalFinalReminder(
        userId,
        goal,
        remaining
      )
      const finalReminder = reminderRepo.create({
        id: randomUUID(),
        userId,
        type: "GOAL",
        entityId: goal.id,
        reminderDate: finalReminderDate,
        message: finalMessage,
        isProcessed: false,
        createdAt: new Date(),
      })
      await reminderRepo.save(finalReminder)
    }
  }

  // Create monthly reminder for income (recurring)
  async createIncomeReminder(
    userId: string,
    income: IncomeSource
  ): Promise<void> {
    if (!income.expectedDate || !income.reminderEnabled) return undefined

    const userRepo = AppDataSource.getRepository(User)
    const user = await userRepo.findOne({ where: { id: userId } })

    if (!user?.reminderSettings?.enabled) return

    // Delete existing reminders
    await this.deleteRemindersForEntity(userId, income.id.toString())

    const nextIncomeDate = this.calculateNextIncomeDate(income.expectedDate)
    const daysBefore = user.reminderSettings.notifyBefore.income
    const reminderDate = dayjs(nextIncomeDate)
      .subtract(daysBefore, "day")
      .toDate()

    if (dayjs(reminderDate).isBefore(dayjs(), "day")) return undefined

    const message = await this.formatIncomeReminder(userId, income)

    const reminderRepo = AppDataSource.getRepository(Reminder)
    const reminder = reminderRepo.create({
      id: randomUUID(),
      userId,
      type: "INCOME",
      entityId: income.id.toString(),
      reminderDate,
      message,
      isProcessed: false,
      createdAt: new Date(),
    })

    await reminderRepo.save(reminder)
  }

  // Format messages
  private async formatDebtMonthlyReminder(
    userId: string,
    debt: Debt,
    remaining: number,
    monthlyAmount: number,
    monthsLeft: number
  ): Promise<string> {
    const userRepo = AppDataSource.getRepository(User)
    const user = await userRepo.findOne({ where: { id: userId } })
    const lang = (user?.language || "en") as Language

    const customTemplate = user?.reminderSettings?.customMessages?.debt

    if (customTemplate) {
      return this.replacePlaceholders(customTemplate, {
        name: debt.name,
        amount: debt.amount.toFixed(2),
        currency: debt.currency,
        dueDate: formatDateDisplay(debt.dueDate || ""),
        remaining: remaining.toFixed(2),
        monthlyAmount: monthlyAmount.toFixed(2),
        monthsLeft: monthsLeft.toString(),
      })
    }

    const emoji = debt.type === "I_OWE" ? "💸" : "💰"
    const title = t(lang, "reminders.messages.debtMonthlyTitle", { emoji })
    const lines = [
      t(lang, "reminders.messages.debtLine", { name: debt.name }),
      t(lang, "reminders.messages.totalRemainingLine", {
        amount: remaining.toFixed(2),
        currency: debt.currency,
      }),
      t(lang, "reminders.messages.monthsLeftLine", { months: monthsLeft }),
      t(lang, "reminders.messages.suggestedMonthlyPaymentLine", {
        amount: monthlyAmount.toFixed(2),
        currency: debt.currency,
      }),
      t(lang, "reminders.messages.dueLine", {
        date: formatDateDisplay(debt.dueDate || ""),
      }),
    ]
    return `${title}\n\n${lines.join("\n")}`
  }

  private async formatDebtFinalReminder(
    userId: string,
    debt: Debt,
    remaining: number
  ): Promise<string> {
    const userRepo = AppDataSource.getRepository(User)
    const user = await userRepo.findOne({ where: { id: userId } })
    const lang = (user?.language || "en") as Language

    const customTemplate = user?.reminderSettings?.customMessages?.debt

    if (customTemplate) {
      return this.replacePlaceholders(customTemplate, {
        name: debt.name,
        amount: debt.amount.toFixed(2),
        currency: debt.currency,
        dueDate: formatDateDisplay(debt.dueDate || ""),
        remaining: remaining.toFixed(2),
      })
    }

    const emoji = debt.type === "I_OWE" ? "⚠️" : "💰"
    const title = t(lang, "reminders.messages.debtFinalTitle", { emoji })
    const lines = [
      t(lang, "reminders.messages.debtLine", { name: debt.name }),
      t(lang, "reminders.messages.amountLine", {
        amount: remaining.toFixed(2),
        currency: debt.currency,
      }),
      t(lang, "reminders.messages.dueLine", {
        date: formatDateDisplay(debt.dueDate || ""),
      }),
    ]
    return `${title}\n\n${lines.join("\n")}`
  }

  private async formatGoalMonthlyReminder(
    userId: string,
    goal: Goal,
    remaining: number,
    monthlyAmount: number,
    monthsLeft: number
  ): Promise<string> {
    const userRepo = AppDataSource.getRepository(User)
    const user = await userRepo.findOne({ where: { id: userId } })
    const lang = (user?.language || "en") as Language

    const customTemplate = user?.reminderSettings?.customMessages?.goal

    if (customTemplate) {
      return this.replacePlaceholders(customTemplate, {
        name: goal.name,
        amount: goal.currentAmount.toFixed(2),
        currency: goal.currency,
        remaining: remaining.toFixed(2),
        target: goal.targetAmount.toFixed(2),
        monthlyAmount: monthlyAmount.toFixed(2),
        monthsLeft: monthsLeft.toString(),
        dueDate: formatDateDisplay(goal.deadline || ""),
      })
    }

    const title = t(lang, "reminders.messages.goalMonthlyTitle")
    const lines = [
      t(lang, "reminders.messages.goalLine", { name: goal.name }),
      t(lang, "reminders.messages.totalRemainingLine", {
        amount: remaining.toFixed(2),
        currency: goal.currency,
      }),
      t(lang, "reminders.messages.monthsLeftLine", { months: monthsLeft }),
      t(lang, "reminders.messages.suggestedMonthlySavingLine", {
        amount: monthlyAmount.toFixed(2),
        currency: goal.currency,
      }),
      t(lang, "reminders.messages.deadlineLine", {
        date: formatDateDisplay(goal.deadline || ""),
      }),
    ]
    return `${title}\n\n${lines.join("\n")}`
  }

  private async formatGoalFinalReminder(
    userId: string,
    goal: Goal,
    remaining: number
  ): Promise<string> {
    const userRepo = AppDataSource.getRepository(User)
    const user = await userRepo.findOne({ where: { id: userId } })
    const lang = (user?.language || "en") as Language

    const customTemplate = user?.reminderSettings?.customMessages?.goal

    if (customTemplate) {
      return this.replacePlaceholders(customTemplate, {
        name: goal.name,
        amount: goal.currentAmount.toFixed(2),
        currency: goal.currency,
        remaining: remaining.toFixed(2),
        target: goal.targetAmount.toFixed(2),
        dueDate: formatDateDisplay(goal.deadline || ""),
      })
    }

    const title = t(lang, "reminders.messages.goalFinalTitle")
    const lines = [
      t(lang, "reminders.messages.goalLine", { name: goal.name }),
      t(lang, "reminders.messages.remainingLine", {
        amount: remaining.toFixed(2),
        currency: goal.currency,
      }),
      t(lang, "reminders.messages.deadlineCountdownLine", {
        date: formatDateDisplay(goal.deadline || ""),
        days: 3,
      }),
    ]
    return `${title}\n\n${lines.join("\n")}`
  }

  private async formatIncomeReminder(
    userId: string,
    income: IncomeSource
  ): Promise<string> {
    const userRepo = AppDataSource.getRepository(User)
    const user = await userRepo.findOne({ where: { id: userId } })
    const lang = (user?.language || "en") as Language

    const customTemplate = user?.reminderSettings?.customMessages?.income

    if (customTemplate) {
      return this.replacePlaceholders(customTemplate, {
        name: income.name,
        amount: income.expectedAmount?.toFixed(2) || "0",
        currency: income.currency || "USD",
      })
    }

    const title = t(lang, "reminders.messages.incomeTitle")
    const lines = [
      t(lang, "reminders.messages.sourceLine", { name: income.name }),
      t(lang, "reminders.messages.expectedAmountLine", {
        amount: income.expectedAmount?.toFixed(2) || "0",
        currency: income.currency || "USD",
      }),
      t(lang, "reminders.messages.expectedDateLine", {
        day: income.expectedDate || 0,
      }),
    ]
    return `${title}\n\n${lines.join("\n")}`
  }

  // Utility methods
  private calculateNextIncomeDate(dayOfMonth: number): Date {
    const now = dayjs()
    let nextDate = now.date(dayOfMonth)

    if (nextDate.isBefore(now)) {
      nextDate = nextDate.add(1, "month")
    }

    return nextDate.toDate()
  }

  async getPendingReminders(_date?: Date): Promise<Reminder[]> {
    const reminderRepo = AppDataSource.getRepository(Reminder)
    const userRepo = AppDataSource.getRepository(User)
    // const checkDate = date || new Date()

    // Get all users with reminder settings
    const users = await userRepo.find()
    const pendingReminders: Reminder[] = []

    for (const user of users) {
      if (!user.reminderSettings?.enabled) continue

      const userTimezone = user.reminderSettings.timezone || "Asia/Tbilisi"
      const userTime = user.reminderSettings.time || "09:00"

      // Get current time in user's timezone
      const nowInUserTz = dayjs().tz(userTimezone)
      const currentHour = nowInUserTz.hour()
      // const currentMinute = nowInUserTz.minute()

      // Parse user's reminder time
      const [targetHour, _targetMinute] = userTime.split(":").map(Number)

      // Check if it's reminder time for this user (within current hour)
      if (currentHour === targetHour) {
        // Get today's date in user's timezone
        const todayInUserTz = nowInUserTz.startOf("day").toDate()
        const endOfDayInUserTz = nowInUserTz.endOf("day").toDate()

        // Get unprocessed reminders for this user for today
        const userReminders = await reminderRepo
          .createQueryBuilder("reminder")
          .where("reminder.userId = :userId", { userId: user.id })
          .andWhere("reminder.isProcessed = :isProcessed", {
            isProcessed: false,
          })
          .andWhere("reminder.reminderDate >= :startOfDay", {
            startOfDay: todayInUserTz,
          })
          .andWhere("reminder.reminderDate <= :endOfDay", {
            endOfDay: endOfDayInUserTz,
          })
          .getMany()

        pendingReminders.push(...userReminders)
      }
    }

    return pendingReminders
  }

  async sendReminder(bot: TelegramBot, reminder: Reminder): Promise<void> {
    try {
      await bot.sendMessage(reminder.userId, reminder.message, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "✅ Done",
                callback_data: `reminder_done|${reminder.id}`,
              },
            ],
            [
              {
                text: "⏰ Snooze 1 hour",
                callback_data: `reminder_snooze|${reminder.id}|1h`,
              },
              {
                text: "📅 Snooze 1 day",
                callback_data: `reminder_snooze|${reminder.id}|1d`,
              },
            ],
          ],
        },
      })
    } catch (error) {
      console.error(`Failed to send reminder ${reminder.id}:`, error)
    }
  }

  async markProcessed(reminderId: string): Promise<void> {
    const reminderRepo = AppDataSource.getRepository(Reminder)
    await reminderRepo.update({ id: reminderId }, { isProcessed: true })
  }

  async deleteRemindersForEntity(
    userId: string,
    entityId: string
  ): Promise<void> {
    const reminderRepo = AppDataSource.getRepository(Reminder)
    await reminderRepo.delete({ userId, entityId, isProcessed: false })
  }

  async getUserReminders(userId: string): Promise<{
    debts: Array<{ debt: Debt; reminders: Reminder[] }>
    goals: Array<{ goal: Goal; reminders: Reminder[] }>
    income: Array<{ income: IncomeSource; reminders: Reminder[] }>
  }> {
    const reminderRepo = AppDataSource.getRepository(Reminder)
    const debtRepo = AppDataSource.getRepository(Debt)
    const goalRepo = AppDataSource.getRepository(Goal)
    const incomeRepo = AppDataSource.getRepository(IncomeSource)

    // Get all pending reminders
    const allReminders = await reminderRepo.find({
      where: { userId, isProcessed: false },
      order: { reminderDate: "ASC" },
    })

    // Group by type
    const debtReminders = allReminders.filter(
      (r: Reminder) => r.type === "DEBT"
    )
    const goalReminders = allReminders.filter(
      (r: Reminder) => r.type === "GOAL"
    )
    const incomeReminders = allReminders.filter(
      (r: Reminder) => r.type === "INCOME"
    )

    // Load entities
    const debts: Array<{ debt: Debt; reminders: Reminder[] }> = []
    for (const entityId of [
      ...new Set(debtReminders.map((r: Reminder) => r.entityId)),
    ]) {
      const debt = await debtRepo.findOne({ where: { id: entityId, userId } })
      if (debt) {
        debts.push({
          debt,
          reminders: debtReminders.filter(
            (r: Reminder) => r.entityId === entityId
          ),
        })
      }
    }

    const goals: Array<{ goal: Goal; reminders: Reminder[] }> = []
    for (const entityId of [
      ...new Set(goalReminders.map((r: Reminder) => r.entityId)),
    ]) {
      const goal = await goalRepo.findOne({ where: { id: entityId, userId } })
      if (goal) {
        goals.push({
          goal,
          reminders: goalReminders.filter(
            (r: Reminder) => r.entityId === entityId
          ),
        })
      }
    }

    const income: Array<{ income: IncomeSource; reminders: Reminder[] }> = []
    for (const entityId of [
      ...new Set(incomeReminders.map((r: Reminder) => r.entityId)),
    ]) {
      if (typeof entityId !== "string") continue

      const inc = await incomeRepo.findOne({
        where: { id: parseInt(entityId).toString(), userId },
      })
      if (inc) {
        income.push({
          income: inc,
          reminders: incomeReminders.filter(
            (r: Reminder) => r.entityId === entityId
          ),
        })
      }
    }

    return { debts, goals, income }
  }

  getDefaultSettings(): ReminderSettings {
    return {
      enabled: true,
      time: "09:00",
      timezone: "Asia/Tbilisi",
      channels: { telegram: true },
      notifyBefore: {
        debts: 1,
        goals: 3,
        income: 0,
      },
    }
  }

  // Replace placeholders in custom message template
  private replacePlaceholders(
    template: string,
    data: Record<string, string | number>
  ): string {
    let result = template

    Object.entries(data).forEach(([key, value]) => {
      const placeholder = `{${key}}`
      result = result.replace(new RegExp(placeholder, "g"), String(value))
    })

    return result
  }

  // Snooze reminder for specified duration
  async snoozeReminder(
    reminderId: string,
    duration: "1h" | "1d"
  ): Promise<boolean> {
    const reminderRepo = AppDataSource.getRepository(Reminder)
    const reminder = await reminderRepo.findOne({ where: { id: reminderId } })

    if (!reminder || reminder.isProcessed) {
      return false
    }

    // Calculate new reminder date
    const currentDate = dayjs(reminder.reminderDate)
    let newDate: dayjs.Dayjs

    if (duration === "1h") {
      newDate = currentDate.add(1, "hour")
    } else {
      newDate = currentDate.add(1, "day")
    }

    // Update reminder date
    await reminderRepo.update(
      { id: reminderId },
      {
        reminderDate: newDate.toDate(),
      }
    )

    return true
  }

  // Mark reminder as completed (processed)
  async completeReminder(reminderId: string): Promise<boolean> {
    const reminderRepo = AppDataSource.getRepository(Reminder)
    const reminder = await reminderRepo.findOne({ where: { id: reminderId } })

    if (!reminder) {
      return false
    }

    await this.markProcessed(reminderId)
    return true
  }
}

export const reminderManager = new ReminderManager()
