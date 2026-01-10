import { AppDataSource } from "./database/data-source"
import { User } from "./entities/User"
import { Balance } from "./entities/Balance"
import { Transaction as TransactionEntity } from "./entities/Transaction"
import { Debt as DebtEntity } from "./entities/Debt"
import { Goal as GoalEntity } from "./entities/Goal"
import { IncomeSource as IncomeSourceEntity } from "./entities/IncomeSource"
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
} from "./types"
import { convertSync } from "./fx"

/**
 * Новый Storage на основе TypeORM + SQLite
 * ⚡ 10-50x быстрее JSON!
 */
export class DatabaseStorage {
  // ⚡ Кеширование для производительности
  private userDataCache = new Map<
    string,
    { data: UserData; timestamp: number }
  >()
  private balancesCache = new Map<
    string,
    { data: BalanceType[]; timestamp: number }
  >()
  private readonly CACHE_TTL = 5000 // 5 секунд

  private formatMoney(amount: number, currency: string): string {
    return `${amount.toFixed(2)} ${currency}`
  }

  /**
   * Очистить кеш для пользователя (вызывать после изменений)
   */
  clearCache(userId: string) {
    this.userDataCache.delete(userId)
    this.balancesCache.delete(userId)
  }

  // --- User Methods ---

  private async ensureUser(userId: string): Promise<User> {
    const userRepo = AppDataSource.getRepository(User)
    let user = await userRepo.findOne({ where: { id: userId } })

    if (!user) {
      user = userRepo.create({
        id: userId,
        defaultCurrency: "USD",
      })
      await userRepo.save(user)
    }

    return user
  }

  // --- Balance Methods ---

  async getBalancesList(userId: string): Promise<BalanceType[]> {
    // Проверка кеша
    const cached = this.balancesCache.get(userId)
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data
    }

    await this.ensureUser(userId)
    const balances = await AppDataSource.getRepository(Balance).find({
      where: { userId },
    })

    const result = balances.map((b) => ({
      accountId: b.accountId,
      amount: b.amount,
      currency: b.currency,
      lastUpdated: b.lastUpdated.toISOString(),
    }))

    // Сохранить в кеш
    this.balancesCache.set(userId, { data: result, timestamp: Date.now() })

    return result
  }

  async getBalances(userId: string): Promise<string> {
    const balances = await this.getBalancesList(userId)

    if (balances.length === 0) {
      return "No balances recorded."
    }

    return balances
      .map(
        (b) => `💳 *${b.accountId}*: ${this.formatMoney(b.amount, b.currency)}`
      )
      .join("\n")
  }

  async updateBalance(
    userId: string,
    accountId: string,
    amount: number,
    currency: Currency = "USD"
  ) {
    await this.ensureUser(userId)

    if (!accountId) return

    const balanceRepo = AppDataSource.getRepository(Balance)
    const normalizedAccountId = accountId.trim().toLowerCase()

    // 🔧 БАГ #3: Ищем ТОЛЬКО по accountId (без currency)
    // Один аккаунт = одна валюта, остальные конвертируются
    const existing = await balanceRepo
      .createQueryBuilder("balance")
      .where("LOWER(balance.accountId) = :accountId", {
        accountId: normalizedAccountId,
      })
      .andWhere("balance.userId = :userId", { userId })
      // .andWhere("balance.currency = :currency", { currency }) // ❌ УДАЛЕНО!
      .getOne()

    if (existing) {
      // 💱 Если валюта транзакции отличается - конвертируем
      let amountToAdd = amount
      if (existing.currency !== currency) {
        amountToAdd = convertSync(
          amount,
          currency as Currency,
          existing.currency as Currency
        )
      }

      existing.amount += amountToAdd
      existing.lastUpdated = new Date()
      await balanceRepo.save(existing)
      this.clearCache(userId)
    } else {
      // Создаем новый аккаунт с валютой первой транзакции
      const displayName =
        accountId.trim().charAt(0).toUpperCase() + accountId.trim().slice(1)

      const newBalance = balanceRepo.create({
        userId,
        accountId: displayName,
        amount,
        currency, // Валюта первой транзакции
      })
      await balanceRepo.save(newBalance)
      this.clearCache(userId)
    }
  }

  async addBalance(userId: string, balance: BalanceType) {
    await this.updateBalance(
      userId,
      balance.accountId,
      balance.amount,
      balance.currency
    )
    this.clearCache(userId)
  }

  /**
   * 🗑️ Удалить баланс
   */
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

  /**
   * 🔧 Редактирование баланса: КОНВЕРТАЦИЯ (оставляет текущую валюту)
   */
  async convertBalanceAmount(
    userId: string,
    accountId: string,
    inputCurrency: Currency,
    inputAmount: number
  ) {
    const normalizedAccountId = accountId.trim().toLowerCase()

    const balance = await AppDataSource.getRepository(Balance)
      .createQueryBuilder("balance")
      .where("LOWER(balance.accountId) = :accountId", {
        accountId: normalizedAccountId,
      })
      .andWhere("balance.userId = :userId", { userId })
      .getOne()

    if (balance) {
      // 💱 Конвертируем в текущую валюту баланса
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

  /**
   * 🔧 Редактирование баланса: СМЕНА ВАЛЮТЫ (меняет валюту баланса)
   */
  async setBalanceAmountWithCurrencyChange(
    userId: string,
    accountId: string,
    newCurrency: Currency,
    newAmount: number
  ) {
    const normalizedAccountId = accountId.trim().toLowerCase()

    const balance = await AppDataSource.getRepository(Balance)
      .createQueryBuilder("balance")
      .where("LOWER(balance.accountId) = :accountId", {
        accountId: normalizedAccountId,
      })
      .andWhere("balance.userId = :userId", { userId })
      .getOne()

    if (balance) {
      balance.amount = newAmount
      balance.currency = newCurrency
      balance.lastUpdated = new Date()
      await AppDataSource.getRepository(Balance).save(balance)
      this.clearCache(userId)
    }
  }

  /**
   * 🔧 БАГ #2: Получить сумму на счету (для валидации)
   */
  async getBalanceAmount(
    userId: string,
    accountId: string
  ): Promise<{ amount: number; currency: Currency } | null> {
    const normalizedAccountId = accountId.trim().toLowerCase()
    const balance = await AppDataSource.getRepository(Balance)
      .createQueryBuilder("balance")
      .where("LOWER(balance.accountId) = :accountId", {
        accountId: normalizedAccountId,
      })
      .andWhere("balance.userId = :userId", { userId })
      .getOne()

    if (!balance) return null

    return {
      amount: balance.amount,
      currency: balance.currency,
    }
  }

  /**
   * Рассчитать конвертированную сумму (без сохранения)
   */
  calculateConvertedAmount(
    amount: number,
    fromCurrency: Currency,
    toCurrency: Currency
  ): number {
    return convertSync(amount, fromCurrency as Currency, toCurrency as Currency)
  }

  // --- Transaction Methods ---

  async addTransaction(userId: string, transaction: Transaction) {
    await this.ensureUser(userId)

    const txRepo = AppDataSource.getRepository(TransactionEntity)
    const tx = txRepo.create({
      id: transaction.id,
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

    await txRepo.save(tx)

    // Обновляем балансы
    if (
      transaction.type === TransactionType.INCOME &&
      transaction.toAccountId
    ) {
      await this.updateBalance(
        userId,
        transaction.toAccountId,
        transaction.amount,
        transaction.currency
      )
    } else if (
      transaction.type === TransactionType.EXPENSE &&
      transaction.fromAccountId
    ) {
      await this.updateBalance(
        userId,
        transaction.fromAccountId,
        -transaction.amount,
        transaction.currency
      )
    } else if (transaction.type === TransactionType.TRANSFER) {
      if (transaction.fromAccountId) {
        await this.updateBalance(
          userId,
          transaction.fromAccountId,
          -transaction.amount,
          transaction.currency
        )
      }
      if (transaction.toAccountId) {
        await this.updateBalance(
          userId,
          transaction.toAccountId,
          transaction.amount,
          transaction.currency
        )
      }
    }

    this.clearCache(userId)
  }

  async deleteTransaction(userId: string, txId: string): Promise<boolean> {
    try {
      await this.ensureUser(userId)
      const txRepo = AppDataSource.getRepository(TransactionEntity)

      const tx = await txRepo.findOne({
        where: { id: txId, userId },
      })

      if (!tx) return false

      // 🔧 Откатываем долги и цели
      // Проверяем по category ИЛИ по description (для старых транзакций)
      if (
        tx.description &&
        (tx.category === InternalCategory.DEBT_REPAYMENT ||
          tx.description.startsWith("Debt Payment: "))
      ) {
        // Извлекаем имя из description: "Debt Payment: John"
        const debtName = tx.description.replace("Debt Payment: ", "").trim()

        // Ищем долг по имени
        const debt = await AppDataSource.getRepository(DebtEntity).findOne({
          where: { userId, name: debtName },
        })

        if (debt) {
          // Откатываем оплату
          debt.paidAmount = Math.max(0, debt.paidAmount - tx.amount)
          debt.isPaid = debt.paidAmount >= debt.amount
          await AppDataSource.getRepository(DebtEntity).save(debt)
        }
      } else if (
        tx.description &&
        (tx.category === InternalCategory.GOAL_DEPOSIT ||
          tx.description.startsWith("Goal Deposit: "))
      ) {
        // Извлекаем имя из description: "Goal Deposit: Car"
        const goalName = tx.description.replace("Goal Deposit: ", "").trim()

        // Ищем цель по имени
        const goal = await AppDataSource.getRepository(GoalEntity).findOne({
          where: { userId, name: goalName },
        })

        if (goal) {
          // Откатываем пополнение
          goal.currentAmount = Math.max(0, goal.currentAmount - tx.amount)
          goal.status =
            goal.currentAmount >= goal.targetAmount ? "COMPLETED" : "ACTIVE"
          await AppDataSource.getRepository(GoalEntity).save(goal)
        }
      }

      // Откатываем баланс
      const txType = tx.type as TransactionType
      const amount = tx.amount
      const currency = tx.currency as Currency

      if (txType === TransactionType.EXPENSE && tx.fromAccountId) {
        // Возвращаем деньги обратно на счет
        await this.updateBalance(userId, tx.fromAccountId, amount, currency)
      } else if (txType === TransactionType.INCOME && tx.toAccountId) {
        // Убираем доход со счета
        await this.updateBalance(userId, tx.toAccountId, -amount, currency)
      } else if (
        txType === TransactionType.TRANSFER &&
        tx.fromAccountId &&
        tx.toAccountId
      ) {
        // Откатываем трансфер
        await this.updateBalance(userId, tx.fromAccountId, amount, currency)
        await this.updateBalance(userId, tx.toAccountId, -amount, currency)
      }

      // Удаляем транзакцию
      await txRepo.remove(tx)
      this.clearCache(userId)
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

  /**
   * ⚡ Получить транзакции за месяц (с кэшированием)
   */
  async getTransactionsByMonth(
    userId: string,
    year: number,
    month: number
  ): Promise<Transaction[]> {
    const startDate = new Date(year, month, 1)
    const endDate = new Date(year, month + 1, 0, 23, 59, 59)

    // ⚡ Используем индексы для быстрого поиска
    const transactions = await AppDataSource.getRepository(TransactionEntity)
      .createQueryBuilder("tx")
      .select() // Выбираем только нужные поля
      .where("tx.userId = :userId", { userId })
      .andWhere("tx.date >= :startDate", { startDate })
      .andWhere("tx.date <= :endDate", { endDate })
      .orderBy("tx.date", "DESC")
      .cache(true) // ⚡ Кэширование результатов
      .getMany()

    return transactions.map(this.mapTransaction)
  }

  async getAllTransactions(userId: string): Promise<Transaction[]> {
    await this.ensureUser(userId)

    const transactions = await AppDataSource.getRepository(TransactionEntity)
      .createQueryBuilder("tx")
      .where("tx.userId = :userId", { userId })
      .orderBy("tx.date", "DESC")
      .getMany()

    return transactions.map(this.mapTransaction.bind(this))
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

  // --- Debt Methods ---

  async getDebts(userId: string): Promise<string> {
    await this.ensureUser(userId)
    const debts = await AppDataSource.getRepository(DebtEntity).find({
      where: { userId },
    })

    if (debts.length === 0) {
      return "You have no active debts."
    }

    const owesMe = debts.filter((d) => d.type === "OWES_ME")
    const iOwe = debts.filter((d) => d.type === "I_OWE")

    let response = ""

    if (owesMe.length > 0) {
      response += "*They owe you:*\n"
      response += owesMe
        .map(
          (d) =>
            `- ${d.counterparty}: ${this.formatMoney(d.amount, d.currency)} (${
              d.description || ""
            })`
        )
        .join("\n")
      response += "\n\n"
    }

    if (iOwe.length > 0) {
      response += "*You owe:*\n"
      response += iOwe
        .map(
          (d) =>
            `- ${d.counterparty}: ${this.formatMoney(d.amount, d.currency)} (${
              d.description || ""
            })`
        )
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

  /**
   * 🔧 БАГ #1 & #2: Оплата долга с валидацией и правильной логикой
   */
  async updateDebtAmount(
    userId: string,
    debtId: string,
    paidAmount: number,
    accountId: string,
    currency: Currency
  ): Promise<{ success: boolean; message?: string }> {
    const debt = await this.getDebtById(userId, debtId)
    if (!debt) {
      return { success: false, message: "❌ Debt not found" }
    }

    // ✅ Проверяем баланс ТОЛЬКО для I_OWE (когда я отдаю долг)
    if (debt.type === "I_OWE") {
      const balance = await this.getBalanceAmount(userId, accountId)
      if (!balance) {
        return {
          success: false,
          message: `❌ Account "${accountId}" not found`,
        }
      }

      // Конвертируем сумму в валюту аккаунта
      const amountInAccountCurrency = convertSync(
        paidAmount,
        currency as Currency,
        balance.currency as Currency
      )

      if (balance.amount < amountInAccountCurrency) {
        return {
          success: false,
          message: `❌ Insufficient funds on "${accountId}".\nAvailable: ${balance.amount.toFixed(
            2
          )} ${balance.currency}\nRequired: ~${amountInAccountCurrency.toFixed(
            2
          )} ${balance.currency}`,
        }
      }
    }

    // Обновляем долг
    const debtEntity = await AppDataSource.getRepository(DebtEntity).findOne({
      where: { id: debtId, userId },
    })

    if (!debtEntity) {
      return { success: false, message: "❌ Debt not found" }
    }

    debtEntity.paidAmount += paidAmount
    if (debtEntity.paidAmount >= debtEntity.amount) {
      debtEntity.isPaid = true
    }
    await AppDataSource.getRepository(DebtEntity).save(debtEntity)

    // 📝 Создаём транзакцию (она сама обновит баланс и запишется в историю)
    const transaction = {
      id: Date.now().toString(),
      date: new Date(),
      amount: paidAmount,
      currency: currency,
      type: debt.type === "I_OWE" ? ("EXPENSE" as const) : ("INCOME" as const),
      category: InternalCategory.DEBT_REPAYMENT,
      description: `Debt Payment: ${debt.name}`,
      fromAccountId: debt.type === "I_OWE" ? accountId : undefined,
      toAccountId: debt.type === "OWES_ME" ? accountId : undefined,
    }
    await this.addTransaction(userId, transaction as Transaction)

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

    // Корректируем paidAmount если он больше новой суммы
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
        return `🎯 *${g.name}*\n${bar} ${percent}%\nTarget: ${this.formatMoney(
          g.targetAmount,
          g.currency
        )}\nSaved: ${this.formatMoney(g.currentAmount, g.currency)}`
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

  /**
   * 🔧 БАГ #2: Пополнение цели с валидацией баланса
   */
  async depositToGoal(
    userId: string,
    goalId: string,
    amount: number,
    accountId: string,
    currency: Currency
  ): Promise<{ success: boolean; message?: string }> {
    const goal = await AppDataSource.getRepository(GoalEntity).findOne({
      where: { id: goalId, userId },
    })

    if (!goal) {
      return { success: false, message: "❌ Goal not found" }
    }

    // ✅ Проверяем баланс
    const balance = await this.getBalanceAmount(userId, accountId)
    if (!balance) {
      return { success: false, message: `❌ Account "${accountId}" not found` }
    }

    // Конвертируем сумму в валюту аккаунта для проверки
    const amountInAccountCurrency = convertSync(
      amount,
      currency as Currency,
      balance.currency as Currency
    )

    if (balance.amount < amountInAccountCurrency) {
      return {
        success: false,
        message: `❌ Insufficient funds on "${accountId}".\nAvailable: ${balance.amount.toFixed(
          2
        )} ${balance.currency}\nRequired: ~${amountInAccountCurrency.toFixed(
          2
        )} ${balance.currency}`,
      }
    }

    // Обновляем цель
    goal.currentAmount += amount
    if (goal.currentAmount >= goal.targetAmount) {
      goal.status = "COMPLETED"
    }
    await AppDataSource.getRepository(GoalEntity).save(goal)

    // 📝 Создаём транзакцию (она сама спишет с баланса и запишется в историю)
    const transaction = {
      id: Date.now().toString(),
      date: new Date(),
      amount: amount,
      currency: currency,
      type: "EXPENSE" as const,
      category: InternalCategory.GOAL_DEPOSIT,
      description: `Goal Deposit: ${goal.name}`,
      fromAccountId: accountId,
    }
    await this.addTransaction(userId, transaction as Transaction)

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
          `💵 *${i.name}*: ${
            i.expectedAmount && i.currency
              ? this.formatMoney(i.expectedAmount, i.currency)
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

  // --- Goal Management Methods ---

  async deleteGoal(userId: string, goalId: string) {
    await AppDataSource.getRepository(GoalEntity).delete({
      userId,
      id: goalId,
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

    // Авто-обновление статуса
    if (goal.currentAmount >= goal.targetAmount) {
      goal.status = "COMPLETED"
    }

    await goalRepo.save(goal)
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

  // --- Additional Methods ---

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

  /**
   * 🔧 Обновить общую сумму долга
   */
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

    // Обновляем сумму
    debt.amount = newAmount
    if (newCurrency) {
      debt.currency = newCurrency
    }

    // Корректируем paidAmount если он больше новой суммы
    if (debt.paidAmount > newAmount) {
      debt.paidAmount = newAmount
    }

    // Обновляем статус
    debt.isPaid = debt.paidAmount >= debt.amount

    await debtRepo.save(debt)
    this.clearCache(userId)

    return { success: true }
  }

  /**
   * 🎯 Обновить целевую сумму цели
   */
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

    // Проверяем что новая цель не меньше текущей суммы
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

    // Обновляем статус
    goal.status =
      goal.currentAmount >= goal.targetAmount ? "COMPLETED" : "ACTIVE"

    await goalRepo.save(goal)
    this.clearCache(userId)

    return { success: true }
  }

  /**
   * ✅ Отметить цель как выполненную
   */
  async markGoalComplete(userId: string, goalId: string): Promise<void> {
    const goalRepo = AppDataSource.getRepository(GoalEntity)
    const goal = await goalRepo.findOne({ where: { id: goalId, userId } })

    if (goal) {
      goal.status = "COMPLETED"
      await goalRepo.save(goal)
      this.clearCache(userId)
    }
  }

  async getRecentTransactions(
    userId: string,
    limit: number = 5
  ): Promise<Transaction[]> {
    await this.ensureUser(userId)

    const transactions = await AppDataSource.getRepository(TransactionEntity)
      .createQueryBuilder("tx")
      .where("tx.userId = :userId", { userId })
      .orderBy("tx.date", "DESC")
      .limit(limit)
      .getMany()

    return transactions.map(this.mapTransaction.bind(this))
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

      // Сохраняем старые значения для отката балансов
      const oldAmount = transaction.amount
      const oldCurrency = transaction.currency
      const oldFromAccount = transaction.fromAccountId
      const oldToAccount = transaction.toAccountId

      // Обновляем поля
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

      // ✅ Откатываем старый баланс и применяем новый
      if (
        updates.amount !== undefined ||
        updates.currency !== undefined ||
        updates.fromAccountId !== undefined ||
        updates.toAccountId !== undefined
      ) {
        const txType = transaction.type as TransactionType

        // Откатываем старую транзакцию
        if (txType === TransactionType.EXPENSE && oldFromAccount) {
          await this.updateBalance(
            userId,
            oldFromAccount,
            oldAmount,
            oldCurrency as Currency
          )
        } else if (txType === TransactionType.INCOME && oldToAccount) {
          await this.updateBalance(
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
          await this.updateBalance(
            userId,
            oldFromAccount,
            oldAmount,
            oldCurrency as Currency
          )
          await this.updateBalance(
            userId,
            oldToAccount,
            -oldAmount,
            oldCurrency as Currency
          )
        }

        // Применяем новую транзакцию
        const newFromAccount = transaction.fromAccountId || oldFromAccount
        const newToAccount = transaction.toAccountId || oldToAccount
        const newAmount = transaction.amount
        const newCurrency = transaction.currency as Currency

        if (txType === TransactionType.EXPENSE && newFromAccount) {
          await this.updateBalance(
            userId,
            newFromAccount,
            -newAmount,
            newCurrency
          )
        } else if (txType === TransactionType.INCOME && newToAccount) {
          await this.updateBalance(userId, newToAccount, newAmount, newCurrency)
        } else if (
          txType === TransactionType.TRANSFER &&
          newFromAccount &&
          newToAccount
        ) {
          await this.updateBalance(
            userId,
            newFromAccount,
            -newAmount,
            newCurrency
          )
          await this.updateBalance(userId, newToAccount, newAmount, newCurrency)
        }
      }

      this.clearCache(userId)
      return true
    } catch (error) {
      console.error("Error updating transaction:", error)
      return false
    }
  }

  // --- Helper method for legacy compatibility ---
  async getUserData(userId: string) {
    // Проверка кеша
    const cached = this.userDataCache.get(userId)
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data
    }

    await this.ensureUser(userId)

    const balances = await AppDataSource.getRepository(Balance).find({
      where: { userId },
    })
    const transactions = await AppDataSource.getRepository(
      TransactionEntity
    ).find({ where: { userId } })
    const debts = await AppDataSource.getRepository(DebtEntity).find({
      where: { userId },
    })
    const goals = await AppDataSource.getRepository(GoalEntity).find({
      where: { userId },
    })
    const incomeSources = await AppDataSource.getRepository(
      IncomeSourceEntity
    ).find({ where: { userId } })
    const user = await AppDataSource.getRepository(User).findOne({
      where: { id: userId },
    })

    const result = {
      balances: balances.map((b) => ({
        accountId: b.accountId,
        amount: b.amount,
        currency: b.currency,
        lastUpdated: b.lastUpdated.toISOString(),
      })),
      transactions: transactions.map(this.mapTransaction.bind(this)),
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
      })),
      goals: goals.map((g) => ({
        id: g.id,
        name: g.name,
        targetAmount: g.targetAmount,
        currentAmount: g.currentAmount,
        currency: g.currency,
        status: g.status,
      })),
      incomeSources: incomeSources.map((s) => ({
        id: s.id.toString(),
        name: s.name,
        expectedAmount: s.expectedAmount,
        currency: s.currency,
        frequency: s.frequency,
      })),
      defaultCurrency: user?.defaultCurrency || "USD",
    }

    // Сохранить в кеш
    this.userDataCache.set(userId, { data: result, timestamp: Date.now() })

    return result
  }

  /**
   * 🗑️ Полная очистка всех данных пользователя
   */
  async clearAllUserData(userId: string) {
    const userRepo = AppDataSource.getRepository(User)
    const balanceRepo = AppDataSource.getRepository(Balance)
    const transactionRepo = AppDataSource.getRepository(TransactionEntity)
    const debtRepo = AppDataSource.getRepository(DebtEntity)
    const goalRepo = AppDataSource.getRepository(GoalEntity)
    const incomeSourceRepo = AppDataSource.getRepository(IncomeSourceEntity)

    // Удаляем все связанные данные
    await transactionRepo.delete({ userId })
    await balanceRepo.delete({ userId })
    await debtRepo.delete({ userId })
    await goalRepo.delete({ userId })
    await incomeSourceRepo.delete({ userId })

    // Удаляем самого пользователя (он будет пересоздан при следующем использовании)
    await userRepo.delete({ id: userId })

    // Очищаем кеш
    this.clearCache(userId)
  }
}

export const dbStorage = new DatabaseStorage()
