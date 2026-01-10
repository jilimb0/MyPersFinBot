export type Currency = "USD" | "EUR" | "GEL" | "RUB" | "UAH" | "PLN"

export enum TransactionType {
  INCOME = "INCOME",
  EXPENSE = "EXPENSE",
  TRANSFER = "TRANSFER",
}

// Категории доходов
export enum IncomeCategory {
  SALARY = "Salary 💼",
  FREELANCE = "Freelance 💻",
  BUSINESS = "Business 💼",
  INVESTMENT = "Investment 📈",
  TRADING = "Trading 💸",
  BONUS = "Bonus 🎁",
  GIFT = "Gift 🎁",
  REFUND = "Refund 🔄",
  OTHER_INCOME = "Other 💰",
}

// Категории расходов
export enum ExpenseCategory {
  FOOD = "Food 🍔",
  COFFEE = "Coffee ☕",
  GROCERIES = "Groceries 🛍️",
  TRANSPORT = "Transport 🚕",
  HOUSING = "Housing 🏠",
  UTILITIES = "Utilities 💡",
  ENTERTAINMENT = "Entertainment 🎬",
  HEALTH = "Health 🏥",
  SHOPPING = "Shopping 🛒",
  EDUCATION = "Education 📚",
  OTHER_EXPENSE = "Other 📦",
}

// Специальные категории (только для внутреннего использования)
export enum InternalCategory {
  TRANSFER = "Transfer ↔️",
  GOAL_DEPOSIT = "Goal 🎯",
  DEBT_REPAYMENT = "Debt 📉",
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
}

export interface Debt {
  id: string
  name: string // Added: Display name/Identifier used in Wizard
  counterparty: string // Who owes whom
  amount: number
  currency: Currency
  type: "I_OWE" | "OWES_ME"
  dueDate?: string | Date
  description?: string
  paidAmount: number // Added: Track partial payments
  isPaid: boolean // Added: Status flag
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
}

export interface UserData {
  balances: Balance[]
  debts: Debt[]
  goals: Goal[]
  transactions: Transaction[]
  incomeSources: IncomeSource[]
  defaultCurrency: Currency // Дефолтная валюта пользователя
}

export interface DatabaseSchema {
  users: Record<string, UserData>
}
