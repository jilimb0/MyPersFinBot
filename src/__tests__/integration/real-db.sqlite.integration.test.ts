import "reflect-metadata"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
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

const runRealDb =
  process.env.CI_REAL_DB === "true" || process.env.REAL_DB_TEST === "1"

const describeRealDb = runRealDb ? describe : describe.skip

describeRealDb("Integration: real DB (better-sqlite3 file)", () => {
  let ds: DataSource
  let dbDir: string
  let dbPath: string

  beforeAll(async () => {
    dbDir = mkdtempSync(join(tmpdir(), "my-pers-fin-bot-realdb-"))
    dbPath = join(dbDir, "test.sqlite")

    ds = new DataSource({
      type: "better-sqlite3",
      database: dbPath,
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
    if (dbDir) {
      rmSync(dbDir, { recursive: true, force: true })
    }
  })

  beforeEach(async () => {
    await ds.getRepository(Transaction).clear()
    await ds.getRepository(Balance).clear()
    await ds.getRepository(User).clear()
  })

  test("CRUD + transaction commit/rollback", async () => {
    const users = ds.getRepository(User)
    const balances = ds.getRepository(Balance)
    const txs = ds.getRepository(Transaction)

    await users.save({ id: "u-real", defaultCurrency: "USD", language: "en" })
    await balances.save({
      userId: "u-real",
      accountId: "Card",
      amount: 500,
      currency: "USD",
    })

    const tx = await txs.save({
      userId: "u-real",
      date: new Date("2026-02-10T10:00:00.000Z"),
      amount: 22,
      currency: "USD",
      type: "EXPENSE",
      category: "FOOD_DINING",
      description: "coffee",
      fromAccountId: "Card",
    } as any)

    const loaded = await txs.findOne({ where: { id: tx.id } })
    expect(loaded?.description).toBe("coffee")

    await txs.update({ id: tx.id }, { description: "coffee + snack" })
    const updated = await txs.findOne({ where: { id: tx.id } })
    expect(updated?.description).toBe("coffee + snack")

    const runner = ds.createQueryRunner()
    await runner.connect()
    await runner.startTransaction()

    try {
      await runner.manager.getRepository(Transaction).save({
        userId: "u-real",
        date: new Date("2026-02-11T10:00:00.000Z"),
        amount: 40,
        currency: "USD",
        type: "EXPENSE",
        category: "TRANSPORT",
        description: "taxi",
        fromAccountId: "Card",
      } as any)

      throw new Error("force rollback")
    } catch {
      await runner.rollbackTransaction()
    } finally {
      await runner.release()
    }

    const rolledBack = await txs.find({ where: { description: "taxi" } })
    expect(rolledBack).toHaveLength(0)
  })

  test("query filters: type/date/amount/account/search text", async () => {
    const users = ds.getRepository(User)
    const txs = ds.getRepository(Transaction)

    await users.save({
      id: "u-real-2",
      defaultCurrency: "USD",
      language: "en",
    })

    await txs.save([
      {
        userId: "u-real-2",
        date: new Date("2026-01-10T10:00:00.000Z"),
        amount: 100,
        currency: "USD",
        type: "EXPENSE",
        category: "FOOD_DINING",
        description: "coffee",
        fromAccountId: "Card",
      },
      {
        userId: "u-real-2",
        date: new Date("2026-01-12T10:00:00.000Z"),
        amount: 500,
        currency: "USD",
        type: "INCOME",
        category: "SALARY",
        description: "salary",
        toAccountId: "Savings",
      },
      {
        userId: "u-real-2",
        date: new Date("2026-01-15T10:00:00.000Z"),
        amount: 50,
        currency: "USD",
        type: "EXPENSE",
        category: "FOOD_DINING",
        description: "coffee beans",
        fromAccountId: "Card",
      },
    ] as any[])

    const filtered = await txs
      .createQueryBuilder("tx")
      .where("tx.userId = :userId", { userId: "u-real-2" })
      .andWhere("tx.type = :type", { type: "EXPENSE" })
      .andWhere("tx.date >= :from", { from: new Date("2026-01-01") })
      .andWhere("tx.date <= :to", { to: new Date("2026-01-31T23:59:59.999Z") })
      .andWhere("tx.amount BETWEEN :min AND :max", { min: 40, max: 150 })
      .andWhere("tx.fromAccountId = :fromAccount", { fromAccount: "Card" })
      .andWhere("LOWER(tx.description) LIKE :q", { q: "%coffee%" })
      .getMany()

    expect(filtered).toHaveLength(2)
  })
})
