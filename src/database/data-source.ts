import "reflect-metadata"
import { DataSource } from "typeorm"
import path from "path"
import { User } from "../database/entities/User"
import { Balance } from "../database/entities/Balance"
import { Transaction } from "../database/entities/Transaction"
import { Debt } from "../database/entities/Debt"
import { Goal } from "../database/entities/Goal"
import { IncomeSource } from "../database/entities/IncomeSource"
import { CategoryPreference } from "../database/entities/CategoryPreference"
import { Budget } from "../database/entities/Budget"
import { RecurringTransaction } from "../database/entities/RecurringTransaction"
import { Reminder } from "../database/entities/Reminder"
import { CustomQueryLogger } from "../monitoring"

const DB_PATH = path.resolve(__dirname, "../../data/database.sqlite")

export const AppDataSource = new DataSource({
  type: "sqlite",
  database: DB_PATH,
  logging: ["error", "warn", "schema"],
  logger: new CustomQueryLogger(),
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
  synchronize: process.env.NODE_ENV !== 'production',
  migrations: ['src/database/migrations/*.ts'],
  migrationsRun: true,

  subscribers: [],

  extra: {
    flags: 6,
  },
  maxQueryExecutionTime: 1000,
})

export async function initializeDatabase() {
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize()

      await AppDataSource.query("PRAGMA journal_mode = WAL;")
      await AppDataSource.query("PRAGMA synchronous = NORMAL;")
      await AppDataSource.query("PRAGMA cache_size = 10000;")
      await AppDataSource.query("PRAGMA temp_store = MEMORY;")

      console.log("✅ Database initialized successfully (WAL mode enabled)")
    }
    return AppDataSource
  } catch (error) {
    console.error("❌ Error initializing database:", error)
    throw error
  }
}

export async function closeDatabase() {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy()
    console.log("✅ Database connection closed")
  }
}
