import "reflect-metadata"
import path from "node:path"
import { DataSource } from "typeorm"
import { config } from "../config"
import { Balance } from "../database/entities/Balance"
import { Budget } from "../database/entities/Budget"
import { CategoryPreference } from "../database/entities/CategoryPreference"
import { Debt } from "../database/entities/Debt"
import { Goal } from "../database/entities/Goal"
import { IncomeSource } from "../database/entities/IncomeSource"
import { RecurringTransaction } from "../database/entities/RecurringTransaction"
import { Reminder } from "../database/entities/Reminder"
import { Transaction } from "../database/entities/Transaction"
import { User } from "../database/entities/User"
import logger from "../logger"
import { CustomQueryLogger } from "../monitoring"

const DB_PATH = path.resolve(__dirname, "../../data/database.sqlite")

export const AppDataSource = new DataSource({
  type: "sqlite",
  database: DB_PATH,
  logging: ["error", "warn"],
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
  synchronize: process.env.NODE_ENV !== "production",
  migrations: ["src/database/migrations/*.ts"],
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
      await AppDataSource.query("PRAGMA foreign_keys = ON;")

      if (config.LOG_BOOT_DETAIL) {
        logger.info("✅ Database initialized successfully (WAL mode enabled)")
      }
    }
    return AppDataSource
  } catch (error) {
    logger.error("❌ Error initializing database:", error)
    throw error
  }
}

export async function closeDatabase() {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy()
    if (config.LOG_BOOT_DETAIL) {
      logger.info("✅ Database connection closed")
    }
  }
}
