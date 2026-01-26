import {
  sanitizeText,
  sanitizeDescription,
  sanitizeName,
  sanitizeUserId,
  sanitizeEmail,
  sanitizeCurrency,
  sanitizeAmount,
  sanitizeDate,
  sanitizeTransactionInput,
  detectMaliciousInput,
} from "../../utils/sanitizer"

describe("Sanitizer", () => {
  describe("sanitizeText", () => {
    test("should remove HTML tags", () => {
      // Dangerous tags like <script> are completely removed with content (security!)
      expect(sanitizeText("<script>alert('xss')</script>")).toBe("")
      // Regular tags are removed, content is kept
      expect(sanitizeText("Hello <b>World</b>")).toBe("Hello World")
      // Self-closing tags are removed
      expect(sanitizeText("Test<br/>text")).toBe("Testtext")
    })

    test("should escape special characters", () => {
      // Special chars are double-escaped: first by sanitize-html, then by validator
      expect(sanitizeText("Test & text")).toContain("&amp;")
      expect(sanitizeText('Test "quotes"')).toBe("Test &quot;quotes&quot;")
    })

    test("should trim whitespace", () => {
      expect(sanitizeText("  test  ")).toBe("test")
      expect(sanitizeText("\n\ntest\n\n")).toBe("test")
    })

    test("should handle empty input", () => {
      expect(sanitizeText("")).toBe("")
      expect(sanitizeText("   ")).toBe("")
    })

    test("should truncate long input", () => {
      const longText = "a".repeat(1500)
      const result = sanitizeText(longText)
      expect(result.length).toBe(1000)
    })
  })

  describe("sanitizeDescription", () => {
    test("should allow basic text", () => {
      expect(sanitizeDescription("Monthly rent payment")).toBe(
        "Monthly rent payment"
      )
    })

    test("should remove HTML tags", () => {
      expect(sanitizeDescription("<b>Bold</b> text")).toBe("Bold text")
    })

    test("should limit length to 500", () => {
      const longDesc = "a".repeat(600)
      expect(sanitizeDescription(longDesc).length).toBe(500)
    })
  })

  describe("sanitizeName", () => {
    test("should accept valid names", () => {
      expect(sanitizeName("Cash")).toBe("Cash")
      expect(sanitizeName("Bank Account 1")).toBe("Bank Account 1")
    })

    test("should remove dangerous HTML tags", () => {
      // <script> is dangerous and removed completely
      expect(sanitizeName("Test<script>")).toBe("Test")
      // Regular tags are also removed
      expect(sanitizeName("Test<b>Bold</b>")).toBe("TestBold")
    })

    test("should throw on empty name", () => {
      expect(() => sanitizeName("")).toThrow(
        "Name must contain alphanumeric characters"
      )
      expect(() => sanitizeName("   ")).toThrow()
    })

    test("should throw on name without alphanumeric", () => {
      expect(() => sanitizeName("@#$%")).toThrow()
    })

    test("should limit length to 100", () => {
      const longName = "a".repeat(150)
      expect(sanitizeName(longName).length).toBe(100)
    })
  })

  describe("sanitizeUserId", () => {
    test("should accept valid user IDs", () => {
      expect(sanitizeUserId(123456)).toBe("123456")
      expect(sanitizeUserId("789012")).toBe("789012")
    })

    test("should reject negative IDs", () => {
      expect(() => sanitizeUserId(-1)).toThrow(
        "User ID must be a positive integer"
      )
    })

    test("should reject zero", () => {
      expect(() => sanitizeUserId(0)).toThrow(
        "User ID must be a positive integer"
      )
    })

    test("should reject non-numeric", () => {
      expect(() => sanitizeUserId("abc")).toThrow("Invalid user ID format")
      expect(() => sanitizeUserId("123abc")).toThrow()
    })
  })

  describe("sanitizeEmail", () => {
    test("should accept valid emails", () => {
      expect(sanitizeEmail("test@example.com")).toBe("test@example.com")
      expect(sanitizeEmail("  USER@EXAMPLE.COM  ")).toBe("user@example.com")
    })

    test("should reject invalid emails", () => {
      expect(() => sanitizeEmail("notanemail")).toThrow("Invalid email format")
      expect(() => sanitizeEmail("@example.com")).toThrow()
      expect(() => sanitizeEmail("test@")).toThrow()
    })
  })

  describe("sanitizeCurrency", () => {
    test("should accept valid currency codes", () => {
      expect(sanitizeCurrency("USD")).toBe("USD")
      expect(sanitizeCurrency("eur")).toBe("EUR")
      expect(sanitizeCurrency(" GBP ")).toBe("GBP")
    })

    test("should reject invalid formats", () => {
      expect(() => sanitizeCurrency("US")).toThrow(
        "Invalid currency code format"
      )
      expect(() => sanitizeCurrency("USDD")).toThrow()
      expect(() => sanitizeCurrency("123")).toThrow()
      expect(() => sanitizeCurrency("$")).toThrow()
    })
  })

  describe("sanitizeAmount", () => {
    test("should accept valid amounts", () => {
      expect(sanitizeAmount(100)).toBe(100)
      expect(sanitizeAmount("50.5")).toBe(50.5)
      expect(sanitizeAmount(0)).toBe(0)
      expect(sanitizeAmount(-10.5)).toBe(-10.5)
    })

    test("should round to 2 decimal places", () => {
      expect(sanitizeAmount(10.556)).toBe(10.56)
      expect(sanitizeAmount(10.554)).toBe(10.55)
    })

    test("should reject invalid amounts", () => {
      expect(() => sanitizeAmount(NaN)).toThrow("Invalid amount")
      expect(() => sanitizeAmount(Infinity)).toThrow("Invalid amount")
      expect(() => sanitizeAmount("abc")).toThrow()
    })

    test("should reject amounts that are too large", () => {
      expect(() => sanitizeAmount(1000000000)).toThrow("Amount too large")
      expect(() => sanitizeAmount(-1000000000)).toThrow("Amount too large")
    })
  })

  describe("sanitizeDate", () => {
    test("should accept valid dates", () => {
      const date = new Date("2024-01-15")
      expect(sanitizeDate(date)).toEqual(date)
      expect(sanitizeDate("2024-01-15T10:00:00Z")).toBeInstanceOf(Date)
    })

    test("should reject invalid date formats", () => {
      expect(() => sanitizeDate("2024/01/15")).toThrow(
        "Invalid date format. Use ISO 8601"
      )
      expect(() => sanitizeDate("15-01-2024")).toThrow()
    })

    test("should reject dates out of range", () => {
      expect(() => sanitizeDate("1999-01-01")).toThrow("Date out of range")
      expect(() => sanitizeDate("2050-01-01")).toThrow("Date out of range")
    })

    test("should reject invalid dates", () => {
      // Invalid dates may be caught at format validation or after parsing
      expect(() => sanitizeDate("2024-13-45T10:00:00Z")).toThrow()
      expect(() => sanitizeDate("2024-02-30T10:00:00Z")).toThrow()
    })
  })

  describe("sanitizeTransactionInput", () => {
    test("should sanitize complete transaction", () => {
      const input = {
        userId: 123456,
        amount: "100.50",
        currency: "usd",
        description: "  Test payment  ",
        category: "Food",
        fromAccountId: "Cash",
        date: "2024-01-15T10:00:00Z",
      }

      const result = sanitizeTransactionInput(input)

      expect(result.userId).toBe("123456")
      expect(result.amount).toBe(100.5)
      expect(result.currency).toBe("USD")
      expect(result.description).toBe("Test payment")
      expect(result.category).toBe("Food")
      expect(result.fromAccountId).toBe("Cash")
      expect(result.date).toBeInstanceOf(Date)
    })

    test("should handle minimal transaction", () => {
      const result = sanitizeTransactionInput({
        userId: "789",
        amount: 50,
        currency: "EUR",
      })

      expect(result.userId).toBe("789")
      expect(result.amount).toBe(50)
      expect(result.currency).toBe("EUR")
      expect(result.description).toBeUndefined()
    })

    test("should throw on invalid data", () => {
      expect(() =>
        sanitizeTransactionInput({
          userId: "invalid",
          amount: 100,
          currency: "USD",
        })
      ).toThrow()

      expect(() =>
        sanitizeTransactionInput({
          userId: 123,
          amount: "abc",
          currency: "USD",
        })
      ).toThrow()
    })
  })

  describe("detectMaliciousInput", () => {
    test("should detect XSS attempts", () => {
      expect(detectMaliciousInput("<script>alert('xss')</script>")).toBe(true)
      expect(detectMaliciousInput("javascript:void(0)")).toBe(true)
      expect(detectMaliciousInput("onclick=alert(1)")).toBe(true)
      expect(detectMaliciousInput("eval(malicious)")).toBe(true)
    })

    test("should detect SQL injection attempts", () => {
      expect(detectMaliciousInput("1' OR '1'='1")).toBe(true)
      expect(detectMaliciousInput("UNION SELECT * FROM users")).toBe(true)
      expect(detectMaliciousInput("DROP TABLE transactions")).toBe(true)
      expect(detectMaliciousInput("INSERT INTO balances")).toBe(true)
    })

    test("should allow safe input", () => {
      expect(detectMaliciousInput("Normal transaction description")).toBe(false)
      expect(detectMaliciousInput("Coffee at Starbucks")).toBe(false)
      expect(detectMaliciousInput("Monthly rent 1000 USD")).toBe(false)
    })
  })
})
