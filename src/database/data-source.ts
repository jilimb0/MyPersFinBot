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

const DB_PATH = path.resolve(__dirname, "../../data/database.sqlite")

export const AppDataSource = new DataSource({
  type: "sqlite",
  database: DB_PATH,
  synchronize: true, // Автоматическое создание таблиц
  logging: false, // Включите для отладки: ["query", "error"]
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
  migrations: [],
  subscribers: [],

  // ⚡ SQLite оптимизация
  extra: {
    // WAL mode для лучшей производительности при конкурентных операциях
    flags: 6, // SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE
  },

  // ⚡ Connection pooling (для SQLite не критично, но включим для будущего)
  maxQueryExecutionTime: 1000, // Предупреждение о медленных запросах
})

// Инициализация БД
export async function initializeDatabase() {
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize()

      // ⚡ Включаем WAL mode для лучшей производительности
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

// Закрытие соединения
export async function closeDatabase() {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy()
    console.log("✅ Database connection closed")
  }
}
