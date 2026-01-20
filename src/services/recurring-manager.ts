import { AppDataSource } from "../database/data-source"
import { RecurringTransaction } from "../database/entities/RecurringTransaction"
import { Transaction } from "../database/entities/Transaction"
import { dbStorage } from "../database/storage-db"
import { TransactionType } from "../types"
import { randomUUID } from "crypto"
import dayjs from "dayjs"

export class RecurringManager {
  async createRecurring(data: Partial<RecurringTransaction>): Promise<string> {
    const recurringRepo = AppDataSource.getRepository(RecurringTransaction)
    const id = randomUUID()

    const recurring = recurringRepo.create({
      ...data,
      id,
      nextExecutionDate: data.startDate,
      isActive: true,
    })

    await recurringRepo.save(recurring)
    return id
  }

  async getUserRecurring(userId: string): Promise<RecurringTransaction[]> {
    const recurringRepo = AppDataSource.getRepository(RecurringTransaction)
    return await recurringRepo.find({
      where: { userId },
      order: { nextExecutionDate: 'ASC' }
    })
  }

  async getDueRecurring(date?: Date): Promise<RecurringTransaction[]> {
    const recurringRepo = AppDataSource.getRepository(RecurringTransaction)
    const checkDate = date || new Date()
    const startOfDay = dayjs(checkDate).startOf('day').toDate()
    const endOfDay = dayjs(checkDate).endOf('day').toDate()

    return await recurringRepo
      .createQueryBuilder('recurring')
      .where('recurring.isActive = :isActive', { isActive: true })
      .andWhere('recurring.nextExecutionDate >= :startOfDay', { startOfDay })
      .andWhere('recurring.nextExecutionDate <= :endOfDay', { endOfDay })
      .getMany()
  }

  async executeRecurring(recurring: RecurringTransaction): Promise<void> {
    const transactionRepo = AppDataSource.getRepository(Transaction)
    const txId = randomUUID()

    const transaction = transactionRepo.create({
      id: txId,
      userId: recurring.userId,
      type: recurring.type,
      amount: recurring.amount,
      currency: recurring.currency,
      category: recurring.category,
      date: new Date(),
      description: recurring.description,
      fromAccountId: recurring.type === TransactionType.EXPENSE ? recurring.accountId : undefined,
      toAccountId: recurring.type === TransactionType.INCOME ? recurring.accountId : undefined,
    })

    await transactionRepo.save(transaction)

    if (recurring.type === TransactionType.EXPENSE) {
      await dbStorage.safeUpdateBalance(
        recurring.userId,
        recurring.accountId,
        -recurring.amount,
        recurring.currency
      )
    } else if (recurring.type === TransactionType.INCOME) {
      await dbStorage.safeUpdateBalance(
        recurring.userId,
        recurring.accountId,
        recurring.amount,
        recurring.currency
      )
    }

    const nextDate = this.calculateNextDate(recurring)
    const recurringRepo = AppDataSource.getRepository(RecurringTransaction)
    await recurringRepo.update(recurring.id, { nextExecutionDate: nextDate })

    dbStorage.clearCache(recurring.userId)
  }

  private calculateNextDate(recurring: RecurringTransaction): Date {
    const current = dayjs(recurring.nextExecutionDate)

    switch (recurring.frequency) {
      case 'DAILY':
        return current.add(1, 'day').toDate()
      case 'WEEKLY':
        return current.add(1, 'week').toDate()
      case 'MONTHLY':
        return current.add(1, 'month').toDate()
      case 'YEARLY':
        return current.add(1, 'year').toDate()
      default:
        return current.toDate()
    }
  }

  async toggleRecurring(id: string, isActive: boolean): Promise<void> {
    const recurringRepo = AppDataSource.getRepository(RecurringTransaction)
    await recurringRepo.update(id, { isActive })
  }

  async deleteRecurring(id: string): Promise<void> {
    const recurringRepo = AppDataSource.getRepository(RecurringTransaction)
    await recurringRepo.delete(id)
  }
}

export const recurringManager = new RecurringManager()
