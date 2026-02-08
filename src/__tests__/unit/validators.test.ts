import {
  validateExpenseCategory,
  validateIncomeCategory,
  parseAmountWithCurrency,
} from "../../validators"
import { ExpenseCategory, IncomeCategory } from "../../types"
import {
  getExpenseCategoryLabel,
  getIncomeCategoryLabel,
} from "../../i18n"

describe("Validators", () => {
  describe("validateExpenseCategory", () => {
    test("should validate correct expense category", () => {
      expect(
        validateExpenseCategory(
          getExpenseCategoryLabel("en", ExpenseCategory.FOOD_DINING)
        )
      ).not.toBeNull()
      expect(
        validateExpenseCategory(
          getExpenseCategoryLabel("en", ExpenseCategory.COFFEE)
        )
      ).not.toBeNull()
      expect(
        validateExpenseCategory(
          getExpenseCategoryLabel("en", ExpenseCategory.GROCERIES)
        )
      ).not.toBeNull()
      expect(
        validateExpenseCategory(
          getExpenseCategoryLabel("en", ExpenseCategory.TRANSPORTATION)
        )
      ).not.toBeNull()
    })

    test("should reject invalid expense category", () => {
      expect(validateExpenseCategory("Invalid Category")).toBeNull()
      expect(validateExpenseCategory("")).toBeNull()
      expect(validateExpenseCategory("Salary")).toBeNull() // Income category
    })
  })

  describe("validateIncomeCategory", () => {
    test("should validate correct income category", () => {
      expect(
        validateIncomeCategory(
          getIncomeCategoryLabel("en", IncomeCategory.SALARY)
        )
      ).not.toBeNull()
      expect(
        validateIncomeCategory(
          getIncomeCategoryLabel("en", IncomeCategory.FREELANCE)
        )
      ).not.toBeNull()
      expect(
        validateIncomeCategory(
          getIncomeCategoryLabel("en", IncomeCategory.BUSINESS)
        )
      ).not.toBeNull()
    })

    test("should reject invalid income category", () => {
      expect(validateIncomeCategory("Invalid Category")).toBeNull()
      expect(validateIncomeCategory("Food & Dining")).toBeNull() // Expense category
    })
  })

  describe("parseAmountWithCurrency", () => {
    test("should parse amount with valid currency", () => {
      const result1 = parseAmountWithCurrency("100 USD")
      expect(result1).toEqual({ amount: 100, currency: "USD" })

      const result2 = parseAmountWithCurrency("50.5 EUR")
      expect(result2).toEqual({ amount: 50.5, currency: "EUR" })

      const result3 = parseAmountWithCurrency("1000 GEL")
      expect(result3).toEqual({ amount: 1000, currency: "GEL" })
    })

    test("should handle amount without currency (default to USD)", () => {
      const result = parseAmountWithCurrency("100")
      expect(result).toEqual({ amount: 100, currency: "USD" })
    })

    test("should handle different separators", () => {
      const result1 = parseAmountWithCurrency("100.50 USD")
      expect(result1).toEqual({ amount: 100.5, currency: "USD" })

      const result2 = parseAmountWithCurrency("100,50 EUR")
      expect(result2).toEqual({ amount: 100.5, currency: "EUR" })
    })

    test("should return null for invalid input", () => {
      expect(parseAmountWithCurrency("invalid")).toBeNull()
      expect(parseAmountWithCurrency("abc USD")).toBeNull()
      expect(parseAmountWithCurrency("")).toBeNull()
    })

    test("should handle negative amounts", () => {
      const result = parseAmountWithCurrency("-50 USD")
      expect(result).toEqual({ amount: -50, currency: "USD" })
    })
  })
})
