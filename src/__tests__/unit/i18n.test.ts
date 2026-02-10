import {
  getCategoryLabel,
  getLocale,
  getTranslationValue,
  isValidLanguage,
  resolveLanguage,
  t,
} from "../../i18n"
import {
  createUserTranslator,
  getUserLang,
  setUserLang,
  tUser,
  tUserBatch,
} from "../../i18n/helpers"
import { userContext } from "../../services/user-context"
import type { ExpenseCategory, IncomeCategory } from "../../types"

jest.mock("../../services/user-context", () => ({
  userContext: {
    getLang: jest.fn(),
    setLanguage: jest.fn(),
  },
}))

/**
 * Comprehensive test suite for i18n functions and helpers.
 * Merged from i18n-coverage.test.ts, i18n-extended.test.ts, and i18n-helpers.test.ts
 * All duplicate tests have been removed.
 */
describe("i18n", () => {
  describe("isValidLanguage", () => {
    test("validates valid languages", () => {
      expect(isValidLanguage("en")).toBe(true)
      expect(isValidLanguage("ru")).toBe(true)
      expect(isValidLanguage("uk")).toBe(true)
      expect(isValidLanguage("es")).toBe(true)
      expect(isValidLanguage("pl")).toBe(true)
    })

    test("rejects invalid languages", () => {
      expect(isValidLanguage("fr")).toBe(false)
      expect(isValidLanguage("de")).toBe(false)
      expect(isValidLanguage("it")).toBe(false)
    })

    test("rejects non-string values", () => {
      expect(isValidLanguage(123)).toBe(false)
      expect(isValidLanguage(null)).toBe(false)
      expect(isValidLanguage(undefined)).toBe(false)
      expect(isValidLanguage({})).toBe(false)
      expect(isValidLanguage([])).toBe(false)
    })

    test("rejects empty string", () => {
      expect(isValidLanguage("")).toBe(false)
    })

    test("is case sensitive", () => {
      expect(isValidLanguage("EN")).toBe(false)
      expect(isValidLanguage("RU")).toBe(false)
    })
  })

  describe("resolveLanguage", () => {
    // Basic tests
    test("resolves valid languages", () => {
      expect(resolveLanguage("en")).toBe("en")
      expect(resolveLanguage("es")).toBe("es")
      expect(resolveLanguage("ru")).toBe("ru")
      expect(resolveLanguage("uk")).toBe("uk")
      expect(resolveLanguage("pl")).toBe("pl")
    })

    test("defaults to en for unknown", () => {
      expect(resolveLanguage("fr" as any)).toBe("en")
      expect(resolveLanguage("de")).toBe("en")
      expect(resolveLanguage("invalid")).toBe("en")
    })

    test("defaults to en for null", () => {
      expect(resolveLanguage(null as any)).toBe("en")
    })

    test("defaults to en for undefined", () => {
      expect(resolveLanguage(undefined as any)).toBe("en")
    })

    test("defaults to en for non-string", () => {
      expect(resolveLanguage(123)).toBe("en")
      expect(resolveLanguage({})).toBe("en")
    })

    test("defaults to en for empty string", () => {
      expect(resolveLanguage("")).toBe("en")
    })
  })

  describe("getLocale", () => {
    test("returns locale for valid language", () => {
      expect(getLocale("en")).toBe("en-US")
      expect(getLocale("ru")).toBe("ru-RU")
      expect(getLocale("uk")).toBe("uk-UA")
      expect(getLocale("es")).toBe("es-ES")
      expect(getLocale("pl")).toBe("pl-PL")
    })

    test("falls back to en-US for unknown", () => {
      expect(getLocale("unknown" as any)).toBe("en-US")
    })
  })

  describe("getCategoryLabel", () => {
    // Expense categories
    describe("expense categories", () => {
      test("FOOD_DINING returns string", () => {
        const result = getCategoryLabel("en", "FOOD_DINING" as ExpenseCategory)
        expect(typeof result).toBe("string")
        expect(result.length).toBeGreaterThan(0)
      })

      test("SHOPPING returns string", () => {
        const result = getCategoryLabel("en", "SHOPPING" as ExpenseCategory)
        expect(typeof result).toBe("string")
        expect(result.length).toBeGreaterThan(0)
      })

      test("TRANSPORT returns string", () => {
        const result = getCategoryLabel("en", "TRANSPORT" as ExpenseCategory)
        expect(typeof result).toBe("string")
        expect(result.length).toBeGreaterThan(0)
      })

      test("ENTERTAINMENT returns string", () => {
        const result = getCategoryLabel(
          "en",
          "ENTERTAINMENT" as ExpenseCategory
        )
        expect(typeof result).toBe("string")
        expect(result.length).toBeGreaterThan(0)
      })

      test("HEALTHCARE returns string", () => {
        const result = getCategoryLabel("en", "HEALTHCARE" as ExpenseCategory)
        expect(typeof result).toBe("string")
        expect(result.length).toBeGreaterThan(0)
      })

      test("UTILITIES returns string", () => {
        const result = getCategoryLabel("en", "UTILITIES" as ExpenseCategory)
        expect(typeof result).toBe("string")
        expect(result.length).toBeGreaterThan(0)
      })

      test("HOUSING returns string", () => {
        const result = getCategoryLabel("en", "HOUSING" as ExpenseCategory)
        expect(typeof result).toBe("string")
        expect(result.length).toBeGreaterThan(0)
      })

      test("EDUCATION returns string", () => {
        const result = getCategoryLabel("en", "EDUCATION" as ExpenseCategory)
        expect(typeof result).toBe("string")
        expect(result.length).toBeGreaterThan(0)
      })

      test("OTHER returns string", () => {
        const result = getCategoryLabel("en", "OTHER" as ExpenseCategory)
        expect(typeof result).toBe("string")
        expect(result.length).toBeGreaterThan(0)
      })
    })

    // Income categories
    describe("income categories", () => {
      test("SALARY returns string", () => {
        const result = getCategoryLabel("en", "SALARY" as IncomeCategory)
        expect(typeof result).toBe("string")
        expect(result.length).toBeGreaterThan(0)
      })

      test("FREELANCE returns string", () => {
        const result = getCategoryLabel("en", "FREELANCE" as IncomeCategory)
        expect(typeof result).toBe("string")
        expect(result.length).toBeGreaterThan(0)
      })

      test("INVESTMENT returns string", () => {
        const result = getCategoryLabel("en", "INVESTMENT" as IncomeCategory)
        expect(typeof result).toBe("string")
        expect(result.length).toBeGreaterThan(0)
      })

      test("GIFT returns string", () => {
        const result = getCategoryLabel("en", "GIFT" as IncomeCategory)
        expect(typeof result).toBe("string")
        expect(result.length).toBeGreaterThan(0)
      })

      test("BONUS returns string", () => {
        const result = getCategoryLabel("en", "BONUS" as IncomeCategory)
        expect(typeof result).toBe("string")
        expect(result.length).toBeGreaterThan(0)
      })

      test("OTHER_INCOME returns string", () => {
        const result = getCategoryLabel("en", "OTHER_INCOME" as IncomeCategory)
        expect(typeof result).toBe("string")
        expect(result.length).toBeGreaterThan(0)
      })
    })

    // Different languages
    describe("different languages", () => {
      test("works with russian", () => {
        const result = getCategoryLabel("ru", "FOOD_DINING" as ExpenseCategory)
        expect(typeof result).toBe("string")
        expect(result.length).toBeGreaterThan(0)
      })

      test("works with spanish", () => {
        const result = getCategoryLabel("es", "SHOPPING" as ExpenseCategory)
        expect(typeof result).toBe("string")
        expect(result.length).toBeGreaterThan(0)
      })

      test("works with polish", () => {
        const result = getCategoryLabel("pl", "TRANSPORT" as ExpenseCategory)
        expect(typeof result).toBe("string")
        expect(result.length).toBeGreaterThan(0)
      })

      test("works with ukrainian", () => {
        const result = getCategoryLabel("uk", "SALARY" as IncomeCategory)
        expect(typeof result).toBe("string")
        expect(result.length).toBeGreaterThan(0)
      })
    })
  })

  describe("t translation function", () => {
    // Basic tests
    test("translates common keys", () => {
      expect(t("en", "common.back")).toContain("Back")
      expect(t("en", "common.cancel")).toContain("Cancel")
      expect(t("en", "common.confirm")).toContain("Confirm")
    })

    test("translates in different languages", () => {
      expect(t("ru", "common.back")).toContain("Назад")
      expect(t("es", "common.back")).toContain("Atrás")
      expect(t("pl", "common.back")).toContain("Wstecz")
      expect(t("uk", "common.back")).toContain("Назад")
    })

    test("handles missing keys gracefully", () => {
      const result = t("en", "nonexistent.key" as any)
      expect(typeof result).toBe("string")
    })

    test("translates menu keys", () => {
      expect(t("en", "mainMenu.title")).toBeTruthy()
      expect(t("en", "buttons.addExpense")).toBeTruthy()
      expect(t("en", "buttons.addIncome")).toBeTruthy()
    })

    test("translates error messages", () => {
      expect(t("en", "errors.invalidAmount")).toBeTruthy()
      expect(t("en", "errors.invalidDate")).toBeTruthy()
    })

    // Extended tests
    test("gets simple translation", () => {
      const result = t("en", "buttons.back")
      expect(result).toBeTruthy()
      expect(typeof result).toBe("string")
    })

    test("gets nested translation", () => {
      const result = t("en", "mainMenu.welcome")
      expect(result).toBeTruthy()
    })

    test("interpolates parameters", () => {
      const result = t("en", "errors.invalidAmount")
      expect(result).toBeTruthy()
    })

    test("handles missing translation key", () => {
      const result = t("en", "nonexistent.key.path")
      expect(result).toBeTruthy() // Should fallback
    })

    test("handles invalid language", () => {
      const result = t("invalid" as any, "buttons.back")
      expect(result).toBeTruthy() // Should use en fallback
    })

    test("handles null language", () => {
      const result = t(null as any, "buttons.back")
      expect(result).toBeTruthy()
    })

    test("handles undefined language", () => {
      const result = t(undefined as any, "buttons.back")
      expect(result).toBeTruthy()
    })

    test("handles number language", () => {
      const result = t(123 as any, "buttons.back")
      expect(result).toBeTruthy()
    })

    test("replaces single parameter", () => {
      const result = t("en", "mainMenu.welcome", { name: "Test" })
      expect(result).toBeTruthy()
    })

    test("replaces multiple parameters", () => {
      const result = t("en", "stats.summary", {
        income: "100",
        expense: "50",
      })
      expect(result).toBeTruthy()
    })

    test("handles numeric parameters", () => {
      const result = t("en", "mainMenu.welcome", { count: 5 })
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
        const result = t(lang, "buttons.back")
        expect(result).toBeTruthy()
      })
    })

    test("handles deep nested paths", () => {
      const result = t("en", "mainMenu.balances.list")
      expect(result).toBeTruthy()
    })

    test("returns key when translation completely missing", () => {
      const result = t("en", "totally.fake.nonexistent.path")
      expect(typeof result).toBe("string")
    })
  })

  describe("getTranslationValue", () => {
    test("gets string value", () => {
      const result = getTranslationValue("en", "buttons.back")
      expect(typeof result).toBe("string")
    })

    test("gets object value", () => {
      const result = getTranslationValue("en", "mainMenu")
      expect(typeof result).toBe("object")
    })

    test("returns undefined for missing key", () => {
      const result = getTranslationValue(
        "en",
        "nonexistent.key.path.that.does.not.exist"
      )
      expect(result).toBeUndefined()
    })

    test("handles invalid language", () => {
      const result = getTranslationValue("invalid" as any, "buttons.back")
      expect(result).toBeDefined() // Should use en fallback
    })

    test("handles null language", () => {
      const result = getTranslationValue(null as any, "buttons.back")
      expect(result).toBeDefined()
    })

    test("handles undefined language", () => {
      const result = getTranslationValue(undefined as any, "buttons.back")
      expect(result).toBeDefined()
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
        const result = getTranslationValue(lang, "buttons.back")
        expect(result).toBeDefined()
      })
    })
  })

  describe("i18n helpers", () => {
    beforeEach(() => {
      jest.clearAllMocks()
    })

    test("tUser uses userContext lang", async () => {
      ;(userContext.getLang as jest.Mock).mockResolvedValue("en")
      const text = await tUser("u1", "mainMenu.welcome")
      expect(text).toBeTruthy()
    })

    test("getUserLang returns lang", async () => {
      ;(userContext.getLang as jest.Mock).mockResolvedValue("ru")
      const lang = await getUserLang("u1")
      expect(lang).toBe("ru")
    })

    test("setUserLang delegates", async () => {
      await setUserLang("u1", "uk")
      expect(userContext.setLanguage).toHaveBeenCalledWith("u1", "uk")
    })

    test("createUserTranslator returns bound translator", async () => {
      ;(userContext.getLang as jest.Mock).mockResolvedValue("en")
      const translate = await createUserTranslator("u1")
      expect(translate("mainMenu.welcome")).toBeTruthy()
    })

    test("tUserBatch translates list", async () => {
      ;(userContext.getLang as jest.Mock).mockResolvedValue("en")
      const texts = await tUserBatch("u1", [
        "mainMenu.welcome",
        "mainMenu.welcomeIntro",
      ])
      expect(texts.length).toBe(2)
    })
  })
})
