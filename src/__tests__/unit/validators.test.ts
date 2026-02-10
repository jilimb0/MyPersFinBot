import * as validators from "../../validators"

/**
 * Comprehensive test suite for all validator functions.
 * Merged from validators.test.ts, validators-extended.test.ts, and validators-extra.test.ts
 * All duplicate tests have been removed.
 */
describe("validators", () => {
  describe("parseAmountWithCurrency", () => {
    // Basic functionality
    test("parses simple number", () => {
      const result = validators.parseAmountWithCurrency("100", "USD")
      expect(result).toEqual({ amount: 100, currency: "USD" })
    })

    test("parses number with currency", () => {
      const result = validators.parseAmountWithCurrency("100 EUR", "USD")
      expect(result).toEqual({ amount: 100, currency: "EUR" })
    })

    test("parses decimal number", () => {
      const result = validators.parseAmountWithCurrency("99.99", "USD")
      expect(result).toEqual({ amount: 99.99, currency: "USD" })
    })

    test("handles spaces", () => {
      const result = validators.parseAmountWithCurrency("  100  USD  ", "EUR")
      expect(result).toEqual({ amount: 100, currency: "USD" })
    })

    test("returns null for invalid input", () => {
      expect(validators.parseAmountWithCurrency("abc", "USD")).toBeNull()
      expect(validators.parseAmountWithCurrency("", "USD")).toBeNull()
      expect(validators.parseAmountWithCurrency("USD 100", "USD")).toBeNull()
    })

    test("handles negative numbers", () => {
      const result = validators.parseAmountWithCurrency("-50", "USD")
      expect(result).toEqual({ amount: -50, currency: "USD" })
    })

    test("handles zero", () => {
      const result = validators.parseAmountWithCurrency("0", "USD")
      expect(result).toEqual({ amount: 0, currency: "USD" })
    })

    test("handles large numbers", () => {
      const result = validators.parseAmountWithCurrency("999999.99", "USD")
      expect(result).toEqual({ amount: 999999.99, currency: "USD" })
    })

    test("handles dollar sign", () => {
      const result = validators.parseAmountWithCurrency("100 $", "EUR")
      expect(result).toEqual({ amount: 100, currency: "USD" })
    })

    test("handles negative with currency", () => {
      const result = validators.parseAmountWithCurrency("-75.50 EUR", "USD")
      expect(result).toEqual({ amount: -75.5, currency: "EUR" })
    })

    test("handles comma as decimal separator", () => {
      const result = validators.parseAmountWithCurrency("100,50", "USD")
      expect(result).toEqual({ amount: 100.5, currency: "USD" })
    })

    test("rejects invalid currency code", () => {
      expect(validators.parseAmountWithCurrency("100 XYZ", "USD")).toBeNull()
      expect(validators.parseAmountWithCurrency("100 AB", "USD")).toBeNull()
    })

    // Extended tests - unique
    test("handles very large amounts", () => {
      expect(validators.parseAmountWithCurrency("999999999")).toEqual({
        amount: 999999999,
        currency: "USD",
      })
    })

    test("handles very small amounts", () => {
      expect(validators.parseAmountWithCurrency("0.01")).toEqual({
        amount: 0.01,
        currency: "USD",
      })
    })

    test("handles all supported currencies", () => {
      const currencies = ["USD", "EUR", "GEL", "RUB", "UAH", "PLN"]
      currencies.forEach((curr) => {
        const result = validators.parseAmountWithCurrency(`100 ${curr}`)
        expect(result?.currency).toBe(curr)
      })
    })

    test("rejects text input", () => {
      expect(validators.parseAmountWithCurrency("abc")).toBeNull()
      expect(validators.parseAmountWithCurrency("test 100")).toBeNull()
    })

    test("handles mixed case currency", () => {
      expect(validators.parseAmountWithCurrency("100 usd")).toEqual({
        amount: 100,
        currency: "USD",
      })
      expect(validators.parseAmountWithCurrency("100 UsD")).toEqual({
        amount: 100,
        currency: "USD",
      })
    })

    test("handles multiple spaces between amount and currency", () => {
      expect(validators.parseAmountWithCurrency("100   USD")).toEqual({
        amount: 100,
        currency: "USD",
      })
    })

    test("rejects currency-like but invalid codes", () => {
      expect(validators.parseAmountWithCurrency("100 US")).toBeNull()
      expect(validators.parseAmountWithCurrency("100 USDD")).toBeNull()
    })

    test("handles negative with dollar sign", () => {
      expect(validators.parseAmountWithCurrency("-50 $")).toEqual({
        amount: -50,
        currency: "USD",
      })
    })
  })

  describe("parseBalanceInput", () => {
    // Basic functionality
    test("parses valid balance input", () => {
      const result = validators.parseBalanceInput("Cash 1000 USD")
      expect(result).toEqual({
        accountId: "Cash",
        amount: 1000,
        currency: "USD",
      })
    })

    test("parses balance with decimal amount", () => {
      const result = validators.parseBalanceInput("Savings 2500.75 EUR")
      expect(result).toEqual({
        accountId: "Savings",
        amount: 2500.75,
        currency: "EUR",
      })
    })

    test("handles multi-word account names", () => {
      const result = validators.parseBalanceInput("Main Card 500 GEL")
      expect(result).toEqual({
        accountId: "Main Card",
        amount: 500,
        currency: "GEL",
      })
    })

    test("rejects invalid format", () => {
      expect(validators.parseBalanceInput("Cash 1000")).toBeNull()
      expect(validators.parseBalanceInput("1000 USD")).toBeNull()
      expect(validators.parseBalanceInput("Cash USD")).toBeNull()
    })

    test("rejects negative amount", () => {
      expect(validators.parseBalanceInput("Cash -100 USD")).toBeNull()
    })

    test("rejects invalid currency", () => {
      expect(validators.parseBalanceInput("Cash 1000 XYZ")).toBeNull()
    })

    test("handles comma as decimal separator", () => {
      const result = validators.parseBalanceInput("Wallet 99,99 RUB")
      expect(result).toEqual({
        accountId: "Wallet",
        amount: 99.99,
        currency: "RUB",
      })
    })

    // Extended tests - unique
    test("handles account names with numbers", () => {
      const result = validators.parseBalanceInput("Account 123 100 USD")
      expect(result?.accountId).toBe("Account 123")
    })

    test("handles long account names", () => {
      const result = validators.parseBalanceInput(
        "My Primary Savings Account 1000 USD"
      )
      expect(result?.accountId).toBe("My Primary Savings Account")
    })

    test("rejects missing currency", () => {
      expect(validators.parseBalanceInput("Cash 100")).toBeNull()
    })

    test("handles all currencies", () => {
      ;["USD", "EUR", "GEL", "RUB", "UAH", "PLN"].forEach((curr) => {
        const result = validators.parseBalanceInput(`Wallet 100 ${curr}`)
        expect(result?.currency).toBe(curr)
      })
    })

    test("handles very long account name", () => {
      const result = validators.parseBalanceInput(
        "My Very Long Account Name 100 USD"
      )
      expect(result?.accountId).toBe("My Very Long Account Name")
    })

    test("handles account name with numbers only", () => {
      const result = validators.parseBalanceInput("Account123 100 USD")
      expect(result?.accountId).toBe("Account123")
    })
  })

  describe("isValidDate", () => {
    // Basic functionality
    test("validates correct date format", () => {
      expect(validators.isValidDate("01.01.2026")).toBe(true)
      expect(validators.isValidDate("31.12.2025")).toBe(true)
    })

    test("rejects invalid date format", () => {
      expect(validators.isValidDate("2026-01-01")).toBe(false)
      expect(validators.isValidDate("1/1/2026")).toBe(false)
      expect(validators.isValidDate("abc")).toBe(false)
      expect(validators.isValidDate("")).toBe(false)
    })

    test("rejects invalid dates", () => {
      expect(validators.isValidDate("32.01.2026")).toBe(false)
      expect(validators.isValidDate("00.01.2026")).toBe(false)
      expect(validators.isValidDate("01.13.2026")).toBe(false)
      expect(validators.isValidDate("31.02.2026")).toBe(false)
    })

    test("handles different month lengths", () => {
      expect(validators.isValidDate("31.01.2026")).toBe(true) // 31 days
      expect(validators.isValidDate("30.04.2026")).toBe(true) // 30 days
      expect(validators.isValidDate("31.04.2026")).toBe(false) // April has 30
      expect(validators.isValidDate("28.02.2026")).toBe(true) // Feb non-leap
    })

    // Extended tests - comprehensive month validation
    test("validates correct dates in all months", () => {
      expect(validators.isValidDate("15.01.2026")).toBe(true)
      expect(validators.isValidDate("15.02.2026")).toBe(true)
      expect(validators.isValidDate("15.03.2026")).toBe(true)
      expect(validators.isValidDate("15.04.2026")).toBe(true)
      expect(validators.isValidDate("15.05.2026")).toBe(true)
      expect(validators.isValidDate("15.06.2026")).toBe(true)
      expect(validators.isValidDate("15.07.2026")).toBe(true)
      expect(validators.isValidDate("15.08.2026")).toBe(true)
      expect(validators.isValidDate("15.09.2026")).toBe(true)
      expect(validators.isValidDate("15.10.2026")).toBe(true)
      expect(validators.isValidDate("15.11.2026")).toBe(true)
      expect(validators.isValidDate("15.12.2026")).toBe(true)
    })

    test("validates last day of each month", () => {
      expect(validators.isValidDate("31.01.2026")).toBe(true)
      expect(validators.isValidDate("28.02.2026")).toBe(true)
      expect(validators.isValidDate("31.03.2026")).toBe(true)
      expect(validators.isValidDate("30.04.2026")).toBe(true)
      expect(validators.isValidDate("31.05.2026")).toBe(true)
      expect(validators.isValidDate("30.06.2026")).toBe(true)
      expect(validators.isValidDate("31.07.2026")).toBe(true)
      expect(validators.isValidDate("31.08.2026")).toBe(true)
      expect(validators.isValidDate("30.09.2026")).toBe(true)
      expect(validators.isValidDate("31.10.2026")).toBe(true)
      expect(validators.isValidDate("30.11.2026")).toBe(true)
      expect(validators.isValidDate("31.12.2026")).toBe(true)
    })

    test("rejects invalid day for each month", () => {
      expect(validators.isValidDate("32.01.2026")).toBe(false)
      expect(validators.isValidDate("29.02.2026")).toBe(false) // Not leap year
      expect(validators.isValidDate("32.03.2026")).toBe(false)
      expect(validators.isValidDate("31.04.2026")).toBe(false)
      expect(validators.isValidDate("32.05.2026")).toBe(false)
      expect(validators.isValidDate("31.06.2026")).toBe(false)
      expect(validators.isValidDate("32.07.2026")).toBe(false)
      expect(validators.isValidDate("32.08.2026")).toBe(false)
      expect(validators.isValidDate("31.09.2026")).toBe(false)
      expect(validators.isValidDate("32.10.2026")).toBe(false)
      expect(validators.isValidDate("31.11.2026")).toBe(false)
      expect(validators.isValidDate("32.12.2026")).toBe(false)
    })

    test("validates leap year dates", () => {
      expect(validators.isValidDate("29.02.2024")).toBe(true) // Leap year
      expect(validators.isValidDate("29.02.2025")).toBe(false) // Not leap
      expect(validators.isValidDate("29.02.2028")).toBe(true) // Leap year
    })

    test("rejects invalid format variations", () => {
      expect(validators.isValidDate("1.1.2026")).toBe(false)
      expect(validators.isValidDate("01.1.2026")).toBe(false)
      expect(validators.isValidDate("1.01.2026")).toBe(false)
      expect(validators.isValidDate("01-01-2026")).toBe(false)
      expect(validators.isValidDate("01/01/2026")).toBe(false)
      expect(validators.isValidDate("2026.01.01")).toBe(false)
    })

    // Edge cases from extra
    test("rejects February 30", () => {
      expect(validators.isValidDate("30.02.2024")).toBe(false)
    })

    test("rejects February 29 in non-leap year", () => {
      expect(validators.isValidDate("29.02.2023")).toBe(false)
    })

    test("rejects April 31", () => {
      expect(validators.isValidDate("31.04.2024")).toBe(false)
    })

    test("rejects June 31", () => {
      expect(validators.isValidDate("31.06.2024")).toBe(false)
    })

    test("rejects September 31", () => {
      expect(validators.isValidDate("31.09.2024")).toBe(false)
    })

    test("rejects November 31", () => {
      expect(validators.isValidDate("31.11.2024")).toBe(false)
    })

    test("accepts December 31", () => {
      expect(validators.isValidDate("31.12.2024")).toBe(true)
    })
  })

  describe("parseDate", () => {
    // Basic functionality
    test("parses valid date", () => {
      const result = validators.parseDate("15.03.2026")
      expect(result).toBeInstanceOf(Date)
      expect(result?.getDate()).toBe(15)
      expect(result?.getMonth()).toBe(2) // 0-indexed
      expect(result?.getFullYear()).toBe(2026)
    })

    test("returns null for invalid date", () => {
      expect(validators.parseDate("invalid")).toBeNull()
      expect(validators.parseDate("32.01.2026")).toBeNull()
      expect(validators.parseDate("")).toBeNull()
    })

    test("handles edge case dates", () => {
      expect(validators.parseDate("29.02.2024")).not.toBeNull() // leap year
      expect(validators.parseDate("29.02.2025")).toBeNull() // not leap year
    })

    test("handles first and last day of month", () => {
      expect(validators.parseDate("01.01.2026")).not.toBeNull()
      expect(validators.parseDate("31.12.2026")).not.toBeNull()
    })

    // Edge cases from extra
    test("parses leap day correctly", () => {
      const result = validators.parseDate("29.02.2024")
      expect(result).toBeInstanceOf(Date)
      expect(result?.getDate()).toBe(29)
      expect(result?.getMonth()).toBe(1)
    })

    test("returns null for invalid leap day", () => {
      expect(validators.parseDate("29.02.2023")).toBeNull()
    })

    test("returns null for invalid format variations", () => {
      expect(validators.parseDate("2024-06-15")).toBeNull()
      expect(validators.parseDate("32.01.2024")).toBeNull()
    })
  })

  describe("isValidCurrency", () => {
    // Basic functionality
    test("validates common currencies", () => {
      expect(validators.isValidCurrency("USD")).toBe(true)
      expect(validators.isValidCurrency("EUR")).toBe(true)
      expect(validators.isValidCurrency("GEL")).toBe(true)
      expect(validators.isValidCurrency("RUB")).toBe(true)
    })

    test("rejects invalid currencies", () => {
      expect(validators.isValidCurrency("ABC")).toBe(false)
      expect(validators.isValidCurrency("usd")).toBe(false)
      expect(validators.isValidCurrency("123")).toBe(false)
      expect(validators.isValidCurrency("")).toBe(false)
    })

    // Extended tests - unique
    test("validates all supported currencies", () => {
      expect(validators.isValidCurrency("USD")).toBe(true)
      expect(validators.isValidCurrency("EUR")).toBe(true)
      expect(validators.isValidCurrency("GEL")).toBe(true)
      expect(validators.isValidCurrency("RUB")).toBe(true)
      expect(validators.isValidCurrency("UAH")).toBe(true)
      expect(validators.isValidCurrency("PLN")).toBe(true)
    })

    test("rejects unsupported currencies", () => {
      expect(validators.isValidCurrency("GBP")).toBe(false)
      expect(validators.isValidCurrency("JPY")).toBe(false)
      expect(validators.isValidCurrency("CNY")).toBe(false)
    })

    test("is case sensitive", () => {
      expect(validators.isValidCurrency("usd")).toBe(false)
      expect(validators.isValidCurrency("eur")).toBe(false)
    })

    test("rejects invalid length strings", () => {
      expect(validators.isValidCurrency("US")).toBe(false)
      expect(validators.isValidCurrency("USDD")).toBe(false)
    })
  })

  describe("isValidAccountName", () => {
    // Basic functionality
    test("validates account names", () => {
      expect(validators.isValidAccountName("Cash")).toBe(true)
      expect(validators.isValidAccountName("Main Card")).toBe(true)
      expect(validators.isValidAccountName("Savings 123")).toBe(true)
    })

    test("rejects empty or invalid names", () => {
      expect(validators.isValidAccountName("")).toBe(false)
      expect(validators.isValidAccountName("   ")).toBe(false)
    })

    test("handles special characters", () => {
      expect(validators.isValidAccountName("Card-1")).toBe(true)
      expect(validators.isValidAccountName("Card_Main")).toBe(true)
    })

    // Extended tests - unique
    test("validates non-empty names of any length", () => {
      expect(validators.isValidAccountName("A")).toBe(true)
      expect(validators.isValidAccountName("Bank Account")).toBe(true)
    })

    test("rejects whitespace only variants", () => {
      expect(validators.isValidAccountName("\t")).toBe(false)
      expect(validators.isValidAccountName("\n")).toBe(false)
    })

    test("trims and validates", () => {
      expect(validators.isValidAccountName("  Cash  ")).toBe(true)
      expect(validators.isValidAccountName("\tWallet\t")).toBe(true)
    })
  })

  describe("parseNameAndAmount", () => {
    // Basic functionality
    test("parses name and amount", () => {
      const result = validators.parseNameAndAmount("John 1000", "USD")
      expect(result).toEqual({ name: "John", amount: 1000, currency: "USD" })
    })

    test("parses with currency", () => {
      const result = validators.parseNameAndAmount("John 1000 EUR", "USD")
      expect(result).toEqual({ name: "John", amount: 1000, currency: "EUR" })
    })

    test("handles multi-word names", () => {
      const result = validators.parseNameAndAmount("John Doe 500", "USD")
      expect(result).toEqual({ name: "John Doe", amount: 500, currency: "USD" })
    })

    test("returns null for invalid input", () => {
      expect(validators.parseNameAndAmount("John", "USD")).toBeNull()
      expect(validators.parseNameAndAmount("1000", "USD")).toBeNull()
      expect(validators.parseNameAndAmount("", "USD")).toBeNull()
    })

    test("handles decimal amounts", () => {
      const result = validators.parseNameAndAmount("Test 99.99", "USD")
      expect(result).toEqual({ name: "Test", amount: 99.99, currency: "USD" })
    })

    test("handles comma as decimal separator", () => {
      const result = validators.parseNameAndAmount("Alice 250,50", "EUR")
      expect(result).toEqual({ name: "Alice", amount: 250.5, currency: "EUR" })
    })

    test("rejects zero amount", () => {
      expect(validators.parseNameAndAmount("John 0", "USD")).toBeNull()
      expect(validators.parseNameAndAmount("John 0.00 EUR", "USD")).toBeNull()
    })

    test("rejects negative amount", () => {
      expect(validators.parseNameAndAmount("John -100", "USD")).toBeNull()
    })

    test("rejects invalid currency code", () => {
      expect(validators.parseNameAndAmount("John 100 XYZ", "USD")).toBeNull()
    })

    test("rejects NaN amount", () => {
      expect(validators.parseNameAndAmount("John abc", "USD")).toBeNull()
    })

    // Extended tests - unique
    test("handles different name lengths", () => {
      expect(validators.parseNameAndAmount("A 100 USD")?.name).toBe("A")
      expect(validators.parseNameAndAmount("Alice 100 USD")?.name).toBe("Alice")
      expect(validators.parseNameAndAmount("New Car Fund 5000 EUR")?.name).toBe(
        "New Car Fund"
      )
    })

    test("handles large amounts", () => {
      const result = validators.parseNameAndAmount("Bank 50000 USD")
      expect(result?.amount).toBe(50000)
    })

    test("handles small amounts", () => {
      const result = validators.parseNameAndAmount("Friend 5.50 USD")
      expect(result?.amount).toBe(5.5)
    })

    test("works with all currencies", () => {
      ;["USD", "EUR", "GEL"].forEach((curr) => {
        const result = validators.parseNameAndAmount(`Person 100 ${curr}`)
        expect(result?.currency).toBe(curr)
      })
    })

    test("uses default currency when not specified", () => {
      const result = validators.parseNameAndAmount("Account 100")
      expect(result?.currency).toBe("USD")
    })

    // Extra tests - unique
    test("uses custom default currency", () => {
      expect(validators.parseNameAndAmount("Car 5000", "EUR")).toEqual({
        name: "Car",
        amount: 5000,
        currency: "EUR",
      })
    })

    test("rejects empty name", () => {
      expect(validators.parseNameAndAmount(" 100 USD")).toBeNull()
    })

    test("handles all valid currencies", () => {
      expect(validators.parseNameAndAmount("Test 100 USD")).not.toBeNull()
      expect(validators.parseNameAndAmount("Test 100 EUR")).not.toBeNull()
      expect(validators.parseNameAndAmount("Test 100 GEL")).not.toBeNull()
      expect(validators.parseNameAndAmount("Test 100 RUB")).not.toBeNull()
      expect(validators.parseNameAndAmount("Test 100 UAH")).not.toBeNull()
      expect(validators.parseNameAndAmount("Test 100 PLN")).not.toBeNull()
    })
  })

  describe("isValidDay", () => {
    // Basic functionality
    test("validates day numbers", () => {
      expect(validators.isValidDay(1)).toBe(true)
      expect(validators.isValidDay(15)).toBe(true)
      expect(validators.isValidDay(31)).toBe(true)
    })

    test("rejects invalid days", () => {
      expect(validators.isValidDay(0)).toBe(false)
      expect(validators.isValidDay(32)).toBe(false)
      expect(validators.isValidDay(-1)).toBe(false)
    })

    // Extended tests - unique
    test("validates all valid days from 1 to 31", () => {
      for (let i = 1; i <= 31; i++) {
        expect(validators.isValidDay(i)).toBe(true)
      }
    })

    test("rejects negative days", () => {
      expect(validators.isValidDay(-1)).toBe(false)
      expect(validators.isValidDay(-10)).toBe(false)
    })

    test("rejects decimal numbers", () => {
      expect(validators.isValidDay(15.5)).toBe(false)
      expect(validators.isValidDay(1.1)).toBe(false)
    })

    test("rejects very large numbers", () => {
      expect(validators.isValidDay(100)).toBe(false)
      expect(validators.isValidDay(1000)).toBe(false)
    })
  })

  describe("normalizeAmount", () => {
    // Basic functionality
    test("normalizes amounts to 2 decimals", () => {
      expect(validators.normalizeAmount(100)).toBe(100)
      expect(validators.normalizeAmount(99.999)).toBe(100)
      expect(validators.normalizeAmount(99.994)).toBe(99.99)
    })

    test("handles zero and negative", () => {
      expect(validators.normalizeAmount(0)).toBe(0)
      expect(validators.normalizeAmount(-50.555)).toBe(-50.56)
    })

    // Extended tests - unique
    test("normalizes positive amounts with various decimals", () => {
      expect(validators.normalizeAmount(100.123)).toBe(100.12)
      expect(validators.normalizeAmount(50.505)).toBe(50.51)
    })

    test("normalizes negative amounts", () => {
      expect(validators.normalizeAmount(-100.123)).toBe(-100.12)
      expect(validators.normalizeAmount(-99.999)).toBe(-100)
      expect(validators.normalizeAmount(-50.505)).toBe(-50.51)
    })

    test("handles zero edge cases", () => {
      expect(validators.normalizeAmount(0)).toBe(0)
      expect(validators.normalizeAmount(-0)).toBe(0)
    })

    test("handles very small amounts", () => {
      expect(validators.normalizeAmount(0.001)).toBe(0)
      expect(validators.normalizeAmount(0.005)).toBe(0.01)
      expect(validators.normalizeAmount(0.004)).toBe(0)
    })

    test("handles large amounts", () => {
      expect(validators.normalizeAmount(999999.999)).toBe(1000000)
      expect(validators.normalizeAmount(123456.789)).toBe(123456.79)
    })

    test("handles already normalized amounts", () => {
      expect(validators.normalizeAmount(100.5)).toBe(100.5)
      expect(validators.normalizeAmount(99.99)).toBe(99.99)
    })

    // Extra tests - precision edge cases
    test("handles JavaScript 0.1 + 0.2 precision issue", () => {
      expect(validators.normalizeAmount(0.1 + 0.2)).toBe(0.3)
    })

    test("handles very small positive number", () => {
      expect(validators.normalizeAmount(0.001)).toBe(0)
    })

    test("handles very small negative number", () => {
      expect(validators.normalizeAmount(-0.001)).toBe(-0)
    })

    test("handles 10.005 rounding", () => {
      expect(validators.normalizeAmount(10.005)).toBe(10.01)
    })

    test("handles -10.005 rounding", () => {
      expect(validators.normalizeAmount(-10.005)).toBe(-10.01)
    })
  })

  describe("parseDebtInput", () => {
    // Basic functionality
    test("parses debt I owe", () => {
      const result = validators.parseDebtInput("John 100 USD owe")
      expect(result).toEqual({
        counterparty: "John",
        amount: 100,
        currency: "USD",
        type: "I_OWE",
      })
    })

    test("parses debt someone owes me", () => {
      const result = validators.parseDebtInput("Alice 250.50 EUR me")
      expect(result).toEqual({
        counterparty: "Alice",
        amount: 250.5,
        currency: "EUR",
        type: "OWES_ME",
      })
    })

    test("handles comma as decimal separator", () => {
      const result = validators.parseDebtInput("Bob 75,25 GEL owe")
      expect(result).toEqual({
        counterparty: "Bob",
        amount: 75.25,
        currency: "GEL",
        type: "I_OWE",
      })
    })

    test("rejects invalid format", () => {
      expect(validators.parseDebtInput("John 100 USD")).toBeNull()
      expect(validators.parseDebtInput("100 USD owe")).toBeNull()
      expect(validators.parseDebtInput("John owe")).toBeNull()
    })

    test("rejects zero or negative amount", () => {
      expect(validators.parseDebtInput("John 0 USD owe")).toBeNull()
      expect(validators.parseDebtInput("John -50 USD owe")).toBeNull()
    })

    test("rejects invalid currency", () => {
      expect(validators.parseDebtInput("John 100 XYZ owe")).toBeNull()
    })

    // Extra tests - unique
    test("handles very long counterparty name", () => {
      const result = validators.parseDebtInput(
        "John David Smith Junior 100 USD me"
      )
      expect(result?.counterparty).toBe("John David Smith Junior")
    })

    test("case insensitive ME", () => {
      expect(validators.parseDebtInput("John 100 USD ME")?.type).toBe("OWES_ME")
      expect(validators.parseDebtInput("John 100 USD Me")?.type).toBe("OWES_ME")
    })

    test("case insensitive OWE", () => {
      expect(validators.parseDebtInput("John 100 USD OWE")?.type).toBe("I_OWE")
      expect(validators.parseDebtInput("John 100 USD Owe")?.type).toBe("I_OWE")
    })
  })

  describe("parseGoalInput", () => {
    // Basic functionality
    test("parses goal with currency", () => {
      const result = validators.parseGoalInput("Vacation 5000 EUR")
      expect(result).toEqual({
        name: "Vacation",
        targetAmount: 5000,
        currency: "EUR",
      })
    })

    test("parses goal without currency (uses default)", () => {
      const result = validators.parseGoalInput("Car 20000", "USD")
      expect(result).toEqual({
        name: "Car",
        targetAmount: 20000,
        currency: "USD",
      })
    })

    test("handles multi-word goal names", () => {
      const result = validators.parseGoalInput("New Laptop 1500 GEL")
      expect(result).toEqual({
        name: "New Laptop",
        targetAmount: 1500,
        currency: "GEL",
      })
    })

    test("handles decimal amounts", () => {
      const result = validators.parseGoalInput("Gadget 999.99 USD")
      expect(result).toEqual({
        name: "Gadget",
        targetAmount: 999.99,
        currency: "USD",
      })
    })

    test("handles comma as decimal separator", () => {
      const result = validators.parseGoalInput("Trip 2500,50 RUB")
      expect(result).toEqual({
        name: "Trip",
        targetAmount: 2500.5,
        currency: "RUB",
      })
    })

    test("rejects invalid format", () => {
      expect(validators.parseGoalInput("Goal")).toBeNull()
      expect(validators.parseGoalInput("5000")).toBeNull()
    })

    test("rejects zero or negative amount", () => {
      expect(validators.parseGoalInput("Goal 0 USD")).toBeNull()
      expect(validators.parseGoalInput("Goal -100 USD")).toBeNull()
    })

    test("rejects invalid currency", () => {
      expect(validators.parseGoalInput("Goal 1000 XYZ")).toBeNull()
    })

    // Extra tests - unique
    test("handles very long goal name", () => {
      const result = validators.parseGoalInput(
        "My Super Important Long Term Goal 1000 USD"
      )
      expect(result?.name).toBe("My Super Important Long Term Goal")
    })

    test("handles goal name with special chars", () => {
      const result = validators.parseGoalInput("Goal-2024 1000 USD")
      expect(result?.name).toBe("Goal-2024")
    })
  })

  describe("isValidAmount", () => {
    // Basic functionality
    test("validates positive numbers", () => {
      expect(validators.isValidAmount("100")).toBe(true)
      expect(validators.isValidAmount("0.01")).toBe(true)
      expect(validators.isValidAmount("999999.99")).toBe(true)
    })

    test("rejects zero and negative", () => {
      expect(validators.isValidAmount("0")).toBe(false)
      expect(validators.isValidAmount("-10")).toBe(false)
    })

    test("rejects invalid input", () => {
      expect(validators.isValidAmount("abc")).toBe(false)
      expect(validators.isValidAmount("")).toBe(false)
      expect(validators.isValidAmount("NaN")).toBe(false)
    })
  })

  describe("getValidationErrorMessage", () => {
    // Basic functionality
    test("returns error message for amount", () => {
      const result = validators.getValidationErrorMessage("en", "amount")
      expect(result).toBeTruthy()
      expect(typeof result).toBe("string")
    })

    test("returns error message for balance", () => {
      const result = validators.getValidationErrorMessage("en", "balance")
      expect(result).toBeTruthy()
    })

    test("returns error message for debt", () => {
      const result = validators.getValidationErrorMessage("en", "debt")
      expect(result).toBeTruthy()
    })

    test("returns error message for goal", () => {
      const result = validators.getValidationErrorMessage("en", "goal")
      expect(result).toBeTruthy()
    })

    test("returns default error for unknown type", () => {
      const result = validators.getValidationErrorMessage(
        "en",
        "unknown" as any
      )
      expect(result).toBeTruthy()
      expect(typeof result).toBe("string")
    })

    test("works with different languages", () => {
      expect(validators.getValidationErrorMessage("en", "amount")).toBeTruthy()
      expect(validators.getValidationErrorMessage("ru", "amount")).toBeTruthy()
      expect(validators.getValidationErrorMessage("uk", "amount")).toBeTruthy()
    })
  })
})
