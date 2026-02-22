import "reflect-metadata"
import { DataSource } from "typeorm"
import { Balance } from "../../database/entities/Balance"
import { Budget } from "../../database/entities/Budget"
import { CategoryPreference } from "../../database/entities/CategoryPreference"
import { Debt } from "../../database/entities/Debt"
import { Goal } from "../../database/entities/Goal"
import { IncomeSource } from "../../database/entities/IncomeSource"
import { RecurringTransaction } from "../../database/entities/RecurringTransaction"
import { Reminder } from "../../database/entities/Reminder"
import { Transaction } from "../../database/entities/Transaction"
import { User } from "../../database/entities/User"

describe("Integration: real DB (SQLite)", () => {
  let ds: DataSource

  beforeAll(async () => {
    ds = new DataSource({
      type: "sqljs",
      autoSave: false,
      synchronize: true,
      entities: [
        User,
        Balance,
        Transaction,
        Debt,
        Goal,
        IncomeSource,
        CategoryPreference,
        Budget,
        RecurringTransaction,
        Reminder,
      ],
      logging: false,
    })

    await ds.initialize()
  })

  afterAll(async () => {
    if (ds?.isInitialized) {
      await ds.destroy()
    }
  })

  beforeEach(async () => {
    await ds.getRepository(Transaction).clear()
    await ds.getRepository(Balance).clear()
    await ds.getRepository(Debt).clear()
    await ds.getRepository(Goal).clear()
    await ds.getRepository(IncomeSource).clear()
    await ds.getRepository(CategoryPreference).clear()
    await ds.getRepository(Budget).clear()
    await ds.getRepository(RecurringTransaction).clear()
    await ds.getRepository(Reminder).clear()
    await ds.getRepository(User).clear()
  })

  test("CRUD: user, balance, transaction", async () => {
    const users = ds.getRepository(User)
    const balances = ds.getRepository(Balance)
    const txs = ds.getRepository(Transaction)

    const user = users.create({
      id: "u1",
      defaultCurrency: "USD",
      language: "en",
    })
    await users.save(user)

    const balance = balances.create({
      userId: "u1",
      accountId: "Card",
      amount: 1000,
      currency: "USD",
    })
    await balances.save(balance)

    const tx = (await txs.save({
      userId: "u1",
      date: new Date("2026-02-01T10:00:00.000Z"),
      amount: 42,
      currency: "USD",
      type: "EXPENSE",
      category: "FOOD_DINING",
      description: "coffee",
      fromAccountId: "Card",
    } as any)) as Transaction

    const loadedUser = await users.findOne({ where: { id: "u1" } })
    const loadedBalance = await balances.findOne({
      where: { userId: "u1", accountId: "Card", currency: "USD" },
    })
    const loadedTx = await txs.findOne({ where: { id: tx.id } })

    expect(loadedUser?.id).toBe("u1")
    expect(loadedBalance?.amount).toBe(1000)
    expect(loadedTx?.description).toBe("coffee")

    await txs.update({ id: tx.id }, { description: "coffee + snack" })
    const updatedTx = await txs.findOne({ where: { id: tx.id } })
    expect(updatedTx?.description).toBe("coffee + snack")

    await txs.delete({ id: tx.id })
    const afterDelete = await txs.findOne({ where: { id: tx.id } })
    expect(afterDelete).toBeNull()
  })

  test("seed + query with filters", async () => {
    const users = ds.getRepository(User)
    const txs = ds.getRepository(Transaction)

    await users.save(
      users.create({ id: "u2", defaultCurrency: "USD", language: "en" })
    )

    const seed = [
      {
        userId: "u2",
        date: new Date("2026-01-10T10:00:00.000Z"),
        amount: 100,
        currency: "USD",
        type: "EXPENSE",
        category: "FOOD_DINING",
        description: "coffee",
        fromAccountId: "Card",
      },
      {
        userId: "u2",
        date: new Date("2026-01-12T10:00:00.000Z"),
        amount: 500,
        currency: "USD",
        type: "INCOME",
        category: "SALARY",
        description: "salary",
        toAccountId: "Card",
      },
      {
        userId: "u2",
        date: new Date("2026-01-15T10:00:00.000Z"),
        amount: 50,
        currency: "USD",
        type: "EXPENSE",
        category: "FOOD_DINING",
        description: "coffee beans",
        fromAccountId: "Cash",
      },
    ] as any[]

    await txs.save(seed)

    const filtered = await txs
      .createQueryBuilder("tx")
      .where("tx.userId = :userId", { userId: "u2" })
      .andWhere("tx.type = :type", { type: "EXPENSE" })
      .andWhere("tx.amount >= :min", { min: 40 })
      .andWhere("tx.amount <= :max", { max: 150 })
      .andWhere("LOWER(tx.description) LIKE :q", { q: "%coffee%" })
      .orderBy("tx.date", "DESC")
      .getMany()

    expect(filtered).toHaveLength(2)
    expect(filtered[0]?.description).toContain("coffee")
  })

  test("transaction rollback on error", async () => {
    const runner = ds.createQueryRunner()
    await runner.connect()
    await runner.startTransaction()

    try {
      await runner.manager.getRepository(User).save({
        id: "u3",
        defaultCurrency: "USD",
        language: "en",
      })

      await runner.manager.getRepository(Balance).save({
        userId: "u3",
        accountId: "Card",
        amount: 100,
        currency: "USD",
      })

      throw new Error("force rollback")
    } catch {
      await runner.rollbackTransaction()
    } finally {
      await runner.release()
    }

    const user = await ds.getRepository(User).findOne({ where: { id: "u3" } })
    const balance = await ds
      .getRepository(Balance)
      .findOne({ where: { userId: "u3", accountId: "Card" } })

    expect(user).toBeNull()
    expect(balance).toBeNull()
  })

  test("transaction commit persists all records", async () => {
    const runner = ds.createQueryRunner()
    await runner.connect()
    await runner.startTransaction()

    await runner.manager.getRepository(User).save({
      id: "u4",
      defaultCurrency: "USD",
      language: "en",
    })

    await runner.manager.getRepository(Balance).save({
      userId: "u4",
      accountId: "Cash",
      amount: 250,
      currency: "USD",
    })

    await runner.commitTransaction()
    await runner.release()

    const user = await ds.getRepository(User).findOne({ where: { id: "u4" } })
    const balance = await ds
      .getRepository(Balance)
      .findOne({ where: { userId: "u4", accountId: "Cash" } })

    expect(user).not.toBeNull()
    expect(balance?.amount).toBe(250)
  })
})
