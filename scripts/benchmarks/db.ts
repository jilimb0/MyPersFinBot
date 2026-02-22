import "reflect-metadata"
import { DataSource } from "typeorm"
import { Balance } from "../../src/database/entities/Balance"
import { Budget } from "../../src/database/entities/Budget"
import { CategoryPreference } from "../../src/database/entities/CategoryPreference"
import { Debt } from "../../src/database/entities/Debt"
import { Goal } from "../../src/database/entities/Goal"
import { IncomeSource } from "../../src/database/entities/IncomeSource"
import { RecurringTransaction } from "../../src/database/entities/RecurringTransaction"
import { Reminder } from "../../src/database/entities/Reminder"
import { Transaction as TransactionEntity } from "../../src/database/entities/Transaction"
import { User } from "../../src/database/entities/User"
import { runBench } from "./common"

async function createDataSource(): Promise<DataSource> {
  const ds = new DataSource({
    type: "sqljs",
    autoSave: false,
    synchronize: true,
    entities: [
      User,
      Balance,
      TransactionEntity,
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
  return ds
}

async function seed(ds: DataSource, size: number): Promise<void> {
  const userRepo = ds.getRepository(User)
  const txRepo = ds.getRepository(TransactionEntity)

  await userRepo.save({ id: "bench-user", defaultCurrency: "USD", language: "en" })

  const now = Date.now()
  const rows: Partial<TransactionEntity>[] = []
  for (let i = 0; i < size; i++) {
    rows.push({
      userId: "bench-user",
      date: new Date(now - i * 60000),
      amount: (i % 400) + 1,
      currency: "USD",
      type: i % 2 === 0 ? "EXPENSE" : "INCOME",
      category: i % 3 === 0 ? "FOOD_DINING" : "SALARY",
      description: i % 5 === 0 ? "coffee and lunch" : "monthly salary",
      fromAccountId: i % 2 === 0 ? "Card" : undefined,
      toAccountId: i % 2 === 1 ? "Savings" : undefined,
    })
  }

  await txRepo.save(rows as TransactionEntity[])
}

export async function benchmarkDb(): Promise<Awaited<ReturnType<typeof runBench>>> {
  const ds = await createDataSource()
  await seed(ds, 12000)

  try {
    return await runBench("DB query (sqljs)", 1200, async () => {
      await ds
        .getRepository(TransactionEntity)
        .createQueryBuilder("tx")
        .where("tx.userId = :userId", { userId: "bench-user" })
        .andWhere("tx.type = :type", { type: "EXPENSE" })
        .andWhere("tx.amount BETWEEN :min AND :max", { min: 10, max: 200 })
        .andWhere("(tx.fromAccountId = :acc OR tx.toAccountId = :acc)", {
          acc: "Card",
        })
        .andWhere("LOWER(COALESCE(tx.description, '')) LIKE :q", {
          q: "%coffee%",
        })
        .orderBy("tx.date", "DESC")
        .take(20)
        .getMany()
    })
  } finally {
    await ds.destroy()
  }
}

if (require.main === module) {
  void benchmarkDb().then((stats) => {
    console.log(JSON.stringify(stats, null, 2))
  })
}
