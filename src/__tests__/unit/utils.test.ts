import {
  calculatePercentage,
  createListButtons,
  escapeMarkdown,
  formatAmount,
  formatCompactNumber,
  formatDate,
  formatDateDisplay,
  formatDateShort,
  formatMoney,
  isPositiveNumber,
  roundToDecimal,
  roundToTwo,
  truncate,
  truncateString,
} from "../../utils"

/**
 * Comprehensive test suite for utility functions.
 * Merged from utils.test.ts and utils-extended.test.ts
 * All duplicate tests have been removed.
 */
describe("utils", () => {
  describe("escapeMarkdown", () => {
    test("escapes special characters", () => {
      expect(escapeMarkdown("*bold*")).toBe("\\*bold\\*")
      expect(escapeMarkdown("_italic_")).toBe("\\_italic\\_")
      expect(escapeMarkdown("[link]")).toBe("\\[link\\]")
    })

    test("handles empty string", () => {
      expect(escapeMarkdown("")).toBe("")
    })

    test("handles normal text", () => {
      expect(escapeMarkdown("Hello World")).toBe("Hello World")
    })

    test("escapes multiple special chars", () => {
      expect(escapeMarkdown("*_test_*")).toContain("\\*")
      expect(escapeMarkdown("*_test_*")).toContain("\\_")
    })

    test("escapes backticks", () => {
      expect(escapeMarkdown("`code`")).toContain("\\`")
    })

    test("escapes parentheses", () => {
      expect(escapeMarkdown("(text)")).toContain("\\(")
      expect(escapeMarkdown("(text)")).toContain("\\)")
    })
  })

  describe("formatAmount", () => {
    test("formats integer amounts", () => {
      expect(formatAmount(100)).toBe("100")
    })

    test("formats decimal amounts", () => {
      expect(formatAmount(99.99)).toBe("99.99")
    })

    test("formats negative amounts", () => {
      expect(formatAmount(-50)).toBe("-50")
    })

    test("formats zero", () => {
      expect(formatAmount(0)).toBe("0")
    })

    test("formats decimals with trailing zeros", () => {
      expect(formatAmount(10.5)).toBe("10.50")
    })

    test("handles null", () => {
      expect(formatAmount(null)).toBe("0.00")
    })

    test("handles undefined", () => {
      expect(formatAmount(undefined)).toBe("0.00")
    })

    test("handles NaN", () => {
      expect(formatAmount(NaN)).toBe("0.00")
    })

    test("formats large amounts", () => {
      expect(formatAmount(1000000)).toBe("1000000")
    })

    test("formats very small decimals", () => {
      expect(formatAmount(0.01)).toBe("0.01")
    })
  })

  describe("formatMoney", () => {
    // Basic tests
    test("formats with currency", () => {
      const result = formatMoney(100, "USD")
      expect(result).toContain("100")
      expect(result).toContain("$")
    })

    test("formats decimal numbers", () => {
      const result = formatMoney(99.99, "EUR")
      expect(result).toContain("99.99")
    })

    test("handles zero", () => {
      const result = formatMoney(0, "USD")
      expect(result).toContain("0")
    })

    test("handles negative numbers", () => {
      const result = formatMoney(-50, "USD")
      expect(result).toContain("-")
      expect(result).toContain("50")
    })

    test("formats large numbers with separators", () => {
      const result = formatMoney(1000000, "USD")
      expect(result).toBeTruthy()
    })

    test("formats without currency", () => {
      const result = formatMoney(100)
      expect(result).toBe("100")
    })

    test("handles different currencies", () => {
      expect(formatMoney(100, "GEL")).toContain("₾")
      expect(formatMoney(100, "RUB")).toContain("₽")
      expect(formatMoney(100, "PLN")).toContain("zł")
    })

    test("formats PLN with symbol after", () => {
      const result = formatMoney(100, "PLN")
      expect(result).toContain("100")
      expect(result).toContain("zł")
      expect(result.indexOf("100")).toBeLessThan(result.indexOf("zł"))
    })

    // Extended tests - unique
    test("formats USD with exact format", () => {
      expect(formatMoney(100, "USD")).toBe("$100.00")
    })

    test("formats negative USD with exact format", () => {
      expect(formatMoney(-50, "USD")).toBe("-$50.00")
    })

    test("formats EUR with exact format", () => {
      expect(formatMoney(100, "EUR")).toBe("€100.00")
    })

    test("formats GEL with exact format", () => {
      expect(formatMoney(100, "GEL")).toBe("₾100.00")
    })

    test("formats RUB with exact format", () => {
      expect(formatMoney(100, "RUB")).toBe("₽100.00")
    })

    test("formats UAH with exact format", () => {
      expect(formatMoney(100, "UAH")).toBe("₴100.00")
    })

    test("formats PLN with exact format", () => {
      expect(formatMoney(100, "PLN")).toBe("100.00 zł")
    })

    test("formats with thousands separator", () => {
      expect(formatMoney(1000, "USD")).toBe("$1,000.00")
    })

    test("formats millions", () => {
      expect(formatMoney(1000000, "USD")).toBe("$1,000,000.00")
    })

    test("formats exact decimals", () => {
      expect(formatMoney(99.99, "USD")).toBe("$99.99")
    })
  })

  describe("formatDate", () => {
    test("formats date to YYYY-MM-DD", () => {
      const date = new Date(2024, 5, 15) // June 15, 2024
      expect(formatDate(date)).toBe("2024-06-15")
    })

    test("pads single digit month", () => {
      const date = new Date(2024, 0, 1) // January 1, 2024
      expect(formatDate(date)).toBe("2024-01-01")
    })

    test("pads single digit day", () => {
      const date = new Date(2024, 11, 5) // December 5, 2024
      expect(formatDate(date)).toBe("2024-12-05")
    })
  })

  describe("formatDateDisplay", () => {
    // Basic tests
    test("formats date object", () => {
      const date = new Date("2026-02-09")
      const result = formatDateDisplay(date)
      expect(result).toBeTruthy()
      expect(typeof result).toBe("string")
    })

    test("formats ISO string", () => {
      const result = formatDateDisplay("2026-02-09T00:00:00Z")
      expect(result).toBeTruthy()
    })

    test("handles invalid date", () => {
      const result = formatDateDisplay("invalid")
      expect(result).toBe("")
    })

    test("formats with correct DD.MM.YYYY pattern", () => {
      const result = formatDateDisplay(new Date("2026-01-05"))
      expect(result).toMatch(/^\d{2}\.\d{2}\.\d{4}$/)
    })

    test("handles beginning of year", () => {
      const result = formatDateDisplay(new Date("2026-01-01"))
      expect(result).toBe("01.01.2026")
    })

    test("handles end of year", () => {
      const result = formatDateDisplay(new Date("2026-12-31"))
      expect(result).toBe("31.12.2026")
    })

    // Extended tests - unique
    test("formats date object with exact format", () => {
      const date = new Date(2024, 5, 15) // June 15, 2024
      expect(formatDateDisplay(date)).toBe("15.06.2024")
    })

    test("formats date string to DD.MM.YYYY", () => {
      expect(formatDateDisplay("2024-06-15")).toBe("15.06.2024")
    })

    test("pads single digits correctly", () => {
      const date = new Date(2024, 0, 1) // January 1, 2024
      expect(formatDateDisplay(date)).toBe("01.01.2024")
    })
  })

  describe("formatDateShort", () => {
    test("formats to DD.MM", () => {
      const date = new Date(2024, 5, 15)
      expect(formatDateShort(date)).toBe("15.06")
    })

    test("pads single digits", () => {
      const date = new Date(2024, 0, 5)
      expect(formatDateShort(date)).toBe("05.01")
    })
  })

  describe("calculatePercentage", () => {
    // Basic tests
    test("calculates percentage", () => {
      expect(calculatePercentage(50, 100)).toBe(50)
      expect(calculatePercentage(25, 100)).toBe(25)
    })

    test("handles zero total", () => {
      expect(calculatePercentage(0, 0)).toBe(0)
      expect(calculatePercentage(50, 0)).toBe(0)
    })

    test("handles decimal results", () => {
      const result = calculatePercentage(33, 100)
      expect(result).toBeCloseTo(33, 1)
    })

    test("handles over 100%", () => {
      expect(calculatePercentage(150, 100)).toBe(150)
    })

    test("handles very small percentages", () => {
      const result = calculatePercentage(1, 1000)
      expect(result).toBeCloseTo(0.1, 2)
    })

    test("rounds to 2 decimal places", () => {
      const result = calculatePercentage(1, 3)
      expect(result).toBeCloseTo(33.33, 2)
    })

    // Extended tests - unique
    test("handles 100% exactly", () => {
      expect(calculatePercentage(100, 100)).toBe(100)
    })

    test("rounds to exactly 2 decimals", () => {
      expect(calculatePercentage(1, 3)).toBe(33.33)
    })
  })

  describe("truncateString", () => {
    test("truncates long strings", () => {
      const result = truncateString("This is a very long string", 10)
      expect(result.length).toBeLessThanOrEqual(13) // 10 + "..."
      expect(result).toContain("...")
    })

    test("does not truncate short strings", () => {
      const result = truncateString("Short", 10)
      expect(result).toBe("Short")
    })

    test("handles exact length", () => {
      const result = truncateString("Exactly10!", 10)
      expect(result.length).toBeLessThanOrEqual(13)
    })

    test("handles empty string", () => {
      const result = truncateString("", 10)
      expect(result).toBe("")
    })
  })

  describe("truncate", () => {
    test("truncates long strings", () => {
      expect(truncate("This is a very long string", 10)).toBe("This is...")
    })

    test("preserves short strings", () => {
      expect(truncate("Short", 10)).toBe("Short")
    })

    test("handles exact length", () => {
      expect(truncate("Exact", 5)).toBe("Exact")
    })

    test("handles empty string", () => {
      expect(truncate("", 10)).toBe("")
    })
  })

  describe("isPositiveNumber", () => {
    test("validates positive numbers", () => {
      expect(isPositiveNumber(1)).toBe(true)
      expect(isPositiveNumber(100)).toBe(true)
      expect(isPositiveNumber(0.01)).toBe(true)
    })

    test("rejects zero and negative", () => {
      expect(isPositiveNumber(0)).toBe(false)
      expect(isPositiveNumber(-1)).toBe(false)
      expect(isPositiveNumber(-0.01)).toBe(false)
    })

    test("rejects NaN and Infinity", () => {
      expect(isPositiveNumber(NaN)).toBe(false)
      expect(isPositiveNumber(Infinity)).toBe(false)
      expect(isPositiveNumber(-Infinity)).toBe(false)
    })

    test("handles very small positive numbers", () => {
      expect(isPositiveNumber(0.0001)).toBe(true)
      expect(isPositiveNumber(Number.MIN_VALUE)).toBe(true)
    })

    test("handles very large positive numbers", () => {
      expect(isPositiveNumber(999999999)).toBe(true)
      expect(isPositiveNumber(Number.MAX_SAFE_INTEGER)).toBe(true)
    })
  })

  describe("roundToTwo", () => {
    test("rounds to 2 decimals", () => {
      expect(roundToTwo(99.999)).toBe(100)
      expect(roundToTwo(99.994)).toBe(99.99)
      expect(roundToTwo(99.995)).toBe(100)
    })

    test("handles integers", () => {
      expect(roundToTwo(100)).toBe(100)
    })

    test("handles zero", () => {
      expect(roundToTwo(0)).toBe(0)
    })

    test("handles negative numbers", () => {
      expect(roundToTwo(-99.999)).toBe(-100)
      expect(roundToTwo(-99.994)).toBe(-99.99)
    })

    test("handles very small numbers", () => {
      expect(roundToTwo(0.001)).toBe(0)
      expect(roundToTwo(0.005)).toBe(0.01)
      expect(roundToTwo(0.004)).toBe(0)
    })

    test("preserves exact 2 decimal numbers", () => {
      expect(roundToTwo(12.34)).toBe(12.34)
      expect(roundToTwo(0.99)).toBe(0.99)
    })
  })

  describe("roundToDecimal", () => {
    test("rounds to 2 decimals", () => {
      expect(roundToDecimal(10.999, 2)).toBe(11)
    })

    test("rounds to 1 decimal", () => {
      expect(roundToDecimal(10.95, 1)).toBe(11)
    })

    test("rounds to 0 decimals", () => {
      expect(roundToDecimal(10.5, 0)).toBe(11)
    })

    test("handles exact values", () => {
      expect(roundToDecimal(10.5, 2)).toBe(10.5)
    })
  })

  describe("formatCompactNumber", () => {
    test("formats millions", () => {
      expect(formatCompactNumber(1000000)).toBe("1M")
    })

    test("formats thousands", () => {
      expect(formatCompactNumber(1000)).toBe("1K")
    })

    test("formats small numbers", () => {
      expect(formatCompactNumber(999)).toBe("999")
    })

    test("formats 1.5M", () => {
      expect(formatCompactNumber(1500000)).toBe("1.5M")
    })

    test("formats 2.5K", () => {
      expect(formatCompactNumber(2500)).toBe("2.5K")
    })
  })

  describe("createListButtons", () => {
    test("handles empty items array", () => {
      const result = createListButtons({ items: [], lang: "en" })
      expect(result).toHaveLength(1) // Only back button row
    })

    test("handles single item", () => {
      const result = createListButtons({ items: ["Item"], lang: "en" })
      expect(result.length).toBeGreaterThan(1)
    })

    test("handles exactly 3 items", () => {
      const result = createListButtons({
        items: ["A", "B", "C"],
        lang: "en",
      })
      expect(result.length).toBeGreaterThan(0)
    })

    test("handles exactly 4 items", () => {
      const result = createListButtons({
        items: ["A", "B", "C", "D"],
        lang: "en",
      })
      expect(result.length).toBeGreaterThan(0)
    })

    test("handles large item count", () => {
      const items = Array.from({ length: 20 }, (_, i) => `Item ${i + 1}`)
      const result = createListButtons({ items, lang: "en" })
      expect(result.length).toBeGreaterThan(0)
    })

    test("handles spanish language", () => {
      const result = createListButtons({ items: ["A"], lang: "es" })
      expect(result.length).toBeGreaterThan(0)
    })

    test("handles russian language", () => {
      const result = createListButtons({ items: ["A"], lang: "ru" })
      expect(result.length).toBeGreaterThan(0)
    })

    test("handles ukrainian language", () => {
      const result = createListButtons({ items: ["A"], lang: "uk" })
      expect(result.length).toBeGreaterThan(0)
    })

    test("handles polish language", () => {
      const result = createListButtons({ items: ["A"], lang: "pl" })
      expect(result.length).toBeGreaterThan(0)
    })
  })
})
