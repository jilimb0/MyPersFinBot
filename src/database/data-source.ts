import "reflect-metadata"
import { DataSource } from "typeorm"
import path from "path"
import { User } from "../entities/User"
import { Balance } from "../entities/Balance"
import { Transaction } from "../entities/Transaction"
import { Debt } from "../entities/Debt"
import { Goal } from "../entities/Goal"
import { IncomeSource } from "../entities/IncomeSource"

const DB_PATH = path.resolve(__dirname, "../../data/database.sqlite")

export const AppDataSource = new DataSource({
  type: "sqlite",
  database: DB_PATH,
  synchronize: true, // Автоматическое создание таблиц
  logging: false, // Включите для отладки: ["query", "error"]
  entities: [User, Balance, Transaction, Debt, Goal, IncomeSource],
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
      await AppDataSource.query('PRAGMA journal_mode = WAL;')
      await AppDataSource.query('PRAGMA synchronous = NORMAL;')
      await AppDataSource.query('PRAGMA cache_size = 10000;')
      await AppDataSource.query('PRAGMA temp_store = MEMORY;')
      
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
