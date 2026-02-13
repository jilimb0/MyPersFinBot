import { dbStorage } from "../../database/storage-db"
import {
  detectAndSetLanguage,
  handleLanguageSelection,
} from "../../handlers/language-handler"

jest.mock("../../database/storage-db", () => ({
  dbStorage: {
    getUserLanguage: jest.fn(),
    setUserLanguage: jest.fn().mockResolvedValue(undefined),
  },
}))

const mockDbStorage = dbStorage as jest.Mocked<typeof dbStorage>

const mockBot = {
  sendMessage: jest.fn().mockResolvedValue({}),
} as any

describe("Language Handler", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockDbStorage.getUserLanguage.mockResolvedValue("en")
  })

  describe("handleLanguageSelection", () => {
    test("selects English by emoji flag", async () => {
      const result = await handleLanguageSelection(mockBot, 123, "456", "🇬🇧")

      expect(result).toBe(true)
      expect(mockDbStorage.setUserLanguage).toHaveBeenCalledWith("456", "en")
      expect(mockBot.sendMessage).toHaveBeenCalled()
    })

    test("selects Russian by emoji flag", async () => {
      const result = await handleLanguageSelection(mockBot, 123, "456", "🇷🇺")

      expect(result).toBe(true)
      expect(mockDbStorage.setUserLanguage).toHaveBeenCalledWith("456", "ru")
    })

    test("selects Ukrainian by emoji flag", async () => {
      const result = await handleLanguageSelection(mockBot, 123, "456", "🇺🇦")

      expect(result).toBe(true)
      expect(mockDbStorage.setUserLanguage).toHaveBeenCalledWith("456", "uk")
    })

    test("selects Spanish by emoji flag", async () => {
      const result = await handleLanguageSelection(mockBot, 123, "456", "🇪🇸")

      expect(result).toBe(true)
      expect(mockDbStorage.setUserLanguage).toHaveBeenCalledWith("456", "es")
    })

    test("selects Polish by emoji flag", async () => {
      const result = await handleLanguageSelection(mockBot, 123, "456", "🇵🇱")

      expect(result).toBe(true)
      expect(mockDbStorage.setUserLanguage).toHaveBeenCalledWith("456", "pl")
    })

    test("selects language by mixed text with flag", async () => {
      const result = await handleLanguageSelection(
        mockBot,
        123,
        "456",
        "🇬🇧 English"
      )

      expect(result).toBe(true)
      expect(mockDbStorage.setUserLanguage).toHaveBeenCalledWith("456", "en")
    })

    test("returns false for invalid language", async () => {
      const result = await handleLanguageSelection(
        mockBot,
        123,
        "456",
        "Invalid"
      )

      expect(result).toBe(false)
      expect(mockDbStorage.setUserLanguage).not.toHaveBeenCalled()
    })

    test("returns false for empty text", async () => {
      const result = await handleLanguageSelection(mockBot, 123, "456", "")

      expect(result).toBe(false)
    })

    test("handles text with emoji combination", async () => {
      const result = await handleLanguageSelection(
        mockBot,
        123,
        "456",
        "🇪🇸 Español"
      )

      expect(result).toBe(true)
      expect(mockDbStorage.setUserLanguage).toHaveBeenCalledWith("456", "es")
    })
  })

  describe("detectAndSetLanguage", () => {
    test("returns existing language if already set", async () => {
      mockDbStorage.getUserLanguage.mockResolvedValue("ru")

      const result = await detectAndSetLanguage("456", "en-US")

      expect(result).toBe("ru")
      expect(mockDbStorage.setUserLanguage).not.toHaveBeenCalled()
    })

    test("detects English from telegram lang code", async () => {
      mockDbStorage.getUserLanguage.mockResolvedValue(null as any)

      const result = await detectAndSetLanguage("456", "en-US")

      expect(result).toBe("en")
      expect(mockDbStorage.setUserLanguage).toHaveBeenCalledWith("456", "en")
    })

    test("detects Russian from telegram lang code", async () => {
      mockDbStorage.getUserLanguage.mockResolvedValue(null as any)

      const result = await detectAndSetLanguage("456", "ru-RU")

      expect(result).toBe("ru")
      expect(mockDbStorage.setUserLanguage).toHaveBeenCalledWith("456", "ru")
    })

    test("detects Ukrainian from telegram lang code", async () => {
      mockDbStorage.getUserLanguage.mockResolvedValue(null as any)

      const result = await detectAndSetLanguage("456", "uk-UA")

      expect(result).toBe("uk")
      expect(mockDbStorage.setUserLanguage).toHaveBeenCalledWith("456", "uk")
    })

    test("detects Spanish from telegram lang code", async () => {
      mockDbStorage.getUserLanguage.mockResolvedValue(null as any)

      const result = await detectAndSetLanguage("456", "es-ES")

      expect(result).toBe("es")
      expect(mockDbStorage.setUserLanguage).toHaveBeenCalledWith("456", "es")
    })

    test("detects Polish from telegram lang code", async () => {
      mockDbStorage.getUserLanguage.mockResolvedValue(null as any)

      const result = await detectAndSetLanguage("456", "pl-PL")

      expect(result).toBe("pl")
      expect(mockDbStorage.setUserLanguage).toHaveBeenCalledWith("456", "pl")
    })

    test("defaults to English for unsupported language", async () => {
      mockDbStorage.getUserLanguage.mockResolvedValue(null as any)

      const result = await detectAndSetLanguage("456", "de-DE")

      expect(result).toBe("en")
      expect(mockDbStorage.setUserLanguage).toHaveBeenCalledWith("456", "en")
    })

    test("defaults to English when no telegram lang code provided", async () => {
      mockDbStorage.getUserLanguage.mockResolvedValue(null as any)

      const result = await detectAndSetLanguage("456")

      expect(result).toBe("en")
      expect(mockDbStorage.setUserLanguage).toHaveBeenCalledWith("456", "en")
    })

    test("handles lang code without region", async () => {
      mockDbStorage.getUserLanguage.mockResolvedValue(null as any)

      const result = await detectAndSetLanguage("456", "ru")

      expect(result).toBe("ru")
      expect(mockDbStorage.setUserLanguage).toHaveBeenCalledWith("456", "ru")
    })

    test("handles uppercase lang code", async () => {
      mockDbStorage.getUserLanguage.mockResolvedValue(null as any)

      const result = await detectAndSetLanguage("456", "EN-GB")

      expect(result).toBe("en")
      expect(mockDbStorage.setUserLanguage).toHaveBeenCalledWith("456", "en")
    })
  })
})
