import {
  calculatePercentage,
  createListButtons,
  formatAmount,
  formatCompactNumber,
  formatDate,
  formatDateDisplay,
  formatDateShort,
  formatMoney,
  roundToDecimal,
  truncate,
} from "../../utils"

describe("Utils Extended Tests", () => {
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
    test("formats USD with symbol", () => {
      expect(formatMoney(100, "USD")).toBe("$100.00")
    })

    test("formats negative USD", () => {
      expect(formatMoney(-50, "USD")).toBe("-$50.00")
    })

    test("formats EUR with symbol", () => {
      expect(formatMoney(100, "EUR")).toBe("€100.00")
    })

    test("formats GEL with symbol", () => {
      expect(formatMoney(100, "GEL")).toBe("₾100.00")
    })

    test("formats RUB with symbol", () => {
      expect(formatMoney(100, "RUB")).toBe("₽100.00")
    })

    test("formats UAH with symbol", () => {
      expect(formatMoney(100, "UAH")).toBe("₴100.00")
    })

    test("formats PLN with symbol after", () => {
      expect(formatMoney(100, "PLN")).toBe("100.00 zł")
    })

    test("formats with thousands separator", () => {
      expect(formatMoney(1000, "USD")).toBe("$1,000.00")
    })

    test("formats millions", () => {
      expect(formatMoney(1000000, "USD")).toBe("$1,000,000.00")
    })

    test("formats decimals", () => {
      expect(formatMoney(99.99, "USD")).toBe("$99.99")
    })

    test("formats without currency", () => {
      expect(formatMoney(100)).toBe("100")
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
    test("formats date object to DD.MM.YYYY", () => {
      const date = new Date(2024, 5, 15) // June 15, 2024
      expect(formatDateDisplay(date)).toBe("15.06.2024")
    })

    test("formats date string", () => {
      expect(formatDateDisplay("2024-06-15")).toBe("15.06.2024")
    })

    test("pads single digits", () => {
      const date = new Date(2024, 0, 1) // January 1, 2024
      expect(formatDateDisplay(date)).toBe("01.01.2024")
    })

    test("handles invalid date", () => {
      expect(formatDateDisplay("invalid")).toBe("")
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
    test("calculates percentage", () => {
      expect(calculatePercentage(50, 100)).toBe(50)
    })

    test("handles zero total", () => {
      expect(calculatePercentage(50, 0)).toBe(0)
    })

    test("rounds to 2 decimals", () => {
      expect(calculatePercentage(1, 3)).toBe(33.33)
    })

    test("handles 100%", () => {
      expect(calculatePercentage(100, 100)).toBe(100)
    })

    test("handles over 100%", () => {
      expect(calculatePercentage(150, 100)).toBe(150)
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

  describe("createListButtons edge cases", () => {
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
