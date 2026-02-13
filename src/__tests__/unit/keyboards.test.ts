import {
  getAnalyticsKeyboard,
  getBackAndMainKeyboard,
  getConfirmKeyboard,
  getDateKeyboard,
  getGoToBalancesKeyboard,
  getLanguageKeyboard,
  getMainMenuKeyboard,
  getReminderTimeKeyboard,
  getSettingsKeyboard,
  getStartTrackingKeyboard,
  getStatsKeyboard,
} from "../../i18n/keyboards"

describe("keyboards", () => {
  describe("getMainMenuKeyboard", () => {
    it("should generate main menu keyboard for English", () => {
      const result = getMainMenuKeyboard("en")
      expect(result.reply_markup).toBeDefined()
      const keyboard =
        result.reply_markup as import("node-telegram-bot-api").ReplyKeyboardMarkup
      expect(keyboard.keyboard).toHaveLength(4)
      expect(keyboard.resize_keyboard).toBe(true)
    })

    it("should generate main menu keyboard for Russian", () => {
      const result = getMainMenuKeyboard("ru")
      expect(result.reply_markup).toBeDefined()
      const keyboard =
        result.reply_markup as import("node-telegram-bot-api").ReplyKeyboardMarkup
      expect(keyboard.keyboard).toHaveLength(4)
    })
  })

  describe("getSettingsKeyboard", () => {
    it("should generate settings keyboard", () => {
      const keyboard = getSettingsKeyboard("en")
      expect(keyboard).toBeDefined()
      expect(keyboard.keyboard).toBeDefined()
      expect(keyboard.resize_keyboard).toBe(true)
      expect(keyboard.keyboard.length).toBeGreaterThan(0)
    })
  })

  describe("getAnalyticsKeyboard", () => {
    it("should generate analytics keyboard", () => {
      const keyboard = getAnalyticsKeyboard("en")
      expect(keyboard).toBeDefined()
      expect(keyboard.keyboard).toBeDefined()
      expect(keyboard.resize_keyboard).toBe(true)
    })
  })

  describe("getStatsKeyboard", () => {
    it("should generate stats keyboard", () => {
      const keyboard = getStatsKeyboard("en")
      expect(keyboard).toBeDefined()
      expect(keyboard.keyboard).toBeDefined()
      expect(keyboard.resize_keyboard).toBe(true)
    })
  })

  describe("getBackAndMainKeyboard", () => {
    it("should generate back and main menu keyboard", () => {
      const keyboard = getBackAndMainKeyboard("en")
      expect(keyboard).toBeDefined()
      expect(keyboard.keyboard).toBeDefined()
      expect(keyboard.keyboard).toHaveLength(1)
      expect(keyboard.keyboard[0]).toHaveLength(2)
      expect(keyboard.resize_keyboard).toBe(true)
    })
  })

  describe("getDateKeyboard", () => {
    it("should generate date selection keyboard", () => {
      const keyboard = getDateKeyboard("en")
      expect(keyboard).toBeDefined()
      expect(keyboard.keyboard).toBeDefined()
      expect(keyboard.resize_keyboard).toBe(true)
    })
  })

  describe("getConfirmKeyboard", () => {
    it("should generate confirm/cancel keyboard", () => {
      const keyboard = getConfirmKeyboard("en")
      expect(keyboard).toBeDefined()
      expect(keyboard.keyboard).toBeDefined()
      expect(keyboard.keyboard).toHaveLength(1)
      expect(keyboard.keyboard[0]).toHaveLength(2)
      expect(keyboard.resize_keyboard).toBe(true)
    })
  })

  describe("getLanguageKeyboard", () => {
    it("should generate language selection keyboard", () => {
      const keyboard = getLanguageKeyboard("en")
      expect(keyboard).toBeDefined()
      expect(keyboard.keyboard).toBeDefined()
      expect(keyboard.resize_keyboard).toBe(true)
      // Should have 5 languages + back button
      expect(keyboard.keyboard.length).toBeGreaterThanOrEqual(6)
    })
  })

  describe("getStartTrackingKeyboard", () => {
    it("should generate start tracking keyboard for English", () => {
      const keyboard = getStartTrackingKeyboard("en")
      expect(keyboard).toBeDefined()
      expect(keyboard.keyboard).toBeDefined()
      expect(keyboard.keyboard).toHaveLength(1)
      expect(keyboard.keyboard[0]).toHaveLength(1)
      expect(keyboard.resize_keyboard).toBe(true)
    })

    it("should generate start tracking keyboard for Russian", () => {
      const keyboard = getStartTrackingKeyboard("ru")
      expect(keyboard).toBeDefined()
      expect(keyboard.keyboard).toBeDefined()
      expect(keyboard.resize_keyboard).toBe(true)
    })

    it("should work with all supported languages", () => {
      const languages = ["en", "ru", "uk", "es", "pl"] as const
      languages.forEach((lang) => {
        const keyboard = getStartTrackingKeyboard(lang)
        expect(keyboard).toBeDefined()
        expect(keyboard.keyboard).toBeDefined()
        expect(keyboard.resize_keyboard).toBe(true)
      })
    })
  })

  describe("getGoToBalancesKeyboard", () => {
    it("should generate go to balances keyboard for English", () => {
      const keyboard = getGoToBalancesKeyboard("en")
      expect(keyboard).toBeDefined()
      expect(keyboard.keyboard).toBeDefined()
      expect(keyboard.keyboard).toHaveLength(2)
      expect(keyboard.keyboard[0]).toHaveLength(1)
      expect(keyboard.keyboard[1]).toHaveLength(1)
      expect(keyboard.resize_keyboard).toBe(true)
    })

    it("should generate go to balances keyboard for Russian", () => {
      const keyboard = getGoToBalancesKeyboard("ru")
      expect(keyboard).toBeDefined()
      expect(keyboard.keyboard).toBeDefined()
      expect(keyboard.resize_keyboard).toBe(true)
    })

    it("should work with all supported languages", () => {
      const languages = ["en", "ru", "uk", "es", "pl"] as const
      languages.forEach((lang) => {
        const keyboard = getGoToBalancesKeyboard(lang)
        expect(keyboard).toBeDefined()
        expect(keyboard.keyboard).toBeDefined()
        expect(keyboard.keyboard).toHaveLength(2)
        expect(keyboard.resize_keyboard).toBe(true)
      })
    })
  })

  describe("getReminderTimeKeyboard", () => {
    it("should generate reminder time selection keyboard for English", () => {
      const keyboard = getReminderTimeKeyboard("en")
      expect(keyboard).toBeDefined()
      expect(keyboard.keyboard).toBeDefined()
      expect(keyboard.resize_keyboard).toBe(true)
      // Last row should be back + main menu
      const lastRow = keyboard.keyboard[keyboard.keyboard.length - 1]
      expect(lastRow).toHaveLength(2)
    })

    it("should generate reminder time selection keyboard for Russian", () => {
      const keyboard = getReminderTimeKeyboard("ru")
      expect(keyboard).toBeDefined()
      expect(keyboard.keyboard).toBeDefined()
      expect(keyboard.resize_keyboard).toBe(true)
    })

    it("should work with all supported languages", () => {
      const languages = ["en", "ru", "uk", "es", "pl"] as const
      languages.forEach((lang) => {
        const keyboard = getReminderTimeKeyboard(lang)
        expect(keyboard).toBeDefined()
        expect(keyboard.keyboard).toBeDefined()
        expect(keyboard.resize_keyboard).toBe(true)
        expect(keyboard.keyboard.length).toBeGreaterThan(0)
      })
    })

    it("should arrange time options in rows of 3", () => {
      const keyboard = getReminderTimeKeyboard("en")
      expect(keyboard).toBeDefined()
      expect(keyboard.keyboard).toBeDefined()
      // All rows except the last (back+main) should have max 3 buttons
      const timeRows = keyboard.keyboard.slice(0, -1)
      timeRows.forEach((row) => {
        expect(row.length).toBeLessThanOrEqual(3)
      })
    })
  })
})
