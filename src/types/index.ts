import { BudgetPeriod } from "../database/entities/Budget"

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
  FOOD_DINING = "Food & dining 🍔",
  COFFEE = "Coffee ☕",
  GROCERIES = "Groceries 🛍️",
  TRANSPORTATION = "Transport 🚕",
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
  name: string
  counterparty: string
  amount: number
  currency: Currency
  type: "I_OWE" | "OWES_ME"
  dueDate?: string | Date
  description?: string
  paidAmount: number
  isPaid: boolean
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
