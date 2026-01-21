import { AppDataSource } from "./data-source"
import { User } from "./entities/User"
import { Balance } from "./entities/Balance"
import { Transaction as TransactionEntity } from "./entities/Transaction"
import { Debt as DebtEntity } from "./entities/Debt"
import { Goal as GoalEntity } from "./entities/Goal"
import { Budget as BudgetEntity, BudgetPeriod } from "./entities/Budget"
import { IncomeSource as IncomeSourceEntity } from "./entities/IncomeSource"
import { CategoryPreference } from "./entities/CategoryPreference"
import {
  Balance as BalanceType,
  Debt,
  Goal,
  Transaction,
  TransactionType,
  IncomeSource,
  Currency,
  InternalCategory,
  UserData,
  ExpenseCategory,
  Budget,
  CategoryBudget,
  TransactionTemplate,
  ReminderSettings,
  TransactionCategory
} from "../types"
import { convertSync } from "../fx"
import { formatMoney, handleInsufficientFunds } from "../utils"
import { randomUUID } from "crypto"

export class DatabaseStorage {
  private userDataCache = new Map<
    string,
    { data: UserData; timestamp: number }
  >()
  private balancesCache = new Map<
    string,
    { data: BalanceType[]; timestamp: number }
  >()
  private transactionsCache = new Map<string, { data: Transaction[]; timestamp: number }>()

  private readonly CACHE_CONFIG = {
    USER_DATA: 60_000,
    BALANCES: 30_000,
    TRANSACTIONS: 20_000,
    RECENT_TRANSACTIONS: 10_000,
  }

  private isCacheValid(timestamp: number, ttl: number): boolean {
    return Date.now() - timestamp < ttl
  }

  clearCache(userId: string, type?: 'user' | 'balances' | 'transactions' | 'all') {
    if (!type || type === 'all') {
      this.userDataCache.delete(userId)
      this.balancesCache.delete(userId)
      this.transactionsCache.delete(userId)
    } else {
      switch (type) {
        case 'user':
          this.userDataCache.delete(userId)
          break
        case 'balances':
          this.balancesCache.delete(userId)
          break
        case 'transactions':
          this.transactionsCache.delete(userId)
          break
      }
    }
  }

  // --- User Methods ---

  private async ensureUser(userId: string): Promise<User> {
    const userRepo = AppDataSource.getRepository(User)
    let user = await userRepo.findOne({ where: { id: userId } })

    if (!user) {
      user = userRepo.create({
        id: userId,
        defaultCurrency: "USD",
        reminderSettings: {
          enabled: true,
          time: '09:00',
          timezone: 'Asia/Tbilisi',
          channels: { telegram: true },
          notifyBefore: { debts: 1, goals: 3, income: 0 }
        }
      })
      await userRepo.save(user)
    }

    return user
  }

  async getUserData(userId: string) {
    const cached = this.userDataCache.get(userId)
    if (cached && this.isCacheValid(cached.timestamp, this.CACHE_CONFIG.USER_DATA)) {
      return cached.data
    }

    await this.ensureUser(userId)

    const [
      balances,
      transactions,
      debts,
      goals,
      incomeSources,
      user,
      budgets
    ] = await Promise.all([
      this.getBalancesList(userId),
      this.getAllTransactions(userId),
      AppDataSource.getRepository(DebtEntity).find({ where: { userId } }),
      AppDataSource.getRepository(GoalEntity).find({ where: { userId } }),
      AppDataSource.getRepository(IncomeSourceEntity).find({ where: { userId } }),
      AppDataSource.getRepository(User).findOne({ where: { id: userId } }),
      AppDataSource.getRepository(BudgetEntity).find({ where: { userId } }),
    ])

    const result = {
      balances,
      transactions,
      debts: debts.map((d) => ({
        id: d.id,
        name: d.name,
        amount: d.amount,
        currency: d.currency,
        counterparty: d.counterparty,
        type: d.type,
        paidAmount: d.paidAmount,
        isPaid: d.isPaid,
        description: d.description,
        dueDate: d.dueDate,
        autoPayment: d.autoPayment
      })),
      goals: goals.map((g) => ({
        id: g.id,
        name: g.name,
        targetAmount: g.targetAmount,
        currentAmount: g.currentAmount,
        currency: g.currency,
        status: g.status,
        deadline: g.deadline,
        autoDeposit: g.autoDeposit
      })),
      incomeSources: incomeSources.map((s) => ({
        id: s.id.toString(),
        name: s.name,
        expectedAmount: s.expectedAmount,
        currency: s.currency,
        frequency: s.frequency,
        autoCreate: s.autoCreate
      })),
      defaultCurrency: user?.defaultCurrency || "USD",
      budgets: budgets.map((b) => ({
        id: b.id,
        category: b.category,
        amount: b.amount,
        currency: b.currency as Currency,
        period: b.period,
        createdAt: b.createdAt.toISOString(),
        updatedAt: b.updatedAt.toISOString(),
      })),
      templates: user?.templates ?? [],
    }

    this.userDataCache.set(userId, { data: result, timestamp: Date.now() })

    return result
  }

  async clearAllUserData(userId: string) {
    await Promise.all([
      AppDataSource.getRepository(TransactionEntity).delete({ userId }),
      AppDataSource.getRepository(Balance).delete({ userId }),
      AppDataSource.getRepository(DebtEntity).delete({ userId }),
      AppDataSource.getRepository(GoalEntity).delete({ userId }),
      AppDataSource.getRepository(IncomeSourceEntity).delete({ userId }),
      AppDataSource.getRepository(CategoryPreference).delete({ userId }),
    ])

    await AppDataSource.getRepository(User).delete({ id: userId })

    this.clearCache(userId)
  }

  // --- Balance Methods ---

  async getBalancesList(userId: string): Promise<BalanceType[]> {
    const cached = this.balancesCache.get(userId)
    if (cached && this.isCacheValid(cached.timestamp, this.CACHE_CONFIG.BALANCES)) {
      return cached.data
    }

    await this.ensureUser(userId)
    const balances = await AppDataSource.getRepository(Balance).find({
      where: { userId },
    })

    const result = balances.map((b) => ({
      accountId: b.accountId,
      amount: b.amount,
      currency: b.currency as Currency,
      lastUpdated: b.lastUpdated.toISOString(),
    }))

    this.balancesCache.set(userId, { data: result, timestamp: Date.now() })

    return result
  }

  async getBalances(userId: string): Promise<string> {
    const balances = await this.getBalancesList(userId)

    if (balances.length === 0) {
      return "No balances recorded."
    }

    return balances
      .map((b) => `💳 *${b.accountId}*: ${formatMoney(b.amount, b.currency)}`)
      .join("\n")
  }

  async safeUpdateBalance(
    userId: string,
    accountId: string,
    amount: number,
    currency: Currency = "USD"
  ): Promise<{ success: boolean; newBalance?: number }> {
    const balanceRepo = AppDataSource.getRepository(Balance)
    const existing = await balanceRepo.findOne({
      where: { userId, accountId, currency },
    })

    if (existing) {
      const newAmount = existing.amount + amount

      if (newAmount < 0 && amount < 0) {
        return { success: false }
      }

      existing.amount = newAmount
      existing.lastUpdated = new Date()
      await balanceRepo.save(existing)
      this.clearCache(userId)
      return { success: true, newBalance: newAmount }
    } else if (amount >= 0) {
      const newBalance = balanceRepo.create({
        userId,
        accountId,
        amount,
        currency,
      })
      await balanceRepo.save(newBalance)
      this.clearCache(userId)
      return { success: true, newBalance: amount }
    }

    return { success: false }
  }

  async addBalance(userId: string, balance: BalanceType) {
    await this.safeUpdateBalance(
      userId,
      balance.accountId,
      balance.amount,
      balance.currency
    )
    this.clearCache(userId)
  }

  async deleteBalance(
    userId: string,
    accountId: string,
    currency: Currency
  ): Promise<void> {
    await AppDataSource.getRepository(Balance).delete({
      userId,
      accountId,
      currency,
    })
    this.clearCache(userId)
  }

  async getBalance(
    userId: string,
    accountId: string,
    currency: Currency
  ): Promise<BalanceType | undefined> {
    const balance = await AppDataSource.getRepository(Balance).findOne({
      where: { userId, accountId, currency },
    })

    if (!balance) return undefined

    return {
      accountId: balance.accountId,
      amount: balance.amount,
      currency: balance.currency,
      lastUpdated: balance.lastUpdated.toISOString(),
    }
  }

  async convertBalanceAmount(
    userId: string,
    accountId: string,
    inputCurrency: Currency,
    inputAmount: number
  ) {
    const balance = await AppDataSource.getRepository(Balance).findOne({
      where: { userId, accountId },
    })

    if (balance) {
      const convertedAmount = convertSync(
        inputAmount,
        inputCurrency as Currency,
        balance.currency as Currency
      )

      balance.amount = convertedAmount
      balance.lastUpdated = new Date()
      await AppDataSource.getRepository(Balance).save(balance)
      this.clearCache(userId)
    }
  }

  async setBalanceAmountWithCurrencyChange(
    userId: string,
    accountId: string,
    newCurrency: Currency,
    newAmount: number
  ) {
    const balance = await AppDataSource.getRepository(Balance).findOne({
      where: { userId, accountId },
    })

    if (balance) {
      balance.amount = newAmount
      balance.currency = newCurrency
      balance.lastUpdated = new Date()
      await AppDataSource.getRepository(Balance).save(balance)
      this.clearCache(userId)
    }
  }

  async getBalanceAmount(
    userId: string,
    accountId: string
  ): Promise<{ amount: number; currency: Currency } | null> {
    const balance = await AppDataSource.getRepository(Balance).findOne({
      where: { userId, accountId },
    })

    if (!balance) return null

    return {
      amount: balance.amount,
      currency: balance.currency,
    }
  }

  calculateConvertedAmount(
    amount: number,
    fromCurrency: Currency,
    toCurrency: Currency
  ): number {
    return convertSync(amount, fromCurrency as Currency, toCurrency as Currency)
  }

  async updateBalanceAccountId(
    userId: string,
    oldAccountId: string,
    newAccountId: string
  ): Promise<boolean> {
    const balanceRepo = AppDataSource.getRepository(Balance)
    const balance = await balanceRepo.findOne({
      where: {
        userId,
        accountId: oldAccountId,
      },
    })

    if (!balance) return false

    balance.accountId = newAccountId
    await balanceRepo.save(balance)
    this.clearCache(userId)
    return true
  }

  async renameBalance(
    userId: string,
    oldAccountId: string,
    currency: Currency,
    newAccountId: string
  ): Promise<void> {
    await this.ensureUser(userId)

    const balanceRepo = AppDataSource.getRepository(Balance)
    const balance = await balanceRepo.findOne({
      where: { userId, accountId: oldAccountId, currency },
    })

    if (!balance) return

    balance.accountId = newAccountId
    await balanceRepo.save(balance)

    // Обновить транзакции
    const txRepo = AppDataSource.getRepository(TransactionEntity)
    await txRepo.update(
      { userId, fromAccountId: oldAccountId },
      { fromAccountId: newAccountId }
    )
    await txRepo.update(
      { userId, toAccountId: oldAccountId },
      { toAccountId: newAccountId }
    )

    this.clearCache(userId)
  }

  async convertAllBalancesToCurrency(userId: string, newCurrency: Currency) {
    const balances = await AppDataSource.getRepository(Balance).find({
      where: { userId },
    })

    for (const balance of balances) {
      if (balance.currency !== newCurrency) {
        const convertedAmount = convertSync(
          balance.amount,
          balance.currency as Currency,
          newCurrency as Currency
        )
        balance.amount = convertedAmount
        balance.currency = newCurrency
        balance.lastUpdated = new Date()
      }
    }

    await AppDataSource.getRepository(Balance).save(balances)
  }

  async getSmartBalanceSelection(
    userId: string,
    category: string
  ): Promise<string | null> {
    await this.ensureUser(userId)

    const balances = await this.getBalancesList(userId)

    if (balances.length === 0) return null

    if (balances.length === 1) return balances[0].accountId

    const nonZeroBalances = balances.filter((b) => b.amount > 0)
    if (nonZeroBalances.length === 1) return nonZeroBalances[0].accountId

    const preferred = await this.getCategoryPreferredAccount(userId, category)
    if (preferred && balances.find((b) => b.accountId === preferred)) {
      return preferred
    }

    const lastTx = await AppDataSource.getRepository(TransactionEntity)
      .createQueryBuilder("tx")
      .where("tx.userId = :userId", { userId })
      .andWhere("tx.category = :category", { category })
      .orderBy("tx.date", "DESC")
      .limit(1)
      .getOne()

    if (lastTx && lastTx.fromAccountId) {
      return lastTx.fromAccountId
    }
    if (lastTx && lastTx.toAccountId) {
      return lastTx.toAccountId
    }

    return null
  }

  // --- Transaction Methods ---

  async addTransaction(userId: string, transaction: Transaction): Promise<string> {
    await this.ensureUser(userId)

    const txRepo = AppDataSource.getRepository(TransactionEntity)
    const tx = txRepo.create({
      id: transaction.id || undefined,
      userId,
      date: transaction.date,
      amount: transaction.amount,
      currency: transaction.currency,
      type: transaction.type,
      category: transaction.category,
      description: transaction.description,
      fromAccountId: transaction.fromAccountId,
      toAccountId: transaction.toAccountId,
    })

    const saved = await txRepo.save(tx)

    if (
      transaction.type === TransactionType.INCOME &&
      transaction.toAccountId
    ) {
      await this.safeUpdateBalance(
        userId,
        transaction.toAccountId,
        transaction.amount,
        transaction.currency
      )
    } else if (
      transaction.type === TransactionType.EXPENSE &&
      transaction.fromAccountId
    ) {
      await this.safeUpdateBalance(
        userId,
        transaction.fromAccountId,
        -transaction.amount,
        transaction.currency
      )
    } else if (transaction.type === TransactionType.TRANSFER) {
      if (transaction.fromAccountId) {
        await this.safeUpdateBalance(
          userId,
          transaction.fromAccountId,
          -transaction.amount,
          transaction.currency
        )
      }
      if (transaction.toAccountId) {
        await this.safeUpdateBalance(
          userId,
          transaction.toAccountId,
          transaction.amount,
          transaction.currency
        )
      }
    }

    this.clearCache(userId, 'balances')
    this.clearCache(userId, 'transactions')
    return saved.id
  }

  async deleteTransaction(userId: string, txId: string): Promise<boolean> {
    try {
      await this.ensureUser(userId)
      const txRepo = AppDataSource.getRepository(TransactionEntity)

      const tx = await txRepo.findOne({
        where: { id: txId, userId },
      })

      if (!tx) return false

      if (
        tx.description &&
        (tx.category === InternalCategory.DEBT_REPAYMENT ||
          tx.description.startsWith("Debt Payment: "))
      ) {
        const debtName = tx.description.replace("Debt Payment: ", "").trim()

        const debt = await AppDataSource.getRepository(DebtEntity).findOne({
          where: { userId, name: debtName },
        })

        if (debt) {
          debt.paidAmount = Math.max(0, debt.paidAmount - tx.amount)
          debt.isPaid = debt.paidAmount >= debt.amount
          await AppDataSource.getRepository(DebtEntity).save(debt)
        }
      } else if (
        tx.description &&
        (tx.category === InternalCategory.GOAL_DEPOSIT ||
          tx.description.startsWith("Goal Deposit: "))
      ) {
        const goalName = tx.description.replace("Goal Deposit: ", "").trim()

        const goal = await AppDataSource.getRepository(GoalEntity).findOne({
          where: { userId, name: goalName },
        })

        if (goal) {
          goal.currentAmount = Math.max(0, goal.currentAmount - tx.amount)
          goal.status =
            goal.currentAmount >= goal.targetAmount ? "COMPLETED" : "ACTIVE"
          await AppDataSource.getRepository(GoalEntity).save(goal)
        }
      }

      const txType = tx.type as TransactionType
      const amount = tx.amount
      const currency = tx.currency as Currency

      if (txType === TransactionType.EXPENSE && tx.fromAccountId) {
        await this.safeUpdateBalance(userId, tx.fromAccountId, amount, currency)
      } else if (txType === TransactionType.INCOME && tx.toAccountId) {
        await this.safeUpdateBalance(userId, tx.toAccountId, -amount, currency)
      } else if (
        txType === TransactionType.TRANSFER &&
        tx.fromAccountId &&
        tx.toAccountId
      ) {
        await this.safeUpdateBalance(userId, tx.fromAccountId, amount, currency)
        await this.safeUpdateBalance(userId, tx.toAccountId, -amount, currency)
      }

      await txRepo.remove(tx)
      this.clearCache(userId, 'balances')
      this.clearCache(userId, 'transactions')
      return true
    } catch (error) {
      console.error("Error deleting transaction:", error)
      return false
    }
  }

  /**
   * ⚡ Lazy loading: Загрузка транзакций с пагинацией
   * @param userId - ID пользователя
   * @param limit - Количество записей
   * @param offset - Смещение (для пагинации)
   */

  async getTransactionHistory(
    userId: string,
    limit: number = 10,
    offset: number = 0
  ): Promise<Transaction[]> {
    const transactions = await AppDataSource.getRepository(
      TransactionEntity
    ).find({
      where: { userId },
      order: { date: "DESC" },
      take: limit,
      skip: offset,
    })

    return transactions.map(this.mapTransaction)
  }

  async getTransactionsByMonth(
    userId: string,
    year: number,
    month: number
  ): Promise<Transaction[]> {
    await this.ensureUser(userId)

    const startDate = new Date(year, month, 1)
    const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999)

    const transactions = await AppDataSource.getRepository(TransactionEntity)
      .createQueryBuilder('tx')
      .where('tx.userId = :userId', { userId })
      .andWhere('tx.date >= :startDate', { startDate: startDate.toISOString() })
      .andWhere('tx.date <= :endDate', { endDate: endDate.toISOString() })
      .orderBy('tx.date', 'DESC')
      .getMany()

    return transactions.map(this.mapTransaction.bind(this))
  }

  async getTransactionsByDateRange(
    userId: string,
    startDate: Date,
    endDate: Date,
    type?: TransactionType
  ): Promise<Transaction[]> {
    await this.ensureUser(userId)

    let query = AppDataSource.getRepository(TransactionEntity)
      .createQueryBuilder("tx")
      .select()
      .where("tx.userId = :userId", { userId })
      .andWhere("tx.date >= :startDate", { startDate })
      .andWhere("tx.date <= :endDate", { endDate })

    // Optional type filter - only add if specified
    if (type) {
      query = query.andWhere("tx.type = :type", { type })
    }

    const transactions = await query
      .orderBy("tx.date", "DESC")
      .cache(true)
      .getMany()

    return transactions.map(this.mapTransaction.bind(this))
  }

  async getAllTransactions(userId: string): Promise<Transaction[]> {
    const cached = this.transactionsCache.get(userId)
    if (cached && this.isCacheValid(cached.timestamp, this.CACHE_CONFIG.TRANSACTIONS)) {
      return cached.data
    }

    await this.ensureUser(userId)

    const transactions = await AppDataSource.getRepository(TransactionEntity)
      .createQueryBuilder("tx")
      .where("tx.userId = :userId", { userId })
      .orderBy("tx.date", "DESC")
      .getMany()

    const result = transactions.map(this.mapTransaction.bind(this))

    this.transactionsCache.set(userId, { data: result, timestamp: Date.now() })

    return result
  }

  async getTransactionById(
    userId: string,
    txId: string
  ): Promise<Transaction | undefined> {
    const tx = await AppDataSource.getRepository(TransactionEntity).findOne({
      where: { id: txId, userId },
    })

    return tx ? this.mapTransaction(tx) : undefined
  }

  private mapTransaction(tx: TransactionEntity): Transaction {
    return {
      id: tx.id,
      date: tx.date,
      amount: tx.amount,
      currency: tx.currency,
      type: tx.type,
      category: tx.category,
      description: tx.description,
      fromAccountId: tx.fromAccountId,
      toAccountId: tx.toAccountId,
    }
  }

  async getRecentTransactions(
    userId: string,
    limit: number = 5
  ): Promise<Transaction[]> {
    const allTransactions = await this.getAllTransactions(userId)
    return allTransactions.slice(0, limit)
  }

  async updateTransaction(
    userId: string,
    txId: string,
    updates: Partial<Transaction>
  ): Promise<boolean> {
    try {
      await this.ensureUser(userId)
      const txRepo = AppDataSource.getRepository(TransactionEntity)

      const transaction = await txRepo.findOne({
        where: { id: txId, userId },
      })

      if (!transaction) return false

      const oldAmount = transaction.amount
      const oldCurrency = transaction.currency
      const oldFromAccount = transaction.fromAccountId
      const oldToAccount = transaction.toAccountId

      if (updates.amount !== undefined) transaction.amount = updates.amount
      if (updates.currency !== undefined)
        transaction.currency = updates.currency
      if (updates.category !== undefined)
        transaction.category = updates.category
      if (updates.fromAccountId !== undefined)
        transaction.fromAccountId = updates.fromAccountId
      if (updates.toAccountId !== undefined)
        transaction.toAccountId = updates.toAccountId

      await txRepo.save(transaction)

      if (
        updates.amount !== undefined ||
        updates.currency !== undefined ||
        updates.fromAccountId !== undefined ||
        updates.toAccountId !== undefined
      ) {
        const txType = transaction.type as TransactionType

        if (txType === TransactionType.EXPENSE && oldFromAccount) {
          await this.safeUpdateBalance(
            userId,
            oldFromAccount,
            oldAmount,
            oldCurrency as Currency
          )
        } else if (txType === TransactionType.INCOME && oldToAccount) {
          await this.safeUpdateBalance(
            userId,
            oldToAccount,
            -oldAmount,
            oldCurrency as Currency
          )
        } else if (
          txType === TransactionType.TRANSFER &&
          oldFromAccount &&
          oldToAccount
        ) {
          await this.safeUpdateBalance(
            userId,
            oldFromAccount,
            oldAmount,
            oldCurrency as Currency
          )
          await this.safeUpdateBalance(
            userId,
            oldToAccount,
            -oldAmount,
            oldCurrency as Currency
          )
        }

        const newFromAccount = transaction.fromAccountId || oldFromAccount
        const newToAccount = transaction.toAccountId || oldToAccount
        const newAmount = transaction.amount
        const newCurrency = transaction.currency as Currency

        if (txType === TransactionType.EXPENSE && newFromAccount) {
          await this.safeUpdateBalance(
            userId,
            newFromAccount,
            -newAmount,
            newCurrency
          )
        } else if (txType === TransactionType.INCOME && newToAccount) {
          await this.safeUpdateBalance(
            userId,
            newToAccount,
            newAmount,
            newCurrency
          )
        } else if (
          txType === TransactionType.TRANSFER &&
          newFromAccount &&
          newToAccount
        ) {
          await this.safeUpdateBalance(
            userId,
            newFromAccount,
            -newAmount,
            newCurrency
          )
          await this.safeUpdateBalance(
            userId,
            newToAccount,
            newAmount,
            newCurrency
          )
        }
      }

      this.clearCache(userId, 'balances')
      this.clearCache(userId, 'transactions')
      return true
    } catch (error) {
      console.error("Error updating transaction:", error)
      return false
    }
  }

  // --- Debt Methods ---

  async getDebts(userId: string): Promise<string> {
    await this.ensureUser(userId)
    const debts = await AppDataSource.getRepository(DebtEntity).find({
      where: { userId, isPaid: false },
    })

    if (debts.length === 0) {
      return "You have no active debts."
    }

    const iOwe = debts.filter((d) => d.type === "I_OWE")
    const owesMe = debts.filter((d) => d.type === "OWES_ME")

    let response = ""

    if (iOwe.length > 0) {
      response += `*Your debt${iOwe.length > 1 ? "s" : ""}:*\n`
      response += iOwe
        .map((d) => {
          let result = `*${d.counterparty}*: ${formatMoney(d.amount, d.currency)}`
          if (d.paidAmount > 0)
            result += ` Paid: ${formatMoney(d.paidAmount, d.currency)} Left: ${formatMoney(d.amount - d.paidAmount, d.currency)}`
          return result
        })
        .join("\n")
      response += "\n\n"
    }

    if (owesMe.length > 0) {
      response += `*Debt${owesMe.length > 1 ? "s" : ""} from you:*\n`
      response += owesMe
        .map((d) => {
          let result = `*${d.counterparty}*: ${formatMoney(d.amount, d.currency)}`
          if (d.paidAmount > 0)
            result += ` Paid: ${formatMoney(d.paidAmount, d.currency)} Left: ${formatMoney(d.amount - d.paidAmount, d.currency)}`
          return result
        })
        .join("\n")
    }

    return response || "No debts found."
  }

  async addDebt(userId: string, debt: Debt) {
    await this.ensureUser(userId)
    const debtRepo = AppDataSource.getRepository(DebtEntity)
    const newDebt = debtRepo.create({
      id: debt.id,
      userId,
      name: debt.name,
      amount: debt.amount,
      currency: debt.currency,
      counterparty: debt.counterparty,
      type: debt.type,
      paidAmount: debt.paidAmount || 0,
      isPaid: debt.isPaid || false,
      description: debt.description,
    })

    await debtRepo.save(newDebt)
  }

  async updateDebtAmount(
    userId: string,
    debtId: string,
    payAmount: number,
    accountId: string,
    currency: Currency
  ): Promise<{ success: boolean; message?: string }> {
    await this.ensureUser(userId)

    const debtRepo = AppDataSource.getRepository(DebtEntity)
    const debt = await debtRepo.findOne({ where: { id: debtId, userId } })

    if (!debt) {
      return { success: false, message: "❌ Debt not found." }
    }

    if (debt.currency !== currency) {
      return {
        success: false,
        message: `❌ Currency mismatch: debt in ${debt.currency}, payment in ${currency}.`,
      }
    }

    const remaining = debt.amount - debt.paidAmount
    if (payAmount > remaining) {
      return {
        success: false,
        message: `❌ Amount exceeds remaining debt (${formatMoney(remaining, debt.currency)}).`,
      }
    }

    debt.paidAmount += payAmount
    debt.isPaid = debt.paidAmount >= debt.amount

    await debtRepo.save(debt)

    const transaction: Transaction = {
      id: randomUUID(),
      date: new Date(),
      currency: currency,
      description: `Debt Payment ${debt.name}`,
      amount: payAmount,
      type: TransactionType.TRANSFER,
      category: InternalCategory.DEBT_REPAYMENT,
      fromAccountId: debt.type === "I_OWE" && accountId,
      toAccountId: debt.type === "OWES_ME" && accountId,
    }

    await this.addTransaction(userId, transaction)

    this.clearCache(userId)
    return { success: true }
  }

  async getDebtById(userId: string, debtId: string): Promise<Debt | undefined> {
    const debt = await AppDataSource.getRepository(DebtEntity).findOne({
      where: { id: debtId, userId },
    })

    if (!debt) return undefined

    return {
      id: debt.id,
      name: debt.name,
      amount: debt.amount,
      currency: debt.currency,
      counterparty: debt.counterparty,
      type: debt.type,
      paidAmount: debt.paidAmount,
      isPaid: debt.isPaid,
      description: debt.description,
    }
  }

  async updateDebt(
    userId: string,
    debtId: string,
    updates: Partial<Debt>
  ): Promise<void> {
    const debtRepo = AppDataSource.getRepository(DebtEntity)
    const debt = await debtRepo.findOne({ where: { id: debtId, userId } })

    if (!debt) return

    if (updates.amount !== undefined) debt.amount = updates.amount
    if (updates.currency !== undefined) debt.currency = updates.currency
    if (updates.paidAmount !== undefined) debt.paidAmount = updates.paidAmount

    if (debt.paidAmount > debt.amount) {
      debt.paidAmount = debt.amount
    }

    debt.isPaid = debt.paidAmount >= debt.amount

    await debtRepo.save(debt)
    this.clearCache(userId)
  }

  async deleteDebt(userId: string, debtId: string): Promise<void> {
    await AppDataSource.getRepository(DebtEntity).delete({
      id: debtId,
      userId,
    })
    this.clearCache(userId)
  }

  async updateDebtTotalAmount(
    userId: string,
    debtId: string,
    newAmount: number,
    newCurrency?: Currency
  ): Promise<{ success: boolean; message?: string }> {
    const debtRepo = AppDataSource.getRepository(DebtEntity)
    const debt = await debtRepo.findOne({ where: { id: debtId, userId } })

    if (!debt) {
      return { success: false, message: "❌ Debt not found." }
    }

    debt.amount = newAmount
    if (newCurrency) {
      debt.currency = newCurrency
    }

    if (debt.paidAmount > newAmount) {
      debt.paidAmount = newAmount
    }

    debt.isPaid = debt.paidAmount >= debt.amount

    await debtRepo.save(debt)
    this.clearCache(userId)

    return { success: true }
  }

  // --- Goal Methods ---

  async getGoals(userId: string): Promise<string> {
    await this.ensureUser(userId)
    const goals = await AppDataSource.getRepository(GoalEntity).find({
      where: { userId },
    })

    if (goals.length === 0) {
      return "No active financial goals."
    }

    return goals
      .map((g) => {
        const percent =
          g.targetAmount > 0
            ? Math.round((g.currentAmount / g.targetAmount) * 100)
            : 0
        const bar =
          "▓".repeat(Math.floor(percent / 10)) +
          "░".repeat(10 - Math.floor(percent / 10))
        return `🎯 *${g.name}*\n${bar} ${percent}%\nTarget: ${formatMoney(
          g.targetAmount,
          g.currency
        )}\nSaved: ${formatMoney(g.currentAmount, g.currency)}`
      })
      .join("\n\n")
  }

  async addGoal(userId: string, goal: Goal) {
    await this.ensureUser(userId)
    const goalRepo = AppDataSource.getRepository(GoalEntity)
    const newGoal = goalRepo.create({
      id: goal.id,
      userId,
      name: goal.name,
      targetAmount: goal.targetAmount,
      currentAmount: goal.currentAmount || 0,
      currency: goal.currency,
      status: goal.status || "ACTIVE",
    })

    await goalRepo.save(newGoal)
  }

  async depositToGoal(
    userId: string,
    goalId: string,
    amount: number,
    accountId: string,
    currency: Currency
  ): Promise<{ success: boolean; message?: string }> {
    const goalRepo = AppDataSource.getRepository(GoalEntity)
    const goal = await goalRepo.findOne({ where: { id: goalId, userId } })

    if (!goal) {
      return { success: false, message: "❌ Goal not found" }
    }

    const balances = await this.getBalancesList(userId)
    const balance = balances.find((b) => b.accountId === accountId)

    if (!balance) {
      return { success: false, message: `❌ Account "${accountId}" not found` }
    }

    const amountInAccountCurrency = convertSync(
      amount,
      currency as Currency,
      balance.currency as Currency
    )

    if (balance.amount < amountInAccountCurrency) {
      return {
        success: false,
        message: handleInsufficientFunds(
          accountId,
          balance.amount,
          balance.currency,
          amountInAccountCurrency
        ),
      }
    }
    const transaction: Transaction = {
      id: randomUUID(),
      date: new Date(),
      amount: amount,
      currency: currency,
      type: TransactionType.TRANSFER,
      category: InternalCategory.GOAL_DEPOSIT,
      description: `Goal Deposit: ${goal.name}`,
      fromAccountId: accountId,
    }

    await this.addTransaction(userId, transaction)

    goal.currentAmount += amount
    goal.status =
      goal.currentAmount >= goal.targetAmount ? "COMPLETED" : "ACTIVE"
    await goalRepo.save(goal)
    this.clearCache(userId)

    return { success: true }
  }

  async getGoalById(userId: string, goalId: string): Promise<Goal | undefined> {
    const goal = await AppDataSource.getRepository(GoalEntity).findOne({
      where: { id: goalId, userId },
    })

    if (!goal) return undefined

    return {
      id: goal.id,
      name: goal.name,
      targetAmount: goal.targetAmount,
      currentAmount: goal.currentAmount,
      currency: goal.currency,
      status: goal.status,
    }
  }

  async deleteGoal(userId: string, goalId: string): Promise<void> {
    await AppDataSource.getRepository(GoalEntity).delete({
      id: goalId,
      userId,
    })
    this.clearCache(userId)
  }

  async updateGoal(
    userId: string,
    goalId: string,
    updates: Partial<{
      targetAmount: number
      currency: Currency
      currentAmount: number
      status: "ACTIVE" | "COMPLETED"
    }>
  ) {
    const goalRepo = AppDataSource.getRepository(GoalEntity)
    const goal = await goalRepo.findOne({ where: { id: goalId, userId } })

    if (!goal) return

    if (updates.targetAmount !== undefined)
      goal.targetAmount = updates.targetAmount
    if (updates.currency !== undefined) goal.currency = updates.currency
    if (updates.currentAmount !== undefined)
      goal.currentAmount = updates.currentAmount
    if (updates.status !== undefined) goal.status = updates.status

    if (goal.currentAmount >= goal.targetAmount) {
      goal.status = "COMPLETED"
    }

    await goalRepo.save(goal)
    this.clearCache(userId)
  }

  async updateGoalTarget(
    userId: string,
    goalId: string,
    newTarget: number,
    newCurrency?: Currency
  ): Promise<{ success: boolean; message?: string }> {
    const goalRepo = AppDataSource.getRepository(GoalEntity)
    const goal = await goalRepo.findOne({ where: { id: goalId, userId } })

    if (!goal) {
      return { success: false, message: "❌ Goal not found." }
    }

    if (newTarget < goal.currentAmount) {
      return {
        success: false,
        message: `❌ New target (${newTarget}) cannot be less than current amount (${goal.currentAmount}).`,
      }
    }

    goal.targetAmount = newTarget
    if (newCurrency) {
      goal.currency = newCurrency
    }

    goal.status =
      goal.currentAmount >= goal.targetAmount ? "COMPLETED" : "ACTIVE"

    await goalRepo.save(goal)
    this.clearCache(userId)

    return { success: true }
  }

  async markGoalComplete(userId: string, goalId: string): Promise<void> {
    const goalRepo = AppDataSource.getRepository(GoalEntity)
    const goal = await goalRepo.findOne({ where: { id: goalId, userId } })

    if (goal) {
      goal.status = "COMPLETED"
      await goalRepo.save(goal)
      this.clearCache(userId)
    }
  }

  async updateGoalTargetAmount(
    userId: string,
    goalId: string,
    newTarget: number
  ): Promise<void> {
    const goal = await AppDataSource.getRepository(GoalEntity).findOne({
      where: { id: goalId, userId },
    })

    if (goal) {
      goal.targetAmount = newTarget
      goal.status = goal.currentAmount >= newTarget ? "COMPLETED" : "ACTIVE"
      await AppDataSource.getRepository(GoalEntity).save(goal)
      this.clearCache(userId)
    }
  }

  // --- Income Source Methods ---

  async getIncomeSources(userId: string): Promise<string> {
    await this.ensureUser(userId)
    const sources = await AppDataSource.getRepository(IncomeSourceEntity).find({
      where: { userId },
    })

    if (sources.length === 0) {
      return "No income sources recorded."
    }

    return sources
      .map(
        (i) =>
          `💵 *${i.name}*: ${i.expectedAmount && i.currency
            ? formatMoney(i.expectedAmount, i.currency)
            : "N/A"
          }`
      )
      .join("\n")
  }

  async addIncomeSource(userId: string, source: IncomeSource) {
    await this.ensureUser(userId)
    const sourceRepo = AppDataSource.getRepository(IncomeSourceEntity)
    const newSource = sourceRepo.create({
      userId,
      name: source.name,
      expectedAmount: source.expectedAmount,
      currency: source.currency,
      frequency: source.frequency,
    })

    await sourceRepo.save(newSource)
  }

  async deleteIncomeSource(userId: string, name: string) {
    await AppDataSource.getRepository(IncomeSourceEntity).delete({
      userId,
      name,
    })
  }

  async updateIncomeSourceName(
    userId: string,
    oldName: string,
    newName: string
  ): Promise<void> {
    await this.ensureUser(userId)
    const incomeSourceRepo = AppDataSource.getRepository(IncomeSourceEntity)
    const source = await incomeSourceRepo.findOne({
      where: { userId, name: oldName },
    })
    if (!source) return
    source.name = newName
    await incomeSourceRepo.save(source)
    this.clearCache(userId)
  }

  async updateIncomeSourceAmount(
    userId: string,
    name: string,
    amount: number,
    currency: Currency
  ): Promise<void> {
    await this.ensureUser(userId)
    const incomeSourceRepo = AppDataSource.getRepository(IncomeSourceEntity)
    const source = await incomeSourceRepo.findOne({ where: { userId, name } })
    if (!source) return
    source.expectedAmount = amount
    source.currency = currency
    await incomeSourceRepo.save(source)
    this.clearCache(userId)
  }

  // --- Currency Methods ---

  async getDefaultCurrency(userId: string): Promise<Currency> {
    const user = await this.ensureUser(userId)
    return user.defaultCurrency
  }

  async setDefaultCurrency(userId: string, currency: Currency) {
    const user = await this.ensureUser(userId)
    user.defaultCurrency = currency
    await AppDataSource.getRepository(User).save(user)
  }

  getCurrencyDenominations(currency: Currency): number[] {
    const denominations: Record<Currency, number[]> = {
      USD: [5, 10, 20, 50, 100],
      EUR: [5, 10, 20, 50, 100],
      GEL: [5, 10, 20, 50, 100, 200],
      RUB: [100, 200, 500, 1000, 2000],
      UAH: [20, 50, 100, 200, 500],
      PLN: [10, 20, 50, 100, 200],
    }
    return denominations[currency] || denominations.USD
  }

  // --- Categories Methods ---

  async getTopCategories(
    userId: string,
    txType: TransactionType,
    limit: number = 5,
    days: number = 30
  ): Promise<string[]> {
    await this.ensureUser(userId)

    const since = new Date()
    since.setDate(since.getDate() - days)

    const transactions = await AppDataSource.getRepository(TransactionEntity)
      .createQueryBuilder("tx")
      .where("tx.userId = :userId", { userId })
      .andWhere("tx.type = :txType", { txType })
      .andWhere("tx.date >= :since", { since: since.toISOString() })
      .getMany()

    const categoryStats: Record<
      string,
      { count: number; totalAmount: number }
    > = {}

    transactions.forEach((tx) => {
      if (!categoryStats[tx.category]) {
        categoryStats[tx.category] = { count: 0, totalAmount: 0 }
      }
      categoryStats[tx.category].count++
      categoryStats[tx.category].totalAmount += tx.amount
    })

    const scored = Object.entries(categoryStats)
      .map(([category, stats]) => ({
        category,
        score: stats.count * (stats.totalAmount / stats.count),
      }))
      .sort((a, b) => b.score - a.score)
      .map((item) => item.category)

    return scored.slice(0, limit)
  }

  async getCategoryPreferredAccount(
    userId: string,
    category: string
  ): Promise<string | null> {
    await this.ensureUser(userId)

    const pref = await AppDataSource.getRepository(CategoryPreference).findOne({
      where: { userId, category },
    })

    return pref?.preferredAccountId || null
  }

  async setCategoryPreferredAccount(
    userId: string,
    category: string,
    accountId: string
  ): Promise<void> {
    await this.ensureUser(userId)

    const repo = AppDataSource.getRepository(CategoryPreference)
    let pref = await repo.findOne({ where: { userId, category } })

    if (pref) {
      pref.preferredAccountId = accountId
      pref.useCount++
      pref.lastUsed = new Date()
    } else {
      pref = repo.create({
        userId,
        category,
        preferredAccountId: accountId,
        useCount: 1,
        lastUsed: new Date(),
      })
    }

    await repo.save(pref)
    this.clearCache(userId)
  }

  async getCategoryBudgets(
    userId: string
  ): Promise<Record<string, CategoryBudget>> {
    await this.ensureUser(userId)
    const userData = await this.getUserData(userId)

    // Группируем бюджеты по категории
    const budgetsByCategory: Record<string, Budget> = {}
    userData.budgets.forEach((budget) => {
      budgetsByCategory[budget.category] = budget
    })

    // Вычисляем потраченное по категориям за текущий месяц
    const now = new Date()
    const transactions = await this.getTransactionsByMonth(
      userId,
      now.getFullYear(),
      now.getMonth() + 1
    )

    const spentByCategory: Record<string, number> = {}
    transactions
      .filter((t) => t.type === "EXPENSE")
      .forEach((t) => {
        spentByCategory[t.category] =
          (spentByCategory[t.category] || 0) + t.amount
      })

    // Формируем результат
    const result: Record<string, CategoryBudget> = {}

    Object.entries(budgetsByCategory).forEach(([category, budget]) => {
      result[category] = {
        limit: budget.amount,
        spent: spentByCategory[category] || 0,
        currency: budget.currency as Currency,
      }
    })

    return result
  }

  async setCategoryBudget(
    userId: string,
    category: ExpenseCategory,
    limit: number,
    currency: Currency,
    period: BudgetPeriod = BudgetPeriod.MONTHLY
  ): Promise<void> {
    await this.ensureUser(userId)

    // Проверить существующий бюджет
    const existing = await AppDataSource.getRepository(BudgetEntity).findOne({
      where: { userId, category },
    })

    const repo = AppDataSource.getRepository(BudgetEntity)
    if (existing) {
      // Обновить
      await repo.update(existing.id, { amount: limit, currency, period })
    } else {
      // Создать новый
      const budget = repo.create({
        userId,
        category,
        amount: limit,
        currency,
        period,
      })
      await repo.save(budget)
    }

    this.clearCache(userId)
  }

  async clearCategoryBudget(
    userId: string,
    category: ExpenseCategory
  ): Promise<void> {
    await this.ensureUser(userId)
    const repo = AppDataSource.getRepository(BudgetEntity)
    await repo.delete({ userId, category })
    this.clearCache(userId)
  }

  async applyExpenseToBudgets(
    userId: string,
    category: ExpenseCategory,
    amount: number,
    currency: Currency
  ): Promise<{ overLimit: boolean; remaining?: number; limit?: number }> {
    await this.ensureUser(userId)

    // Найти бюджет
    const repo = AppDataSource.getRepository(BudgetEntity)
    const budget = await repo.findOne({ where: { userId, category } })

    if (!budget || budget.currency !== currency) {
      return { overLimit: false }
    }

    // Получить траты за текущий период (месяц)
    const now = new Date()
    const transactions = await this.getTransactionsByMonth(
      userId,
      now.getFullYear(),
      now.getMonth() + 1
    )

    const periodSpent = transactions
      .filter((t) => t.type === "EXPENSE" && t.category === category)
      .reduce((sum, t) => sum + t.amount, 0)

    const overLimit = periodSpent > Number(budget.amount)
    const remaining = Number(budget.amount) - periodSpent

    return {
      overLimit,
      remaining: overLimit ? 0 : remaining,
      limit: Number(budget.amount),
    }
  }

  // --- Template Methods ---
  async getTemplates(userId: string): Promise<TransactionTemplate[]> {
    const user = await this.ensureUser(userId)
    const templates = user.templates ?? []

    // Миграция: добавить currency к старым шаблонам
    let needsSave = false
    const migratedTemplates = templates.map(t => {
      if (!t.currency) {
        needsSave = true
        return { ...t, currency: user.defaultCurrency }
      }
      return t
    })

    if (needsSave) {
      const userRepo = AppDataSource.getRepository(User)
      user.templates = migratedTemplates
      await userRepo.save(user)
      this.clearCache(userId)
    }

    return migratedTemplates
  }

  async addTemplate(
    userId: string,
    template: Omit<TransactionTemplate, "id">
  ): Promise<void> {
    const userRepo = AppDataSource.getRepository(User)
    const user = await this.ensureUser(userId)

    const existing = user.templates ?? []
    const newTemplate: TransactionTemplate = {
      ...template,
      id: randomUUID(),
    }

    user.templates = [...existing, newTemplate]
    await userRepo.save(user)
    this.clearCache(userId)
  }

  async deleteTemplate(userId: string, templateId: string): Promise<boolean> {
    const userRepo = AppDataSource.getRepository(User)
    const user = await this.ensureUser(userId)

    const existing = user.templates ?? []
    const filtered = existing.filter((t) => t.id !== templateId)

    if (filtered.length === existing.length) {
      return false // Template not found
    }

    user.templates = filtered
    await userRepo.save(user)
    this.clearCache(userId)
    return true
  }

  async updateTemplateAmount(
    userId: string,
    templateId: string,
    newAmount: number
  ): Promise<boolean> {
    const userRepo = AppDataSource.getRepository(User)
    const user = await this.ensureUser(userId)

    const templates = user.templates ?? []
    const template = templates.find((t) => t.id === templateId)

    if (!template) return false

    template.amount = newAmount
    user.templates = templates
    await userRepo.save(user)
    this.clearCache(userId)
    return true
  }

  async updateTemplateAccount(
    userId: string,
    templateId: string,
    accountId: string
  ): Promise<boolean> {
    const userRepo = AppDataSource.getRepository(User)
    const user = await this.ensureUser(userId)

    const templates = user.templates ?? []
    const template = templates.find((t) => t.id === templateId)

    if (!template) return false

    template.accountId = accountId
    user.templates = templates
    await userRepo.save(user)
    this.clearCache(userId)
    return true
  }

  // --- Utility Methods ---

  async getTopTransactionAmounts(
    userId: string,
    txType: TransactionType,
    limit: number = 5
  ): Promise<Array<{ amount: number; count: number }>> {
    const userData = await this.getUserData(userId)

    const transactions = userData.transactions.filter(
      (tx: Transaction) => tx.type === txType
    )

    if (transactions.length === 0) {
      return []
    }

    // Group by rounded amount
    const amountMap = new Map<number, number>()

    for (const tx of transactions) {
      const roundedAmount = Math.round(tx.amount)
      if (amountMap.has(roundedAmount)) {
        amountMap.set(roundedAmount, amountMap.get(roundedAmount)! + 1)
      } else {
        amountMap.set(roundedAmount, 1)
      }
    }

    // Sort by frequency (desc), then by amount (asc)
    const sorted = Array.from(amountMap.entries())
      .map(([amount, count]) => ({ amount, count }))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count
        return a.amount - b.amount
      })
      .slice(0, limit)

    return sorted
  }

  // --- Account Change Methods ---
  async changeTransactionAccount(
    userId: string,
    txId: string,
    newAccountId: string
  ): Promise<{ success: boolean; message?: string }> {
    const txRepo = AppDataSource.getRepository(TransactionEntity)
    const transaction = await txRepo.findOne({ where: { id: txId, userId } })

    if (!transaction) {
      return { success: false, message: "Transaction not found" }
    }

    const oldAccountId =
      transaction.type === TransactionType.EXPENSE
        ? transaction.fromAccountId
        : transaction.toAccountId

    if (oldAccountId === newAccountId) {
      return { success: false, message: "Same account selected" }
    }

    // Откатить баланс со старого счёта
    if (oldAccountId) {
      if (transaction.type === TransactionType.EXPENSE) {
        await this.safeUpdateBalance(
          userId,
          oldAccountId,
          transaction.amount,
          transaction.currency as Currency
        )
      } else if (transaction.type === TransactionType.INCOME) {
        await this.safeUpdateBalance(
          userId,
          oldAccountId,
          -transaction.amount,
          transaction.currency as Currency
        )
      }
    }

    // Применить на новый счёт
    if (transaction.type === TransactionType.EXPENSE) {
      const result = await this.safeUpdateBalance(
        userId,
        newAccountId,
        -transaction.amount,
        transaction.currency as Currency
      )
      if (!result.success) {
        // Откатить обратно если не хватает средств
        if (oldAccountId) {
          await this.safeUpdateBalance(
            userId,
            oldAccountId,
            -transaction.amount,
            transaction.currency as Currency
          )
        }
        return { success: false, message: "Insufficient funds on new account" }
      }
      transaction.fromAccountId = newAccountId
    } else if (transaction.type === TransactionType.INCOME) {
      await this.safeUpdateBalance(
        userId,
        newAccountId,
        transaction.amount,
        transaction.currency as Currency
      )
      transaction.toAccountId = newAccountId
    }

    await txRepo.save(transaction)
    this.clearCache(userId)
    return { success: true }
  }

  // --- Reminder Settings Methods ---
  async getReminderSettings(userId: string): Promise<ReminderSettings | undefined> {
    const userRepo = AppDataSource.getRepository(User)
    const user = await this.ensureUser(userId)
    return user.reminderSettings
  }

  async updateReminderSettings(userId: string, settings: ReminderSettings): Promise<void> {
    const userRepo = AppDataSource.getRepository(User)
    const user = await this.ensureUser(userId)
    user.reminderSettings = settings
    await userRepo.save(user)
    this.clearCache(userId)
  }

  // --- Debt/Goal Date Management Methods ---
  async updateDebtDueDate(userId: string, debtId: string, dueDate: Date | null): Promise<void> {
    const debtRepo = AppDataSource.getRepository(DebtEntity)
    await debtRepo.update({ id: debtId, userId }, { dueDate })
    this.clearCache(userId)
  }

  async updateGoalDeadline(userId: string, goalId: string, deadline: Date | null): Promise<void> {
    const goalRepo = AppDataSource.getRepository(GoalEntity)
    await goalRepo.update({ id: goalId, userId }, { deadline })
    this.clearCache(userId)
  }

  // --- Transaction Pagination Methods ---
  async getTransactionsPaginated(
    userId: string,
    page: number = 1,
    limit: number = 20,
    filters?: {
      type?: TransactionType
      category?: string
      startDate?: Date
      endDate?: Date
    }
  ): Promise<{ transactions: Transaction[]; total: number; hasMore: boolean }> {
    const query = AppDataSource.getRepository(TransactionEntity)
      .createQueryBuilder('tx')
      .where('tx.userId = :userId', { userId })

    if (filters?.type) {
      query.andWhere('tx.type = :type', { type: filters.type })
    }
    if (filters?.category) {
      query.andWhere('tx.category = :category', { category: filters.category })
    }
    if (filters?.startDate) {
      query.andWhere('tx.date >= :startDate', { startDate: filters.startDate })
    }
    if (filters?.endDate) {
      query.andWhere('tx.date <= :endDate', { endDate: filters.endDate })
    }

    const skip = (page - 1) * limit
    const [transactions, total] = await query
      .orderBy('tx.date', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount()

    return {
      transactions: transactions.map(this.mapTransaction.bind(this)),
      total,
      hasMore: skip + transactions.length < total
    }
  }

  // --- Batch Operations (Priority 8) ---
  async addTransactionsBatch(
    userId: string,
    transactions: Transaction[]
  ): Promise<{ added: number; errors: string[] }> {
    if (transactions.length === 0) {
      return { added: 0, errors: [] }
    }

    await this.ensureUser(userId)

    const errors: string[] = []
    let addedCount = 0

    await AppDataSource.transaction(async (manager) => {
      const entities = transactions.map((tx) => {
        if (!tx.id) {
          tx.id = randomUUID()
        }

        return manager.create(TransactionEntity, {
          id: tx.id,
          userId,
          date: tx.date,
          amount: tx.amount,
          currency: tx.currency,
          type: tx.type,
          category: tx.category,
          description: tx.description,
          fromAccountId: tx.fromAccountId,
          toAccountId: tx.toAccountId,
        })
      })

      try {
        await manager.save(TransactionEntity, entities)
        addedCount = entities.length
      } catch (error) {
        errors.push(`Failed to save transactions: ${error}`)
        throw error
      }

      const balanceUpdates = new Map<string, { amount: number; currency: Currency }>()

      transactions.forEach((tx) => {
        if (tx.type === TransactionType.EXPENSE && tx.fromAccountId) {
          const key = `${tx.fromAccountId}:${tx.currency}`
          const current = balanceUpdates.get(key) || { amount: 0, currency: tx.currency as Currency }
          balanceUpdates.set(key, {
            amount: current.amount - tx.amount,
            currency: tx.currency as Currency,
          })
        }

        if (tx.type === TransactionType.INCOME && tx.toAccountId) {
          const key = `${tx.toAccountId}:${tx.currency}`
          const current = balanceUpdates.get(key) || { amount: 0, currency: tx.currency as Currency }
          balanceUpdates.set(key, {
            amount: current.amount + tx.amount,
            currency: tx.currency as Currency,
          })
        }

        if (tx.type === TransactionType.TRANSFER) {
          if (tx.fromAccountId) {
            const key = `${tx.fromAccountId}:${tx.currency}`
            const current = balanceUpdates.get(key) || { amount: 0, currency: tx.currency as Currency }
            balanceUpdates.set(key, {
              amount: current.amount - tx.amount,
              currency: tx.currency as Currency,
            })
          }
          if (tx.toAccountId) {
            const key = `${tx.toAccountId}:${tx.currency}`
            const current = balanceUpdates.get(key) || { amount: 0, currency: tx.currency as Currency }
            balanceUpdates.set(key, {
              amount: current.amount + tx.amount,
              currency: tx.currency as Currency,
            })
          }
        }
      })

      for (const [key, delta] of balanceUpdates) {
        const [accountId, currency] = key.split(':')

        try {
          const balance = await manager.findOne(Balance, {
            where: { userId, accountId, currency: currency as Currency },
          })

          if (balance) {
            balance.amount += delta.amount
            balance.lastUpdated = new Date()
            await manager.save(Balance, balance)
          } else {
            if (delta.amount >= 0) {
              const newBalance = manager.create(Balance, {
                userId,
                accountId,
                currency: currency as Currency,
                amount: delta.amount,
                lastUpdated: new Date(),
              })
              await manager.save(Balance, newBalance)
            } else {
              errors.push(`Cannot create negative balance for ${accountId}`)
            }
          }
        } catch (error) {
          errors.push(`Failed to update balance for ${accountId}: ${error}`)
          throw error
        }
      }
    })

    this.clearCache(userId)

    return { added: addedCount, errors }
  }

  validateTransactionsBatch(transactions: Transaction[]): {
    valid: Transaction[]
    invalid: Array<{ transaction: Transaction; reason: string }>
  } {
    const valid: Transaction[] = []
    const invalid: Array<{ transaction: Transaction; reason: string }> = []

    transactions.forEach((tx) => {
      if (!tx.amount || tx.amount <= 0) {
        invalid.push({ transaction: tx, reason: 'Invalid amount' })
        return
      }

      if (!tx.type) {
        invalid.push({ transaction: tx, reason: 'Missing type' })
        return
      }

      if (!tx.currency) {
        invalid.push({ transaction: tx, reason: 'Missing currency' })
        return
      }

      if (!tx.category) {
        invalid.push({ transaction: tx, reason: 'Missing category' })
        return
      }

      if (tx.type === TransactionType.EXPENSE && !tx.fromAccountId) {
        invalid.push({ transaction: tx, reason: 'EXPENSE requires fromAccountId' })
        return
      }

      if (tx.type === TransactionType.INCOME && !tx.toAccountId) {
        invalid.push({ transaction: tx, reason: 'INCOME requires toAccountId' })
        return
      }

      if (tx.type === TransactionType.TRANSFER) {
        if (!tx.fromAccountId || !tx.toAccountId) {
          invalid.push({ transaction: tx, reason: 'TRANSFER requires both accounts' })
          return
        }
      }

      valid.push(tx)
    })

    return { valid, invalid }
  }

  async deleteTransactionsBatch(
    userId: string,
    transactionIds: string[]
  ): Promise<{ deleted: number; errors: string[] }> {
    if (transactionIds.length === 0) {
      return { deleted: 0, errors: [] }
    }

    const errors: string[] = []
    let deletedCount = 0

    await AppDataSource.transaction(async (manager) => {
      // 1️⃣ Получаем транзакции для отката балансов
      const transactions = await manager.find(TransactionEntity, {
        where: transactionIds.map(id => ({ id, userId })),
      })

      if (transactions.length === 0) {
        errors.push('No transactions found')
        return
      }

      // 2️⃣ Группируем изменения балансов (откат)
      const balanceUpdates = new Map<string, { amount: number; currency: Currency }>()

      transactions.forEach((tx) => {
        // Откатываем изменения (инвертируем знак)
        if (tx.type === TransactionType.EXPENSE && tx.fromAccountId) {
          const key = `${tx.fromAccountId}:${tx.currency}`
          const current = balanceUpdates.get(key) || { amount: 0, currency: tx.currency as Currency }
          balanceUpdates.set(key, {
            amount: current.amount + tx.amount, // +, т.к. откатываем расход
            currency: tx.currency as Currency,
          })
        }

        if (tx.type === TransactionType.INCOME && tx.toAccountId) {
          const key = `${tx.toAccountId}:${tx.currency}`
          const current = balanceUpdates.get(key) || { amount: 0, currency: tx.currency as Currency }
          balanceUpdates.set(key, {
            amount: current.amount - tx.amount, // -, т.к. откатываем доход
            currency: tx.currency as Currency,
          })
        }

        if (tx.type === TransactionType.TRANSFER) {
          if (tx.fromAccountId) {
            const key = `${tx.fromAccountId}:${tx.currency}`
            const current = balanceUpdates.get(key) || { amount: 0, currency: tx.currency as Currency }
            balanceUpdates.set(key, {
              amount: current.amount + tx.amount,
              currency: tx.currency as Currency,
            })
          }
          if (tx.toAccountId) {
            const key = `${tx.toAccountId}:${tx.currency}`
            const current = balanceUpdates.get(key) || { amount: 0, currency: tx.currency as Currency }
            balanceUpdates.set(key, {
              amount: current.amount - tx.amount,
              currency: tx.currency as Currency,
            })
          }
        }
      })

      // 3️⃣ Применяем изменения балансов
      for (const [key, delta] of balanceUpdates) {
        const [accountId, currency] = key.split(':')

        const balance = await manager.findOne(Balance, {
          where: { userId, accountId, currency: currency as Currency },
        })

        if (balance) {
          balance.amount += delta.amount
          balance.lastUpdated = new Date()
          await manager.save(Balance, balance)
        }
      }

      // 4️⃣ Удаляем транзакции
      const result = await manager.delete(TransactionEntity, transactionIds)
      deletedCount = result.affected || 0
    })

    this.clearCache(userId)

    return { deleted: deletedCount, errors }
  }

  async updateTransactionsBatch(
    userId: string,
    updates: Array<{ id: string; category?: string; description?: string }>
  ): Promise<{ updated: number; errors: string[] }> {
    if (updates.length === 0) {
      return { updated: 0, errors: [] }
    }

    const errors: string[] = []
    let updatedCount = 0

    await AppDataSource.transaction(async (manager) => {
      for (const update of updates) {
        try {
          const tx = await manager.findOne(TransactionEntity, {
            where: { id: update.id, userId },
          })

          if (!tx) {
            errors.push(`Transaction ${update.id} not found`)
            continue
          }

          if (update.category) tx.category = update.category as TransactionCategory
          if (update.description) tx.description = update.description

          await manager.save(TransactionEntity, tx)
          updatedCount++
        } catch (error) {
          errors.push(`Failed to update ${update.id}: ${error}`)
        }
      }
    })

    this.clearCache(userId)

    return { updated: updatedCount, errors }
  }
}

export const dbStorage = new DatabaseStorage()
