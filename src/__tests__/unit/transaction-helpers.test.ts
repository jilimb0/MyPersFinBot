import { getCategoryLabel, t } from "../../i18n"
import {
  type Currency,
  ExpenseCategory,
  IncomeCategory,
  InternalCategory,
  type Transaction,
  TransactionType,
} from "../../types"
import {
  getTransactionLabel,
  getTransactionSign,
  matchTransaction,
} from "../../utils/transaction-helpers"

/**
 * Comprehensive test suite for transaction helper functions.
 * Merged from transaction-helpers.test.ts and transaction-helpers-extra.test.ts
 * All duplicate tests have been removed.
 */
describe("transaction-helpers", () => {
  describe("matchTransaction", () => {
    const baseTx: Transaction = {
      id: "tx-1",
      date: new Date(),
      amount: 10,
      currency: "USD" as Currency,
      type: TransactionType.EXPENSE,
      category: ExpenseCategory.FOOD_DINING,
      fromAccountId: "cash",
      toAccountId: undefined,
    }

    // Basic tests
    test("matches when all filters pass", () => {
      expect(
        matchTransaction(baseTx, TransactionType.EXPENSE, "cash", "FOOD_DINING")
      ).toBe(true)
    })

    test("fails when type mismatches", () => {
      expect(matchTransaction(baseTx, TransactionType.INCOME)).toBe(false)
    })

    test("fails when account filter mismatches", () => {
      expect(matchTransaction(baseTx, undefined, "bank")).toBe(false)
    })

    test("fails when category mismatches", () => {
      expect(matchTransaction(baseTx, undefined, undefined, "TRAVEL")).toBe(
        false
      )
    })

    test("matches when account filter matches toAccountId", () => {
      expect(
        matchTransaction({ ...baseTx, toAccountId: "bank" }, undefined, "bank")
      ).toBe(true)
    })

    // Extended tests - unique
    test("matches transaction without filters", () => {
      expect(matchTransaction(baseTx)).toBe(true)
    })

    test("matches transaction by fromAccountId", () => {
      expect(matchTransaction(baseTx, undefined, "cash")).toBe(true)
      expect(matchTransaction(baseTx, undefined, "bank")).toBe(false)
    })

    test("matches transaction by toAccountId", () => {
      const transferTx = {
        ...baseTx,
        type: TransactionType.TRANSFER,
        toAccountId: "bank",
      }
      expect(matchTransaction(transferTx, undefined, "bank")).toBe(true)
      expect(matchTransaction(transferTx, undefined, "savings")).toBe(false)
    })

    test("matches with all filters", () => {
      expect(
        matchTransaction(
          baseTx,
          TransactionType.EXPENSE,
          "cash",
          ExpenseCategory.FOOD_DINING
        )
      ).toBe(true)
    })

    test("fails when type does not match", () => {
      expect(
        matchTransaction(
          baseTx,
          TransactionType.INCOME,
          "cash",
          ExpenseCategory.FOOD_DINING
        )
      ).toBe(false)
    })

    test("fails when account does not match", () => {
      expect(
        matchTransaction(
          baseTx,
          TransactionType.EXPENSE,
          "bank",
          ExpenseCategory.FOOD_DINING
        )
      ).toBe(false)
    })

    test("fails when category does not match", () => {
      expect(
        matchTransaction(
          baseTx,
          TransactionType.EXPENSE,
          "cash",
          ExpenseCategory.TRANSPORTATION
        )
      ).toBe(false)
    })

    test("matches income transaction", () => {
      const incomeTx = {
        ...baseTx,
        type: TransactionType.INCOME,
        category: IncomeCategory.SALARY,
        fromAccountId: undefined,
        toAccountId: "bank",
      }
      expect(matchTransaction(incomeTx, TransactionType.INCOME)).toBe(true)
      expect(matchTransaction(incomeTx, undefined, "bank")).toBe(true)
    })

    test("matches transfer transaction", () => {
      const transferTx = {
        ...baseTx,
        type: TransactionType.TRANSFER,
        category: InternalCategory.TRANSFER,
        fromAccountId: "cash",
        toAccountId: "bank",
      }
      expect(matchTransaction(transferTx, TransactionType.TRANSFER)).toBe(true)
      expect(matchTransaction(transferTx, undefined, "cash")).toBe(true)
      expect(matchTransaction(transferTx, undefined, "bank")).toBe(true)
    })

    test("handles transaction with null category", () => {
      const txNoCategory = { ...baseTx, category: null as any }
      expect(
        matchTransaction(
          txNoCategory,
          undefined,
          undefined,
          ExpenseCategory.FOOD_DINING
        )
      ).toBe(false)
    })

    test("handles transaction with null accountIds", () => {
      const txNoAccounts = {
        ...baseTx,
        fromAccountId: null as any,
        toAccountId: null as any,
      }
      expect(matchTransaction(txNoAccounts, undefined, "cash")).toBe(false)
    })
  })

  describe("getTransactionSign", () => {
    test("expense uses minus", () => {
      expect(getTransactionSign(TransactionType.EXPENSE)).toBe("-")
    })

    test("income uses plus", () => {
      expect(getTransactionSign(TransactionType.INCOME)).toBe("+")
    })

    test("transfer uses arrow", () => {
      expect(getTransactionSign(TransactionType.TRANSFER)).toBe("↔")
    })

    test("handles all transaction types", () => {
      const signs = [
        getTransactionSign(TransactionType.EXPENSE),
        getTransactionSign(TransactionType.INCOME),
        getTransactionSign(TransactionType.TRANSFER),
      ]
      expect(signs).toEqual(["-", "+", "↔"])
    })
  })

  describe("getTransactionLabel", () => {
    const lang = "en"
    const mockTx: Transaction = {
      id: "1",
      type: TransactionType.EXPENSE,
      amount: 100,
      currency: "USD",
      category: ExpenseCategory.FOOD_DINING,
      date: new Date(),
    }

    // Basic tests
    test("formats goal deposit line", () => {
      const label = getTransactionLabel(lang, {
        id: "tx-2",
        date: new Date(),
        amount: 20,
        currency: "USD" as Currency,
        type: TransactionType.EXPENSE,
        category: InternalCategory.GOAL_DEPOSIT,
        description: "Goal Deposit: Vacation",
      })
      expect(label).toBe(
        t(lang, "reminders.messages.goalLine", { name: "Vacation" })
      )
    })

    test("formats debt repayment line", () => {
      const label = getTransactionLabel(lang, {
        id: "tx-3",
        date: new Date(),
        amount: 20,
        currency: "USD" as Currency,
        type: TransactionType.EXPENSE,
        category: InternalCategory.DEBT_REPAYMENT,
        description: "Debt repayment: John",
      })
      expect(label).toBe(
        t(lang, "reminders.messages.debtLine", { name: "John" })
      )
    })

    test("falls back to category label", () => {
      const label = getTransactionLabel(lang, {
        id: "tx-4",
        date: new Date(),
        amount: 20,
        currency: "USD" as Currency,
        type: TransactionType.EXPENSE,
        category: ExpenseCategory.FOOD_DINING,
        description: "Lunch",
      })
      expect(label).toBe(getCategoryLabel(lang, "FOOD_DINING"))
    })

    // Extended tests - unique
    test("returns category label for regular transaction", () => {
      const result = getTransactionLabel("en", mockTx)
      expect(result).toBeTruthy()
      expect(typeof result).toBe("string")
    })

    test("handles goal deposit specially", () => {
      const goalTx = {
        ...mockTx,
        category: InternalCategory.GOAL_DEPOSIT,
        description: "Goal Deposit: Vacation Fund",
      }
      const result = getTransactionLabel("en", goalTx)
      expect(result).toBeTruthy()
    })

    test("handles debt repayment specially", () => {
      const debtTx = {
        ...mockTx,
        category: InternalCategory.DEBT_REPAYMENT,
        description: "Debt repayment: John Doe",
      }
      const result = getTransactionLabel("en", debtTx)
      expect(result).toBeTruthy()
    })

    test("works with different languages", () => {
      const enLabel = getTransactionLabel("en", mockTx)
      const ruLabel = getTransactionLabel("ru", mockTx)
      expect(enLabel).toBeTruthy()
      expect(ruLabel).toBeTruthy()
    })

    test("handles income categories", () => {
      const incomeTx = {
        ...mockTx,
        type: TransactionType.INCOME,
        category: IncomeCategory.SALARY,
      }
      const result = getTransactionLabel("en", incomeTx)
      expect(result).toBeTruthy()
    })

    test("handles transfer category", () => {
      const transferTx = {
        ...mockTx,
        type: TransactionType.TRANSFER,
        category: InternalCategory.TRANSFER,
      }
      const result = getTransactionLabel("en", transferTx)
      expect(result).toBeTruthy()
    })

    test("handles goal deposit without proper description", () => {
      const goalTx = {
        ...mockTx,
        category: InternalCategory.GOAL_DEPOSIT,
        description: "Some other text",
      }
      const result = getTransactionLabel("en", goalTx)
      expect(result).toBeTruthy()
    })

    test("handles debt repayment without proper description", () => {
      const debtTx = {
        ...mockTx,
        category: InternalCategory.DEBT_REPAYMENT,
        description: "Some payment",
      }
      const result = getTransactionLabel("en", debtTx)
      expect(result).toBeTruthy()
    })

    test("handles transaction with no description", () => {
      const txNoDesc = { ...mockTx, description: undefined }
      const result = getTransactionLabel("en", txNoDesc)
      expect(result).toBeTruthy()
    })

    test("handles goal deposit with extra spaces", () => {
      const goalTx = {
        ...mockTx,
        category: InternalCategory.GOAL_DEPOSIT,
        description: "Goal Deposit:   My Goal  ",
      }
      const result = getTransactionLabel("en", goalTx)
      expect(result).toBeTruthy()
    })

    test("handles debt repayment with extra spaces", () => {
      const debtTx = {
        ...mockTx,
        category: InternalCategory.DEBT_REPAYMENT,
        description: "Debt repayment:   Alice  ",
      }
      const result = getTransactionLabel("en", debtTx)
      expect(result).toBeTruthy()
    })

    test("works with Spanish language", () => {
      const result = getTransactionLabel("es", mockTx)
      expect(result).toBeTruthy()
    })

    test("handles multiple expense categories", () => {
      const categories = [
        ExpenseCategory.FOOD_DINING,
        ExpenseCategory.TRANSPORTATION,
        ExpenseCategory.ENTERTAINMENT,
        ExpenseCategory.SHOPPING,
        ExpenseCategory.HEALTH,
      ]
      categories.forEach((category) => {
        const tx = { ...mockTx, category }
        const result = getTransactionLabel("en", tx)
        expect(result).toBeTruthy()
      })
    })
  })
})
