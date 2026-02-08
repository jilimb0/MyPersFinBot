import { BudgetPeriod } from "../database/entities/Budget"

export type Currency = "USD" | "EUR" | "GEL" | "RUB" | "UAH" | "PLN"

export enum TransactionType {
  INCOME = "INCOME",
  EXPENSE = "EXPENSE",
  TRANSFER = "TRANSFER",
}

// Категории доходов
export enum IncomeCategory {
  SALARY = "SALARY",
  FREELANCE = "FREELANCE",
  BUSINESS = "BUSINESS",
  INVESTMENT = "INVESTMENT",
  TRADING = "TRADING",
  BONUS = "BONUS",
  GIFT = "GIFT",
  REFUND = "REFUND",
  OTHER_INCOME = "OTHER_INCOME",
}

// Категории расходов
export enum ExpenseCategory {
  FOOD_DINING = "FOOD_DINING",
  COFFEE = "COFFEE",
  GROCERIES = "GROCERIES",
  TRANSPORTATION = "TRANSPORTATION",
  HOUSING = "HOUSING",
  UTILITIES = "UTILITIES",
  ENTERTAINMENT = "ENTERTAINMENT",
  HEALTH = "HEALTH",
  SHOPPING = "SHOPPING",
  EDUCATION = "EDUCATION",
  OTHER_EXPENSE = "OTHER_EXPENSE",
}

// Специальные категории (только для внутреннего использования)
export enum InternalCategory {
  TRANSFER = "TRANSFER",
  GOAL_DEPOSIT = "GOAL_DEPOSIT",
  DEBT_REPAYMENT = "DEBT_REPAYMENT",
}

// Объединенный тип для хранения
export type TransactionCategory =
  | IncomeCategory
  | ExpenseCategory
  | InternalCategory

export interface Balance {
  currency: Currency
  amount: number
  accountId: string // e.g., 'Cash', 'Bank Card'
  lastUpdated: string | Date // Allow string for JSON compatibility
}

export interface Goal {
  id: string
  name: string
  targetAmount: number
  currentAmount: number
  currency: Currency
  deadline?: string | Date
  status: "ACTIVE" | "COMPLETED" | "PAUSED"
  autoDeposit?: {
    enabled: boolean
    amount: number
    accountId: string
    frequency: "WEEKLY" | "MONTHLY"
    dayOfMonth?: number // 1-31 для MONTHLY
    dayOfWeek?: number // 0-6 для WEEKLY
  }
}

export interface Debt {
  id: string
  name: string
  counterparty: string
  amount: number
  currency: Currency
  type: "I_OWE" | "OWES_ME"
  dueDate?: string | Date
  description?: string
  paidAmount: number
  isPaid: boolean
  reminderDaysBefore?: number // За сколько дней напомнить
  isRecurring?: boolean
  recurringFrequency?: "MONTHLY" | "WEEKLY"
  autoPayment?: {
    enabled: boolean
    amount: number
    accountId: string // FROM account
    frequency: "MONTHLY"
    dayOfMonth: number // 1-31
  }
}

export interface Transaction {
  id: string
  date: string | Date
  amount: number
  currency: Currency
  type: TransactionType
  category: TransactionCategory
  description?: string
  fromAccountId?: string // Required for EXPENSE and TRANSFER
  toAccountId?: string // Required for INCOME and TRANSFER
  tags?: string[]
}

export interface IncomeSource {
  id: string
  name: string
  expectedAmount?: number
  currency?: Currency
  frequency?: "MONTHLY" | "ONE_TIME"
  expectedDate?: number // День месяца (1-31)
  accountId?: string // Куда добавлять доход
  autoCreate?: {
    enabled: boolean
    amount: number
    accountId: string // TO account
    frequency: "MONTHLY"
    dayOfMonth: number // 1-31
  }
  reminderEnabled?: boolean
}

export interface Budget {
  id: string
  category: string
  amount: number
  period: BudgetPeriod
  currency: Currency
  createdAt: string
  updatedAt: string
}

export interface TransactionTemplate {
  id: string
  name: string
  category: string
  amount: number
  currency: Currency
  type: TransactionType
  accountId?: string
}

export interface UploadedStatement {
  id: string
  userId: string
  fileName: string
  bankType: BankType
  uploadedAt: Date
  processedAt?: Date
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED"
  parsedData?: BankParserResult
  importedCount?: number
}

export interface UserData {
  balances: Balance[]
  debts: Debt[]
  goals: Goal[]
  transactions: Transaction[]
  incomeSources: IncomeSource[]
  defaultCurrency: Currency
  budgets: Budget[]
  templates: TransactionTemplate[]
}

export interface DatabaseSchema {
  users: Record<string, UserData>
}

export interface CategoryBudget {
  limit: number
  spent: number
  currency?: Currency
}

// Automation & Reminders
export interface ReminderSettings {
  enabled: boolean
  time: string // "09:00" - время напоминаний
  timezone: string // "Asia/Tbilisi"
  channels: {
    telegram: boolean
    email?: boolean
  }
  notifyBefore: {
    debts: number // За сколько дней до долга
    goals: number // За сколько дней до дедлайна цели
    income: number // За сколько дней до дохода
  }
  customMessages?: {
    debt?: string // Шаблон для напоминаний о долгах
    goal?: string // Шаблон для напоминаний о целях
    income?: string // Шаблон для напоминаний о доходах
  }
}

export interface RecurringTransaction {
  id: string
  userId: string
  type: TransactionType
  amount: number
  currency: Currency
  category: TransactionCategory
  accountId: string
  frequency: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY"
  startDate: string | Date
  endDate?: string | Date
  nextExecutionDate: string | Date
  isActive: boolean
  autoExecute: boolean // Автоматически создавать или только напоминать
  description?: string
  dayOfMonth?: number // Для MONTHLY (1-31)
  dayOfWeek?: number // Для WEEKLY (0-6)
}

export interface ScheduledReminder {
  id: string
  userId: string
  type: "DEBT" | "GOAL" | "INCOME" | "RECURRING_TX"
  entityId: string // ID долга/цели/дохода
  reminderDate: string | Date
  message: string
  isProcessed: boolean
  createdAt: string | Date
}

// Notification Template Placeholders
export type NotificationPlaceholder =
  | "{name}"
  | "{amount}"
  | "{currency}"
  | "{dueDate}"
  | "{remaining}"
  | "{target}"
  | "{monthlyAmount}"
  | "{monthsLeft}"

// Bank Statement Parser Types
export type BankType = "TINKOFF" | "MONOBANK" | "REVOLUT" | "WISE" | "UNKNOWN"

export interface ParsedTransaction {
  date: string // ISO format
  amount: number
  currency: Currency
  type: TransactionType
  category?: TransactionCategory
  description: string
  accountId?: string
  confidence?: number // 0-1 для ML категоризации
}

export interface BankParserResult {
  bankType: BankType
  transactions: ParsedTransaction[]
  errors: string[]
  warnings: string[]
}

export interface BankParserOptions {
  defaultCurrency?: Currency
  defaultAccount?: string
  autoCategorie?: boolean
}
