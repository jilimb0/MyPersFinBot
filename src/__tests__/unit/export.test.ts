import { CSVExporter } from "../../export/csv-exporter"
import { JSONExporter } from "../../export/json-exporter"
import { ExportService } from "../../export/export.service"
import { dbStorage } from "../../database/storage-db"
import { ExpenseCategory, TransactionType } from "../../types"

// Mock database
jest.mock("../../database/storage-db", () => ({
  dbStorage: {
    getAllTransactions: jest.fn(),
    getTransactionsByDateRange: jest.fn(),
    getUserData: jest.fn(),
  },
}))

// Mock FX
jest.mock("../../fx", () => ({
  convertSync: jest.fn((amount: number) => amount),
}))

const mockTransactions = [
  {
    id: "1",
    date: new Date("2026-01-01"),
    type: "EXPENSE" as const,
    category: "Food & dining 🍔",
    amount: 100,
    currency: "USD" as const,
    description: "Groceries",
    fromAccountId: "main",
  },
  {
    id: "2",
    date: new Date("2026-01-02"),
    type: "INCOME" as const,
    category: "SALARY",
    amount: 5000,
    currency: "USD" as const,
    description: "Monthly salary",
    toAccountId: "main",
  },
  {
    id: "3",
    date: new Date("2026-01-03"),
    type: "EXPENSE" as const,
    category: "TRANSPORT",
    amount: 50,
    currency: "USD" as const,
    description: "Gas",
    fromAccountId: "main",
  },
]

describe("CSVExporter", () => {
  let csvExporter: CSVExporter

  beforeEach(() => {
    csvExporter = new CSVExporter()
    jest.clearAllMocks()
  })

  describe("exportTransactions", () => {
    test("should export all transactions to CSV", async () => {
      ;(dbStorage.getAllTransactions as jest.Mock).mockResolvedValue(
        mockTransactions
      )

      const result = await csvExporter.exportTransactions("user123")

      expect(result.filename).toContain("transactions")
      expect(result.filename).toContain(".csv")
      expect(result.mimeType).toBe("text/csv")
      expect(result.recordCount).toBe(3)
      expect(result.data).toContain("Date,Type,Category")
      expect(result.data).toContain("Food & dining 🍔")
      expect(result.data).toContain("SALARY")
    })

    test("should apply type filter", async () => {
      ;(dbStorage.getAllTransactions as jest.Mock).mockResolvedValue(
        mockTransactions
      )

      const result = await csvExporter.exportTransactions("user123", {
        type: TransactionType.EXPENSE,
      })

      expect(result.recordCount).toBe(2) // Only 2 expenses
      expect(result.data).toContain("Food & dining 🍔")
      expect(result.data).not.toContain("SALARY")
    })

    test("should apply category filter", async () => {
      ;(dbStorage.getAllTransactions as jest.Mock).mockResolvedValue(
        mockTransactions
      )

      const result = await csvExporter.exportTransactions("user123", {
        category: ExpenseCategory.FOOD_DINING,
      })

      expect(result.recordCount).toBe(1)
      expect(result.data).toContain("Groceries")
    })

    test("should apply date range filter", async () => {
      const startDate = new Date("2026-01-01")
      const endDate = new Date("2026-01-02")

      ;(dbStorage.getTransactionsByDateRange as jest.Mock).mockResolvedValue(
        mockTransactions.slice(0, 2)
      )

      const result = await csvExporter.exportTransactions("user123", {
        startDate,
        endDate,
      })

      expect(dbStorage.getTransactionsByDateRange).toHaveBeenCalledWith(
        "user123",
        startDate,
        endDate
      )
      expect(result.recordCount).toBe(2)
    })

    test("should throw error when no transactions found", async () => {
      ;(dbStorage.getAllTransactions as jest.Mock).mockResolvedValue([])

      await expect(csvExporter.exportTransactions("user123")).rejects.toThrow(
        "No transactions found"
      )
    })
  })

  describe("exportExpenses", () => {
    test("should export only expenses", async () => {
      ;(dbStorage.getAllTransactions as jest.Mock).mockResolvedValue(
        mockTransactions
      )

      const result = await csvExporter.exportExpenses("user123")

      expect(result.recordCount).toBe(2)
      expect(result.filename).toContain("expense")
    })
  })

  describe("exportIncome", () => {
    test("should export only income", async () => {
      ;(dbStorage.getAllTransactions as jest.Mock).mockResolvedValue(
        mockTransactions
      )

      const result = await csvExporter.exportIncome("user123")

      expect(result.recordCount).toBe(1)
      expect(result.filename).toContain("income")
    })
  })

  describe("exportByCategory", () => {
    test("should export separate CSV for each category", async () => {
      ;(dbStorage.getAllTransactions as jest.Mock).mockResolvedValue(
        mockTransactions
      )

      const results = await csvExporter.exportByCategory("user123")

      expect(results.size).toBe(3) // FOOD, SALARY, TRANSPORT
      expect(results.has("Food & dining 🍔")).toBe(true)
      expect(results.has("SALARY")).toBe(true)
      expect(results.has("TRANSPORT")).toBe(true)
    })
  })
})

describe("JSONExporter", () => {
  let jsonExporter: JSONExporter

  beforeEach(() => {
    jsonExporter = new JSONExporter()
    jest.clearAllMocks()
  })

  describe("createBackup", () => {
    test("should create full backup", async () => {
      ;(dbStorage.getUserData as jest.Mock).mockResolvedValue({
        defaultCurrency: "USD",
        language: "en",
        transactions: mockTransactions,
        balances: [],
        debts: [],
        goals: [],
        budgets: [],
        incomeSources: [],
      })

      const result = await jsonExporter.createBackup("user123")

      expect(result.filename).toContain("backup")
      expect(result.filename).toContain(".json")
      expect(result.mimeType).toBe("application/json")
      expect(result.recordCount).toBe(3)

      const backup = JSON.parse(result.data as string)
      expect(backup.version).toBeDefined()
      expect(backup.userId).toBe("user123")
      expect(backup.transactions).toHaveLength(3)
    })
  })

  describe("exportTransactions", () => {
    test("should export transactions only", async () => {
      ;(dbStorage.getAllTransactions as jest.Mock).mockResolvedValue(
        mockTransactions
      )
      ;(dbStorage.getUserData as jest.Mock).mockResolvedValue({
        defaultCurrency: "USD",
      })

      const result = await jsonExporter.exportTransactions("user123")

      const data = JSON.parse(result.data as string)
      expect(data.transactions).toHaveLength(3)
      expect(data.balances).toBeUndefined()
    })
  })

  describe("validateBackup", () => {
    test("should validate correct backup", () => {
      const backup = {
        version: "1.0.0",
        exportDate: new Date(),
        userId: "user123",
        userData: { defaultCurrency: "USD" },
        transactions: mockTransactions,
      }

      const result = jsonExporter.validateBackup(JSON.stringify(backup))

      expect(result.valid).toBe(true)
      expect(result.version).toBe("1.0.0")
      expect(result.transactionCount).toBe(3)
    })

    test("should reject invalid backup", () => {
      const result = jsonExporter.validateBackup("invalid json")

      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })

    test("should reject backup without version", () => {
      const backup = {
        transactions: mockTransactions,
      }

      const result = jsonExporter.validateBackup(JSON.stringify(backup))

      expect(result.valid).toBe(false)
      expect(result.error).toContain("version")
    })
  })
})

describe("ExportService", () => {
  let exportService: ExportService

  beforeEach(() => {
    exportService = new ExportService()
    jest.clearAllMocks()
  })

  describe("quickExport", () => {
    test("should export all transactions", async () => {
      ;(dbStorage.getAllTransactions as jest.Mock).mockResolvedValue(
        mockTransactions
      )

      const result = await exportService.quickExport("user123", "all", "csv")

      expect(result.recordCount).toBe(3)
    })

    test("should export only expenses", async () => {
      ;(dbStorage.getAllTransactions as jest.Mock).mockResolvedValue(
        mockTransactions
      )

      const result = await exportService.quickExport(
        "user123",
        "expenses",
        "csv"
      )

      expect(result.recordCount).toBe(2)
    })

    test("should export this month", async () => {
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

      ;(dbStorage.getTransactionsByDateRange as jest.Mock).mockResolvedValue(
        mockTransactions
      )

      await exportService.quickExport("user123", "this_month", "csv")

      expect(dbStorage.getTransactionsByDateRange).toHaveBeenCalledWith(
        "user123",
        startOfMonth,
        expect.any(Date)
      )
    })
  })

  describe("getSupportedFormats", () => {
    test("should return all supported formats", () => {
      const formats = exportService.getSupportedFormats()

      expect(formats).toContain("csv")
      expect(formats).toContain("xlsx")
      expect(formats).toContain("json")
    })
  })

  describe("getPresets", () => {
    test("should return all presets", () => {
      const presets = exportService.getPresets()

      expect(presets).toContain("all")
      expect(presets).toContain("expenses")
      expect(presets).toContain("income")
      expect(presets).toContain("this_month")
      expect(presets).toContain("backup")
    })
  })
})
