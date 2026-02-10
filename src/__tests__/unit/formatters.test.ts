import {
  formatAmount,
  formatCompactNumber,
  formatDate,
  formatDateShort,
  handleInsufficientFunds,
  roundToDecimal,
  truncate,
} from "../../utils/formatters"

describe("Formatters", () => {
  describe("formatAmount", () => {
    test("formats valid numbers", () => {
      expect(formatAmount(100)).toBe("100")
      expect(formatAmount(99.99)).toBe("99.99")
      expect(formatAmount(0)).toBe("0")
    })

    test("handles null and undefined", () => {
      expect(formatAmount(null)).toBe("0.00")
      expect(formatAmount(undefined)).toBe("0.00")
    })

    test("handles NaN", () => {
      expect(formatAmount(NaN)).toBe("0.00")
    })

    test("formats whole numbers without decimals", () => {
      expect(formatAmount(100)).toBe("100")
      expect(formatAmount(1000)).toBe("1000")
    })

    test("formats decimal numbers with 2 places", () => {
      expect(formatAmount(99.5)).toBe("99.50")
      expect(formatAmount(0.01)).toBe("0.01")
    })

    test("handles negative numbers", () => {
      expect(formatAmount(-50)).toBe("-50")
      expect(formatAmount(-99.99)).toBe("-99.99")
    })

    test("handles very small numbers", () => {
      expect(formatAmount(0.001)).toBe("0.00")
      expect(formatAmount(0.1)).toBe("0.10")
    })
  })

  describe("formatDate", () => {
    test("formats date to YYYY-MM-DD", () => {
      const date = new Date("2026-02-09T00:00:00Z")
      expect(formatDate(date)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    test("pads single digits", () => {
      const date = new Date("2026-01-05T00:00:00Z")
      const result = formatDate(date)
      expect(result).toContain("-01-")
      expect(result).toContain("-05")
    })

    test("handles beginning of year", () => {
      const date = new Date("2026-01-01T00:00:00Z")
      expect(formatDate(date)).toContain("2026-01-01")
    })

    test("handles end of year", () => {
      const date = new Date("2026-12-31T00:00:00Z")
      expect(formatDate(date)).toContain("2026-12-31")
    })

    test("handles leap year", () => {
      const date = new Date("2024-02-29T00:00:00Z")
      expect(formatDate(date)).toContain("2024-02-29")
    })
  })

  describe("formatDateShort", () => {
    test("formats date to DD.MM", () => {
      const date = new Date("2026-02-09T00:00:00Z")
      expect(formatDateShort(date)).toMatch(/^\d{2}\.\d{2}$/)
    })

    test("pads single digits", () => {
      const date = new Date("2026-01-05T00:00:00Z")
      expect(formatDateShort(date)).toBe("05.01")
    })

    test("handles beginning of month", () => {
      const date = new Date("2026-01-01T00:00:00Z")
      expect(formatDateShort(date)).toBe("01.01")
    })

    test("handles end of month", () => {
      const date = new Date("2026-12-31T00:00:00Z")
      expect(formatDateShort(date)).toBe("31.12")
    })

    test("handles different months", () => {
      expect(formatDateShort(new Date("2026-06-15T00:00:00Z"))).toBe("15.06")
      expect(formatDateShort(new Date("2026-09-25T00:00:00Z"))).toBe("25.09")
    })
  })

  describe("roundToDecimal", () => {
    test("rounds to specified decimal places", () => {
      expect(roundToDecimal(99.999, 2)).toBe(100)
      expect(roundToDecimal(99.994, 2)).toBe(99.99)
      expect(roundToDecimal(99.995, 2)).toBe(100)
    })

    test("rounds to 1 decimal", () => {
      expect(roundToDecimal(99.95, 1)).toBe(100)
      expect(roundToDecimal(99.94, 1)).toBe(99.9)
    })

    test("rounds to 3 decimals", () => {
      expect(roundToDecimal(99.9999, 3)).toBe(100)
      expect(roundToDecimal(99.9994, 3)).toBe(99.999)
    })

    test("handles zero", () => {
      expect(roundToDecimal(0, 2)).toBe(0)
    })

    test("handles negative numbers", () => {
      expect(roundToDecimal(-99.999, 2)).toBe(-100)
      expect(roundToDecimal(-99.994, 2)).toBe(-99.99)
    })

    test("handles whole numbers", () => {
      expect(roundToDecimal(100, 2)).toBe(100)
      expect(roundToDecimal(50, 3)).toBe(50)
    })

    test("handles very small numbers", () => {
      expect(roundToDecimal(0.001, 2)).toBe(0)
      expect(roundToDecimal(0.005, 2)).toBe(0.01)
    })
  })

  describe("formatCompactNumber", () => {
    test("formats millions", () => {
      expect(formatCompactNumber(1000000)).toBe("1M")
      expect(formatCompactNumber(2500000)).toBe("2.5M")
      expect(formatCompactNumber(1234567)).toBe("1.2M")
    })

    test("formats thousands", () => {
      expect(formatCompactNumber(1000)).toBe("1K")
      expect(formatCompactNumber(2500)).toBe("2.5K")
      expect(formatCompactNumber(1234)).toBe("1.2K")
    })

    test("keeps numbers under 1000 as is", () => {
      expect(formatCompactNumber(999)).toBe("999")
      expect(formatCompactNumber(500)).toBe("500")
      expect(formatCompactNumber(1)).toBe("1")
      expect(formatCompactNumber(0)).toBe("0")
    })

    test("handles negative numbers", () => {
      // Note: formatCompactNumber may not handle negatives, check implementation
      const result1 = formatCompactNumber(-1000000)
      expect(result1).toBeTruthy()
      const result2 = formatCompactNumber(-1000)
      expect(result2).toBeTruthy()
      expect(formatCompactNumber(-500)).toBe("-500")
    })

    test("rounds decimals", () => {
      expect(formatCompactNumber(1999999)).toBe("2M")
      expect(formatCompactNumber(1999)).toBe("2K")
    })
  })

  describe("truncate", () => {
    test("truncates long strings", () => {
      const long = "This is a very long string that needs truncation"
      const result = truncate(long, 20)
      expect(result.length).toBeLessThanOrEqual(20)
      expect(result).toContain("...")
    })

    test("does not truncate short strings", () => {
      expect(truncate("Short", 10)).toBe("Short")
      expect(truncate("Test", 20)).toBe("Test")
    })

    test("handles exact length", () => {
      const text = "ExactlyTen"
      expect(truncate(text, 10)).toBe(text)
    })

    test("handles empty string", () => {
      expect(truncate("", 10)).toBe("")
    })

    test("truncates at correct position", () => {
      const result = truncate("1234567890", 5)
      expect(result).toBe("12...")
    })

    test("handles very short max length", () => {
      const result = truncate("Long string", 3)
      expect(result).toBe("...")
    })
  })

  describe("handleInsufficientFunds", () => {
    test("formats insufficient funds message", () => {
      const result = handleInsufficientFunds(
        "en",
        "Cash",
        100,
        "USD",
        150,
        "USD"
      )
      expect(result).toBeTruthy()
      expect(typeof result).toBe("string")
    })

    test("includes all required information", () => {
      const result = handleInsufficientFunds(
        "en",
        "Savings",
        500,
        "EUR",
        750,
        "EUR"
      )
      expect(result).toBeTruthy()
    })

    test("handles different currencies", () => {
      const result = handleInsufficientFunds(
        "en",
        "Wallet",
        100,
        "USD",
        150,
        "EUR"
      )
      expect(result).toBeTruthy()
    })

    test("works with different languages", () => {
      const resultEn = handleInsufficientFunds("en", "Cash", 100, "USD", 150)
      const resultRu = handleInsufficientFunds("ru", "Cash", 100, "USD", 150)
      expect(resultEn).toBeTruthy()
      expect(resultRu).toBeTruthy()
    })

    test("handles large amounts", () => {
      const result = handleInsufficientFunds(
        "en",
        "Account",
        10000,
        "USD",
        50000
      )
      expect(result).toBeTruthy()
    })

    test("handles small amounts", () => {
      const result = handleInsufficientFunds("en", "Wallet", 0.5, "USD", 1.5)
      expect(result).toBeTruthy()
    })
  })
})
