import {
  getCategoryLabel,
  getExpenseCategoryByLabel,
  getExpenseCategoryKey,
  getExpenseCategoryLabel,
  getIncomeCategoryByLabel,
  getIncomeCategoryKey,
  getIncomeCategoryLabel,
  getInternalCategoryKey,
  getInternalCategoryLabel,
  normalizeCategoryValue,
} from "../../i18n/categories"
import { ExpenseCategory, IncomeCategory, InternalCategory } from "../../types"

describe("Categories Extended", () => {
  describe("getExpenseCategoryKey", () => {
    test("returns key for valid expense category value", () => {
      expect(getExpenseCategoryKey(ExpenseCategory.FOOD_DINING)).toBe(
        "FOOD_DINING"
      )
      expect(getExpenseCategoryKey(ExpenseCategory.TRANSPORTATION)).toBe(
        "TRANSPORTATION"
      )
      expect(getExpenseCategoryKey(ExpenseCategory.HEALTH)).toBe("HEALTH")
    })

    test("returns key for string category value", () => {
      expect(getExpenseCategoryKey("FOOD_DINING")).toBe("FOOD_DINING")
      expect(getExpenseCategoryKey("TRANSPORTATION")).toBe("TRANSPORTATION")
    })

    test("handles whitespace", () => {
      expect(getExpenseCategoryKey("  FOOD_DINING  ")).toBe("FOOD_DINING")
    })

    test("returns null for invalid category", () => {
      expect(getExpenseCategoryKey("INVALID")).toBeNull()
      expect(getExpenseCategoryKey("")).toBeNull()
    })

    test("handles all expense categories", () => {
      Object.values(ExpenseCategory).forEach((cat) => {
        expect(getExpenseCategoryKey(cat)).toBeTruthy()
      })
    })
  })

  describe("getIncomeCategoryKey", () => {
    test("returns key for valid income category value", () => {
      expect(getIncomeCategoryKey(IncomeCategory.SALARY)).toBe("SALARY")
      expect(getIncomeCategoryKey(IncomeCategory.FREELANCE)).toBe("FREELANCE")
      expect(getIncomeCategoryKey(IncomeCategory.BONUS)).toBe("BONUS")
    })

    test("returns key for string category value", () => {
      expect(getIncomeCategoryKey("SALARY")).toBe("SALARY")
      expect(getIncomeCategoryKey("FREELANCE")).toBe("FREELANCE")
    })

    test("handles whitespace", () => {
      expect(getIncomeCategoryKey("  SALARY  ")).toBe("SALARY")
    })

    test("returns null for invalid category", () => {
      expect(getIncomeCategoryKey("INVALID")).toBeNull()
      expect(getIncomeCategoryKey("")).toBeNull()
    })

    test("handles all income categories", () => {
      Object.values(IncomeCategory).forEach((cat) => {
        expect(getIncomeCategoryKey(cat)).toBeTruthy()
      })
    })
  })

  describe("getInternalCategoryKey", () => {
    test("returns key for valid internal category value", () => {
      expect(getInternalCategoryKey(InternalCategory.TRANSFER)).toBe("TRANSFER")
      expect(getInternalCategoryKey(InternalCategory.GOAL_DEPOSIT)).toBe(
        "GOAL_DEPOSIT"
      )
      expect(getInternalCategoryKey(InternalCategory.DEBT_REPAYMENT)).toBe(
        "DEBT_REPAYMENT"
      )
    })

    test("returns key for string category value", () => {
      expect(getInternalCategoryKey("TRANSFER")).toBe("TRANSFER")
      expect(getInternalCategoryKey("GOAL_DEPOSIT")).toBe("GOAL_DEPOSIT")
    })

    test("handles whitespace", () => {
      expect(getInternalCategoryKey("  TRANSFER  ")).toBe("TRANSFER")
    })

    test("returns null for invalid category", () => {
      expect(getInternalCategoryKey("INVALID")).toBeNull()
      expect(getInternalCategoryKey("")).toBeNull()
    })

    test("handles all internal categories", () => {
      Object.values(InternalCategory).forEach((cat) => {
        expect(getInternalCategoryKey(cat)).toBeTruthy()
      })
    })
  })

  describe("normalizeCategoryValue", () => {
    test("normalizes expense categories", () => {
      expect(normalizeCategoryValue("FOOD_DINING")).toBe(
        ExpenseCategory.FOOD_DINING
      )
      expect(normalizeCategoryValue("TRANSPORTATION")).toBe(
        ExpenseCategory.TRANSPORTATION
      )
    })

    test("normalizes income categories", () => {
      expect(normalizeCategoryValue("SALARY")).toBe(IncomeCategory.SALARY)
      expect(normalizeCategoryValue("FREELANCE")).toBe(IncomeCategory.FREELANCE)
    })

    test("normalizes internal categories", () => {
      expect(normalizeCategoryValue("TRANSFER")).toBe(InternalCategory.TRANSFER)
      expect(normalizeCategoryValue("GOAL_DEPOSIT")).toBe(
        InternalCategory.GOAL_DEPOSIT
      )
    })

    test("handles legacy categories with emojis", () => {
      expect(normalizeCategoryValue("Food & dining 🍔")).toBe(
        ExpenseCategory.FOOD_DINING
      )
      expect(normalizeCategoryValue("Salary 💼")).toBe(IncomeCategory.SALARY)
      expect(normalizeCategoryValue("Transfer ↔️")).toBe(
        InternalCategory.TRANSFER
      )
    })

    test("handles whitespace", () => {
      expect(normalizeCategoryValue("  FOOD_DINING  ")).toBe(
        ExpenseCategory.FOOD_DINING
      )
    })

    test("returns null for invalid category", () => {
      expect(normalizeCategoryValue("INVALID")).toBeNull()
      expect(normalizeCategoryValue("")).toBeNull()
    })

    test("returns null for empty value", () => {
      expect(normalizeCategoryValue("" as any)).toBeNull()
    })
  })

  describe("getExpenseCategoryLabel", () => {
    test("returns full label for expense category", () => {
      const result = getExpenseCategoryLabel("en", ExpenseCategory.FOOD_DINING)
      expect(result).toBeTruthy()
      expect(typeof result).toBe("string")
    })

    test("returns short label when variant is short", () => {
      const result = getExpenseCategoryLabel(
        "en",
        ExpenseCategory.FOOD_DINING,
        "short"
      )
      expect(result).toBeTruthy()
    })

    test("works with all languages", () => {
      const langs: Array<"en" | "ru" | "uk" | "es" | "pl"> = [
        "en",
        "ru",
        "uk",
        "es",
        "pl",
      ]
      langs.forEach((lang) => {
        const result = getExpenseCategoryLabel(
          lang,
          ExpenseCategory.FOOD_DINING
        )
        expect(result).toBeTruthy()
      })
    })

    test("returns string value for invalid category", () => {
      const result = getExpenseCategoryLabel("en", "INVALID" as any)
      expect(result).toBe("INVALID")
    })

    test("handles all expense categories", () => {
      Object.values(ExpenseCategory).forEach((cat) => {
        const result = getExpenseCategoryLabel("en", cat)
        expect(result).toBeTruthy()
      })
    })
  })

  describe("getIncomeCategoryLabel", () => {
    test("returns full label for income category", () => {
      const result = getIncomeCategoryLabel("en", IncomeCategory.SALARY)
      expect(result).toBeTruthy()
      expect(typeof result).toBe("string")
    })

    test("returns short label when variant is short", () => {
      const result = getIncomeCategoryLabel(
        "en",
        IncomeCategory.SALARY,
        "short"
      )
      expect(result).toBeTruthy()
    })

    test("works with all languages", () => {
      const langs: Array<"en" | "ru" | "uk" | "es" | "pl"> = [
        "en",
        "ru",
        "uk",
        "es",
        "pl",
      ]
      langs.forEach((lang) => {
        const result = getIncomeCategoryLabel(lang, IncomeCategory.SALARY)
        expect(result).toBeTruthy()
      })
    })

    test("returns string value for invalid category", () => {
      const result = getIncomeCategoryLabel("en", "INVALID" as any)
      expect(result).toBe("INVALID")
    })

    test("handles all income categories", () => {
      Object.values(IncomeCategory).forEach((cat) => {
        const result = getIncomeCategoryLabel("en", cat)
        expect(result).toBeTruthy()
      })
    })
  })

  describe("getInternalCategoryLabel", () => {
    test("returns full label for internal category", () => {
      const result = getInternalCategoryLabel("en", InternalCategory.TRANSFER)
      expect(result).toBeTruthy()
      expect(typeof result).toBe("string")
    })

    test("returns short label when variant is short", () => {
      const result = getInternalCategoryLabel(
        "en",
        InternalCategory.TRANSFER,
        "short"
      )
      expect(result).toBeTruthy()
    })

    test("works with all languages", () => {
      const langs: Array<"en" | "ru" | "uk" | "es" | "pl"> = [
        "en",
        "ru",
        "uk",
        "es",
        "pl",
      ]
      langs.forEach((lang) => {
        const result = getInternalCategoryLabel(lang, InternalCategory.TRANSFER)
        expect(result).toBeTruthy()
      })
    })

    test("returns string value for invalid category", () => {
      const result = getInternalCategoryLabel("en", "INVALID" as any)
      expect(result).toBe("INVALID")
    })

    test("handles all internal categories", () => {
      Object.values(InternalCategory).forEach((cat) => {
        const result = getInternalCategoryLabel("en", cat)
        expect(result).toBeTruthy()
      })
    })
  })

  describe("getCategoryLabel", () => {
    test("handles expense categories", () => {
      const result = getCategoryLabel("en", ExpenseCategory.FOOD_DINING)
      expect(result).toBeTruthy()
    })

    test("handles income categories", () => {
      const result = getCategoryLabel("en", IncomeCategory.SALARY)
      expect(result).toBeTruthy()
    })

    test("handles internal categories", () => {
      const result = getCategoryLabel("en", InternalCategory.TRANSFER)
      expect(result).toBeTruthy()
    })

    test("returns short variant", () => {
      const result = getCategoryLabel(
        "en",
        ExpenseCategory.FOOD_DINING,
        "short"
      )
      expect(result).toBeTruthy()
    })

    test("works with all languages", () => {
      const langs: Array<"en" | "ru" | "uk" | "es" | "pl"> = [
        "en",
        "ru",
        "uk",
        "es",
        "pl",
      ]
      langs.forEach((lang) => {
        const result = getCategoryLabel(lang, ExpenseCategory.FOOD_DINING)
        expect(result).toBeTruthy()
      })
    })

    test("returns string value for invalid category", () => {
      const result = getCategoryLabel("en", "INVALID" as any)
      expect(result).toBe("INVALID")
    })
  })

  describe("getExpenseCategoryByLabel", () => {
    test("finds category by category value", () => {
      const result = getExpenseCategoryByLabel("FOOD_DINING")
      expect(result).toBe(ExpenseCategory.FOOD_DINING)
    })

    test("finds another category by value", () => {
      const result = getExpenseCategoryByLabel("TRANSPORTATION")
      expect(result).toBe(ExpenseCategory.TRANSPORTATION)
    })

    test("handles whitespace", () => {
      const result = getExpenseCategoryByLabel("  FOOD_DINING  ")
      expect(result).toBe(ExpenseCategory.FOOD_DINING)
    })

    test("returns null for invalid label", () => {
      expect(getExpenseCategoryByLabel("Invalid Category")).toBeNull()
      expect(getExpenseCategoryByLabel("")).toBeNull()
    })

    test("works across all languages", () => {
      // Just verify it searches through all languages
      Object.values(ExpenseCategory).forEach((cat) => {
        const result = getExpenseCategoryByLabel(cat)
        expect(result).toBeTruthy()
      })
    })
  })

  describe("getIncomeCategoryByLabel", () => {
    test("finds category by category value", () => {
      const result = getIncomeCategoryByLabel("SALARY")
      expect(result).toBe(IncomeCategory.SALARY)
    })

    test("finds another category by value", () => {
      const result = getIncomeCategoryByLabel("FREELANCE")
      expect(result).toBe(IncomeCategory.FREELANCE)
    })

    test("handles whitespace", () => {
      const result = getIncomeCategoryByLabel("  SALARY  ")
      expect(result).toBe(IncomeCategory.SALARY)
    })

    test("returns null for invalid label", () => {
      expect(getIncomeCategoryByLabel("Invalid Category")).toBeNull()
      expect(getIncomeCategoryByLabel("")).toBeNull()
    })

    test("works across all languages", () => {
      // Just verify it searches through all languages
      Object.values(IncomeCategory).forEach((cat) => {
        const result = getIncomeCategoryByLabel(cat)
        expect(result).toBeTruthy()
      })
    })
  })
})
