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
import { tgObservability } from "../observability/tgwrapper-observability"

const DB_PATH = path.resolve(__dirname, "../../data/database.sqlite")

export const AppDataSource = new DataSource({
  type: "better-sqlite3",
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
      await tgObservability.instrumentDbOperation(
        "initialize",
        async () => await AppDataSource.initialize(),
        "database"
      )

      await tgObservability.instrumentDbOperation(
        "query",
        async () => await AppDataSource.query("PRAGMA journal_mode = WAL;"),
        "database"
      )
      await tgObservability.instrumentDbOperation(
        "query",
        async () => await AppDataSource.query("PRAGMA synchronous = NORMAL;"),
        "database"
      )
      await tgObservability.instrumentDbOperation(
        "query",
        async () => await AppDataSource.query("PRAGMA cache_size = 10000;"),
        "database"
      )
      await tgObservability.instrumentDbOperation(
        "query",
        async () => await AppDataSource.query("PRAGMA temp_store = MEMORY;"),
        "database"
      )
      await tgObservability.instrumentDbOperation(
        "query",
        async () => await AppDataSource.query("PRAGMA foreign_keys = ON;"),
        "database"
      )

      await ensureUserMonetizationColumns()

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

async function ensureUserMonetizationColumns(): Promise<void> {
  const columns = (await AppDataSource.query(
    "PRAGMA table_info(users);"
  )) as Array<{ name: string }>
  const names = new Set(columns.map((c) => c.name))

  const statements: Array<{ name: string; sql: string }> = [
    {
      name: "telegramUsername",
      sql: "ALTER TABLE users ADD COLUMN telegramUsername TEXT NULL;",
    },
    {
      name: "subscriptionTier",
      sql: "ALTER TABLE users ADD COLUMN subscriptionTier TEXT NOT NULL DEFAULT 'free';",
    },
    {
      name: "premiumExpiresAt",
      sql: "ALTER TABLE users ADD COLUMN premiumExpiresAt datetime NULL;",
    },
    {
      name: "trialStartedAt",
      sql: "ALTER TABLE users ADD COLUMN trialStartedAt datetime NULL;",
    },
    {
      name: "trialExpiresAt",
      sql: "ALTER TABLE users ADD COLUMN trialExpiresAt datetime NULL;",
    },
    {
      name: "trialUsed",
      sql: "ALTER TABLE users ADD COLUMN trialUsed INTEGER NOT NULL DEFAULT 0;",
    },
    {
      name: "transactionsThisMonth",
      sql: "ALTER TABLE users ADD COLUMN transactionsThisMonth INTEGER NOT NULL DEFAULT 0;",
    },
    {
      name: "transactionsMonthKey",
      sql: "ALTER TABLE users ADD COLUMN transactionsMonthKey TEXT NULL;",
    },
    {
      name: "voiceInputsToday",
      sql: "ALTER TABLE users ADD COLUMN voiceInputsToday INTEGER NOT NULL DEFAULT 0;",
    },
    {
      name: "voiceDayKey",
      sql: "ALTER TABLE users ADD COLUMN voiceDayKey TEXT NULL;",
    },
    {
      name: "lastPaymentAt",
      sql: "ALTER TABLE users ADD COLUMN lastPaymentAt datetime NULL;",
    },
    {
      name: "lastPaymentProvider",
      sql: "ALTER TABLE users ADD COLUMN lastPaymentProvider TEXT NULL;",
    },
    {
      name: "lastPaymentReference",
      sql: "ALTER TABLE users ADD COLUMN lastPaymentReference TEXT NULL;",
    },
    {
      name: "subscriptionPaused",
      sql: "ALTER TABLE users ADD COLUMN subscriptionPaused INTEGER NOT NULL DEFAULT 0;",
    },
    {
      name: "pausedRemainingMs",
      sql: "ALTER TABLE users ADD COLUMN pausedRemainingMs INTEGER NOT NULL DEFAULT 0;",
    },
    {
      name: "pausedTier",
      sql: "ALTER TABLE users ADD COLUMN pausedTier TEXT NULL;",
    },
    {
      name: "uiMode",
      sql: "ALTER TABLE users ADD COLUMN uiMode TEXT NOT NULL DEFAULT 'basic';",
    },
    {
      name: "uiModeHintShown",
      sql: "ALTER TABLE users ADD COLUMN uiModeHintShown INTEGER NOT NULL DEFAULT 0;",
    },
  ]

  for (const { name, sql } of statements) {
    if (!names.has(name)) {
      await AppDataSource.query(sql)
    }
  }
}

export async function closeDatabase() {
  if (AppDataSource.isInitialized) {
    await tgObservability.instrumentDbOperation(
      "destroy",
      async () => await AppDataSource.destroy(),
      "database"
    )
    if (config.LOG_BOOT_DETAIL) {
      logger.info("✅ Database connection closed")
    }
  }
}
