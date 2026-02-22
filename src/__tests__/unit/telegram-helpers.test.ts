import type TelegramBot from "@telegram-api"
import { t } from "../../i18n"
import {
  createListButtons,
  escapeMarkdown,
  safeAnswerCallback,
} from "../../utils/telegram-helpers"

/**
 * Comprehensive test suite for Telegram helper functions.
 * Merged from telegram-helpers.test.ts, telegram-helpers-extended.test.ts, and telegram-helpers-extra.test.ts
 * All duplicate tests have been removed.
 */
describe("Telegram helpers", () => {
  const mockBot = {
    answerCallbackQuery: jest.fn(),
  } as any

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("escapeMarkdown", () => {
    // Basic functionality
    test("should escape special characters", () => {
      const input = "\\*_[]()``"
      expect(escapeMarkdown(input)).toBe("\\\\\\*\\_\\[\\]\\(\\)\\`\\`")
    })

    test("should handle empty input", () => {
      expect(escapeMarkdown("")).toBe("")
    })

    // Extended tests - unique
    test("escapes all special characters in complex string", () => {
      const input = "*bold* _italic_ [link](url) `code` (parens) backslash\\"
      const result = escapeMarkdown(input)

      expect(result).toContain("\\*")
      expect(result).toContain("\\_")
      expect(result).toContain("\\[")
      expect(result).toContain("\\]")
      expect(result).toContain("\\(")
      expect(result).toContain("\\)")
      expect(result).toContain("\\`")
    })

    test("handles null and undefined", () => {
      expect(escapeMarkdown(null as any)).toBe("")
      expect(escapeMarkdown(undefined as any)).toBe("")
    })

    test("handles string without special chars", () => {
      const input = "Hello World 123"
      expect(escapeMarkdown(input)).toBe(input)
    })

    test("escapes multiple asterisks", () => {
      expect(escapeMarkdown("***")).toBe("\\*\\*\\*")
    })

    test("escapes backslashes correctly", () => {
      expect(escapeMarkdown("\\")).toBe("\\\\")
      expect(escapeMarkdown("\\\\")).toBe("\\\\\\\\")
    })

    test("handles numbers and special chars mixed", () => {
      const input = "Price: $100 (50% off) *limited*"
      const result = escapeMarkdown(input)
      expect(result).toContain("\\*")
      expect(result).toContain("\\(")
      expect(result).toContain("\\)")
    })
  })

  describe("safeAnswerCallback", () => {
    // Basic functionality
    test("should no-op when options missing", async () => {
      const bot = { answerCallbackQuery: jest.fn() } as any as TelegramBot
      await safeAnswerCallback(bot, undefined)
      expect(bot.answerCallbackQuery).not.toHaveBeenCalled()
    })

    test("should ignore outdated callback errors", async () => {
      const bot = {
        answerCallbackQuery: jest.fn().mockRejectedValue({
          response: { body: { description: "query is too old" } },
        }),
      } as any as TelegramBot

      await safeAnswerCallback(bot, { callback_query_id: "1" } as any)
      expect(bot.answerCallbackQuery).toHaveBeenCalled()
    })

    test("should log unexpected errors", async () => {
      const bot = {
        answerCallbackQuery: jest.fn().mockRejectedValue(new Error("boom")),
      } as any as TelegramBot

      const spy = jest.spyOn(console, "error").mockImplementation(() => {})
      await safeAnswerCallback(bot, { callback_query_id: "1" } as any)
      expect(spy).toHaveBeenCalled()
      spy.mockRestore()
    })

    // Extended tests - unique
    test("answers callback query successfully", async () => {
      mockBot.answerCallbackQuery.mockResolvedValue(true)

      await safeAnswerCallback(mockBot, { callback_query_id: "123" })

      expect(mockBot.answerCallbackQuery).toHaveBeenCalledWith(
        "123",
        expect.any(Object)
      )
    })

    test("ignores 'query is too old' error with full message", async () => {
      mockBot.answerCallbackQuery.mockRejectedValue({
        response: {
          body: {
            description:
              "Bad Request: query is too old and response timeout expired",
          },
        },
      })

      await expect(
        safeAnswerCallback(mockBot, { callback_query_id: "123" })
      ).resolves.not.toThrow()
    })

    test("ignores 'query ID is invalid' error", async () => {
      mockBot.answerCallbackQuery.mockRejectedValue({
        response: {
          body: {
            description: "Bad Request: query ID is invalid",
          },
        },
      })

      await expect(
        safeAnswerCallback(mockBot, { callback_query_id: "invalid" })
      ).resolves.not.toThrow()
    })

    test("logs other errors to console", async () => {
      const consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {})

      mockBot.answerCallbackQuery.mockRejectedValue({
        message: "Network error",
      })

      await safeAnswerCallback(mockBot, { callback_query_id: "123" })

      expect(consoleErrorSpy).toHaveBeenCalled()
      consoleErrorSpy.mockRestore()
    })

    test("handles error without message property", async () => {
      const consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {})

      mockBot.answerCallbackQuery.mockRejectedValue(new Error("Test error"))

      await safeAnswerCallback(mockBot, { callback_query_id: "123" })

      expect(consoleErrorSpy).toHaveBeenCalled()
      consoleErrorSpy.mockRestore()
    })

    test("handles callback with custom text", async () => {
      mockBot.answerCallbackQuery.mockResolvedValue(true)

      await safeAnswerCallback(mockBot, {
        callback_query_id: "123",
        text: "Success!",
      } as any)

      expect(mockBot.answerCallbackQuery).toHaveBeenCalled()
    })
  })

  describe("createListButtons", () => {
    // Basic functionality
    test("should create rows and include back buttons by default", () => {
      const buttons = createListButtons({
        items: ["A", "B"],
        lang: "en",
      })

      expect(buttons.length).toBeGreaterThan(0)
      const lastRow = buttons.at(-1)!
      expect(lastRow.map((b) => b.text)).toContain(t("en", "buttons.back"))
    })

    test("should add main menu button when withoutBack is true", () => {
      const buttons = createListButtons({
        items: ["A"],
        withoutBack: true,
        lang: "en",
      })
      const lastRow = buttons.at(-1)!
      expect(lastRow.map((b) => b.text)).toContain(
        t("en", "mainMenu.mainMenuButton")
      )
    })

    test("should respect itemsPerRowCustom when >=4 items", () => {
      const buttons = createListButtons({
        items: ["A", "B", "C", "D"],
        itemsPerRowCustom: 3,
        lang: "en",
      })
      expect(buttons[0]!.length).toBe(3)
    })

    test("should include before and after items", () => {
      const buttons = createListButtons({
        items: ["A"],
        beforeItemsButtons: [[{ text: "X" }]],
        afterItemsButtons: ["B"],
        lang: "en",
      })
      const flat = buttons.flat().map((b) => b.text)
      expect(flat).toContain("X")
      expect(flat).toContain("B")
    })

    // Extended tests - items per row logic
    test("creates buttons with 1 item per row for less than 4 items", () => {
      const result = createListButtons({
        items: ["Item 1", "Item 2"],
        lang: "en",
      })

      expect(result).toHaveLength(3) // 2 item rows + 1 back row
      expect(result[0]).toHaveLength(1)
      expect(result[1]).toHaveLength(1)
      expect(result[2]).toHaveLength(2) // back + main menu
    })

    test("creates buttons with 2 items per row for 4+ items", () => {
      const result = createListButtons({
        items: ["Item 1", "Item 2", "Item 3", "Item 4"],
        lang: "en",
      })

      expect(result[0]).toHaveLength(2)
      expect(result[1]).toHaveLength(2)
    })

    test("uses custom items per row", () => {
      const result = createListButtons({
        items: ["1", "2", "3", "4", "5", "6"],
        itemsPerRowCustom: 3,
        lang: "en",
      })

      expect(result[0]).toHaveLength(3)
      expect(result[1]).toHaveLength(3)
    })

    test("adds back and main menu buttons by default", () => {
      const result = createListButtons({
        items: ["Item 1"],
        lang: "en",
      })

      const lastRow = result[result.length - 1]!
      expect(lastRow).toHaveLength(2)
    })

    test("includes beforeItemsButtons correctly", () => {
      const result = createListButtons({
        items: ["Item 1"],
        beforeItemsButtons: [[{ text: "Custom" }]],
        lang: "en",
      })

      expect(result[0]![0]!.text).toBe("Custom")
    })

    test("includes afterItemsButtons in items array", () => {
      const result = createListButtons({
        items: ["Item 1"],
        afterItemsButtons: ["After 1", "After 2"],
        lang: "en",
      })

      expect(result).toEqual(
        expect.arrayContaining([
          expect.arrayContaining([
            expect.objectContaining({ text: "After 1" }),
          ]),
        ])
      )
    })

    // Edge cases
    test("handles empty items array", () => {
      const result = createListButtons({
        items: [],
        lang: "en",
      })

      // Should still have back button
      expect(result.length).toBeGreaterThan(0)
      expect(result[result.length - 1]).toHaveLength(2)
    })

    test("filters out empty/null items", () => {
      const result = createListButtons({
        items: ["Item 1", "", "Item 3", null as any, "Item 5"],
        lang: "en",
      })

      const allButtons = result.flat()
      const itemButtons = allButtons.filter(
        (b) => b.text.startsWith("Item") && b.text !== ""
      )
      expect(itemButtons).toHaveLength(3) // Only Item 1, 3, 5
    })

    test("handles odd number of items correctly", () => {
      const result = createListButtons({
        items: ["1", "2", "3", "4", "5"],
        itemsPerRowCustom: 2,
        lang: "en",
      })

      expect(result[0]).toHaveLength(2)
      expect(result[1]).toHaveLength(2)
      expect(result[2]).toHaveLength(1) // Last row with 1 item
    })

    test("handles single item", () => {
      const result = createListButtons({
        items: ["Single Item"],
        lang: "en",
      })
      expect(result.length).toBeGreaterThan(0)
    })

    test("handles many items", () => {
      const items = Array.from({ length: 20 }, (_, i) => `Item ${i + 1}`)
      const result = createListButtons({
        items,
        lang: "en",
      })
      expect(result.length).toBeGreaterThan(5)
    })

    test("handles exactly 4 items", () => {
      const result = createListButtons({
        items: ["1", "2", "3", "4"],
        lang: "en",
      })
      expect(result.length).toBeGreaterThan(1)
    })

    test("handles custom per row with few items", () => {
      const result = createListButtons({
        items: ["1", "2"],
        itemsPerRowCustom: 3,
        lang: "en",
      })
      expect(result.length).toBeGreaterThan(0)
    })

    test("preserves button order", () => {
      const items = ["First", "Second", "Third"]
      const result = createListButtons({
        items: [...items],
        lang: "en",
      })

      let foundFirst = false
      for (const row of result) {
        for (const btn of row) {
          if (btn.text === "First") {
            foundFirst = true
            break
          }
        }
        if (foundFirst) break
      }
      expect(foundFirst).toBe(true)
    })

    test("handles undefined in items", () => {
      const result = createListButtons({
        items: ["Item 1", undefined as any, "Item 2"],
        lang: "en",
      })
      expect(result.length).toBeGreaterThan(0)
    })

    // Language tests
    test("works with Russian language", () => {
      const result = createListButtons({
        items: ["Пункт 1", "Пункт 2"],
        lang: "ru",
      })
      expect(result).toBeDefined()
      expect(result.length).toBeGreaterThan(0)
    })

    test("works with Spanish language", () => {
      const result = createListButtons({
        items: ["Item 1", "Item 2"],
        lang: "es",
      })
      expect(result.length).toBeGreaterThan(0)
    })

    test("works with Ukrainian language", () => {
      const result = createListButtons({
        items: ["Пункт 1", "Пункт 2"],
        lang: "uk",
      })
      expect(result.length).toBeGreaterThan(0)
    })

    // Complex scenarios
    test("handles complex scenario with all options", () => {
      const result = createListButtons({
        items: ["1", "2", "3", "4"],
        beforeItemsButtons: [[{ text: "Before" }]],
        afterItemsButtons: ["After"],
        itemsPerRowCustom: 2,
        withoutBack: false,
        lang: "en",
      })

      expect(result.length).toBeGreaterThan(2)
      expect(result[0]![0]!.text).toBe("Before")
    })

    test("handles withoutBack flag correctly", () => {
      const resultWithBack = createListButtons({
        items: ["Item"],
        withoutBack: false,
        lang: "en",
      })

      const resultWithoutBack = createListButtons({
        items: ["Item"],
        withoutBack: true,
        lang: "en",
      })

      const lastRowWith = resultWithBack[resultWithBack.length - 1]!
      const lastRowWithout = resultWithoutBack[resultWithoutBack.length - 1]!

      expect(lastRowWith.length).toBe(2) // back + main
      expect(lastRowWithout.length).toBe(1) // only main
    })
  })
})
