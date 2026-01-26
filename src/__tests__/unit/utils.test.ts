import {
  formatMoney,
  formatDate,
  calculatePercentage,
  roundToDecimal,
} from "../../utils/formatters"

describe("Utils - Formatters", () => {
  describe("formatMoney", () => {
    test("should format money correctly with different currencies", () => {
      expect(formatMoney(1000, "USD")).toBe("$1,000.00")
      expect(formatMoney(1500.5, "EUR")).toBe("€1,500.50")
      expect(formatMoney(2000, "GEL")).toBe("₾2,000.00")
    })

    test("should handle zero and negative amounts", () => {
      expect(formatMoney(0, "USD")).toBe("$0.00")
      expect(formatMoney(-500, "USD")).toBe("-$500.00")
    })

    test("should round to 2 decimal places", () => {
      expect(formatMoney(10.999, "USD")).toBe("$11.00")
      expect(formatMoney(10.001, "USD")).toBe("$10.00")
    })
  })

  describe("formatDate", () => {
    test("should format date in YYYY-MM-DD format", () => {
      const date = new Date("2026-01-25")
      expect(formatDate(date)).toBe("2026-01-25")
    })

    test("should handle different date inputs", () => {
      const timestamp = new Date("2026-12-31").getTime()
      expect(formatDate(new Date(timestamp))).toBe("2026-12-31")
    })
  })

  describe("calculatePercentage", () => {
    test("should calculate percentage correctly", () => {
      expect(calculatePercentage(50, 200)).toBe(25)
      expect(calculatePercentage(100, 100)).toBe(100)
      expect(calculatePercentage(0, 100)).toBe(0)
    })

    test("should handle division by zero", () => {
      expect(calculatePercentage(50, 0)).toBe(0)
    })

    test("should round to 2 decimal places", () => {
      expect(calculatePercentage(1, 3)).toBe(33.33)
    })
  })

  describe("roundToDecimal", () => {
    test("should round to specified decimal places", () => {
      expect(roundToDecimal(10.12345, 2)).toBe(10.12)
      expect(roundToDecimal(10.12345, 3)).toBe(10.123)
      expect(roundToDecimal(10.12345, 0)).toBe(10)
    })

    test("should handle edge cases", () => {
      expect(roundToDecimal(0, 2)).toBe(0)
      expect(roundToDecimal(-5.5545, 2)).toBe(-5.55)
    })
  })
})
