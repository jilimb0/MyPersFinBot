/**
 * Edge case tests for validators to improve branch coverage
 */

import * as validators from "../../validators"

describe("Validators - Edge Cases", () => {
  describe("parseAmountWithCurrency edge cases", () => {
    it("should handle amount with leading zeros", () => {
      const result = validators.parseAmountWithCurrency("000100.50", "USD")
      expect(result).toEqual({ amount: 100.5, currency: "USD" })
    })

    it("should handle amount with trailing zeros", () => {
      const result = validators.parseAmountWithCurrency("100.5000", "USD")
      expect(result).toEqual({ amount: 100.5, currency: "USD" })
    })

    it("should handle very small amounts", () => {
      const result = validators.parseAmountWithCurrency("0.01", "USD")
      expect(result).toEqual({ amount: 0.01, currency: "USD" })
    })

    it("should reject amount with thousands separators", () => {
      const result = validators.parseAmountWithCurrency("1,000.50", "USD")
      expect(result).toBeNull()
    })

    it("should handle amount with spaces", () => {
      const result = validators.parseAmountWithCurrency(" 100.50 ", "USD")
      expect(result).not.toBeNull()
    })

    it("should handle empty string", () => {
      const result = validators.parseAmountWithCurrency("", "USD")
      expect(result).toBeNull()
    })

    it("should handle only whitespace", () => {
      const result = validators.parseAmountWithCurrency("   ", "USD")
      expect(result).toBeNull()
    })

    it("should handle multiple decimal points", () => {
      const result = validators.parseAmountWithCurrency("100.50.25", "USD")
      expect(result).toBeNull()
    })

    it("should handle letters mixed with numbers", () => {
      const result = validators.parseAmountWithCurrency("100abc50", "USD")
      expect(result).toBeNull()
    })

    it("should handle special characters", () => {
      const result = validators.parseAmountWithCurrency("100@50#", "USD")
      expect(result).toBeNull()
    })

    it("should handle negative zero", () => {
      const result = validators.parseAmountWithCurrency("-0", "USD")
      expect(result).toBeDefined()
      expect(result?.currency).toBe("USD")
    })

    it("should handle amount with currency suffix", () => {
      const result = validators.parseAmountWithCurrency("100 USD", "EUR")
      expect(result).toBeDefined()
      if (result) {
        expect(result.amount).toBe(100)
        expect(result.currency).toBe("USD")
      }
    })

    it("should handle lowercase currency codes", () => {
      const result = validators.parseAmountWithCurrency("100 usd", "EUR")
      expect(result).not.toBeNull()
    })

    it("should handle mixed case currency codes", () => {
      const result = validators.parseAmountWithCurrency("100 UsD", "EUR")
      expect(result).not.toBeNull()
    })
  })

  describe("isValidAmount edge cases", () => {
    it("should reject zero string", () => {
      const result = validators.isValidAmount("0")
      expect(result).toBe(false)
    })

    it("should reject negative numbers", () => {
      const result = validators.isValidAmount("-100")
      expect(result).toBe(false)
    })

    it("should accept very small positive numbers", () => {
      const result = validators.isValidAmount("0.01")
      expect(result).toBe(true)
    })

    it("should accept very large numbers", () => {
      const result = validators.isValidAmount("999999999")
      expect(result).toBe(true)
    })

    it("should handle invalid input", () => {
      const result = validators.isValidAmount("abc")
      expect(result).toBe(false)
    })

    it("should handle empty string", () => {
      const result = validators.isValidAmount("")
      expect(result).toBe(false)
    })

    it("should accept decimal amounts", () => {
      const result = validators.isValidAmount("100.50")
      expect(result).toBe(true)
    })
  })

  describe("isValidCurrency edge cases", () => {
    it("should reject empty string", () => {
      const result = validators.isValidCurrency("" as any)
      expect(result).toBe(false)
    })

    it("should accept valid currency codes", () => {
      expect(validators.isValidCurrency("USD" as any)).toBe(true)
      expect(validators.isValidCurrency("EUR" as any)).toBe(true)
      expect(validators.isValidCurrency("RUB" as any)).toBe(true)
    })

    it("should reject invalid currency codes", () => {
      const result = validators.isValidCurrency("XXX" as any)
      expect(result).toBe(false)
    })

    it("should reject numbers as currency", () => {
      const result = validators.isValidCurrency("123" as any)
      expect(result).toBe(false)
    })
  })
})
