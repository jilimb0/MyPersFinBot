import { TransactionType } from "../../types"
import {
  formatSearchUsage,
  parseSearchCommandInput,
} from "../../utils/search-filters"

describe("search-filters", () => {
  test("handles undefined and empty input", () => {
    expect(parseSearchCommandInput(undefined)).toEqual({
      filters: {},
      errors: [],
    })
    expect(parseSearchCommandInput("   ")).toEqual({ filters: {}, errors: [] })
  })

  test("parses query and full filter set", () => {
    const parsed = parseSearchCommandInput(
      "coffee beans --type=EXPENSE --category=FOOD_DINING --from=2026-01-01 --to=2026-01-31 --min=10 --max=200 --account=Card --from-account=Card --to-account=Savings"
    )

    expect(parsed.errors).toHaveLength(0)
    expect(parsed.filters.query).toBe("coffee beans")
    expect(parsed.filters.type).toBe(TransactionType.EXPENSE)
    expect(parsed.filters.category).toBe("FOOD_DINING")
    expect(parsed.filters.startDate).toEqual(new Date("2026-01-01"))
    expect(parsed.filters.endDate?.getHours()).toBe(23)
    expect(parsed.filters.minAmount).toBe(10)
    expect(parsed.filters.maxAmount).toBe(200)
    expect(parsed.filters.accountId).toBe("Card")
    expect(parsed.filters.fromAccountId).toBe("Card")
    expect(parsed.filters.toAccountId).toBe("Savings")
  })

  test("collects validation errors for invalid values", () => {
    const parsed = parseSearchCommandInput(
      "--type=wrong --from=2026-13-40 --min=abc --unknown=x"
    )

    expect(parsed.errors.join(" ")).toContain("Invalid type")
    expect(parsed.errors.join(" ")).toContain("Invalid from date")
    expect(parsed.errors.join(" ")).toContain("Invalid min amount")
    expect(parsed.errors.join(" ")).toContain("Unknown filter")
  })

  test("validates boundary ranges", () => {
    const invalidDateRange = parseSearchCommandInput(
      "--from=2026-02-02 --to=2026-02-01"
    )
    expect(invalidDateRange.errors.join(" ")).toContain("Date range is invalid")

    const invalidAmountRange = parseSearchCommandInput("--min=100 --max=10")
    expect(invalidAmountRange.errors.join(" ")).toContain(
      "Amount range is invalid"
    )
  })

  test("handles empty key/value edge cases", () => {
    const parsed = parseSearchCommandInput("--=1 --type=")
    expect(parsed.errors.join(" ")).toContain("Empty filter key")
    expect(parsed.errors.join(" ")).toContain("has empty value")
  })

  test("returns usage string", () => {
    expect(formatSearchUsage()).toContain("/search")
    expect(formatSearchUsage()).toContain("--type=EXPENSE")
    expect(formatSearchUsage()).toContain("--from-account=Card")
  })

  test("supports combined account filters", () => {
    const parsed = parseSearchCommandInput(
      "--account=Card --from-account=Card --to-account=Savings"
    )
    expect(parsed.errors).toHaveLength(0)
    expect(parsed.filters.accountId).toBe("Card")
    expect(parsed.filters.fromAccountId).toBe("Card")
    expect(parsed.filters.toAccountId).toBe("Savings")
  })
})
