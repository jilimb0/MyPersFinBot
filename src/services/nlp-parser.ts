import {
  TransactionType,
  TransactionCategory,
  Currency,
  IncomeCategory,
  InternalCategory,
  ExpenseCategory,
} from "../types"

interface NLPResult {
  amount?: number
  type: TransactionType
  category: TransactionCategory
  description: string
  currency?: Currency
  confidence: number // 0-1
}

export class NLPParser {
  // private defaultCurrency: Currency

  // constructor(defaultCurrency: Currency = "USD") {
  //   this.defaultCurrency = defaultCurrency
  // }

  // Main parsing method
  parse(text: string, _userCurrency?: Currency): NLPResult | null {
    const cleaned = text.trim().toLowerCase()

    // Try different parsing strategies
    const simpleResult = this.parseSimple(cleaned)
    if (simpleResult) return simpleResult

    const complexResult = this.parseComplex(cleaned)
    if (complexResult) return complexResult

    return null
  }

  // Simple format: "50 coffee", "100 taxi", "5000 salary"
  private parseSimple(text: string): NLPResult | null {
    // Pattern: number + category/description
    const patterns = [
      /^([\d.,]+)\s*(.+)$/, // "50 coffee"
      /^(.+?)\s+([\d.,]+)$/, // "coffee 50"
    ]

    for (const pattern of patterns) {
      const match = text.match(pattern)
      if (match) {
        const [, first, second] = match

        // Determine which is amount and which is description
        let amount: number
        let desc: string

        if (!first || !second) continue

        if (this.isNumber(first)) {
          amount = this.parseNumber(first)
          desc = second
        } else if (this.isNumber(second)) {
          amount = this.parseNumber(second)
          desc = first
        } else {
          continue
        }

        if (amount > 0) {
          const category = this.detectCategory(desc)
          const type = this.detectType(desc, category)

          return {
            amount,
            type,
            category,
            description: this.capitalize(desc.trim()),
            confidence: 0.9,
          }
        }
      }
    }

    return null
  }

  // Complex format: "потратил 50 на кофе", "salary came", "витратив полтинник"
  private parseComplex(text: string): NLPResult | null {
    // Extract amount
    const amount = this.extractAmount(text)
    if (!amount) return null

    // Detect type from keywords
    const type = this.detectTypeFromText(text)

    // Extract description
    const description = this.extractDescription(text, amount.toString())

    // Detect category
    const category = this.detectCategory(description || text)

    return {
      amount,
      type,
      category,
      description: this.capitalize(
        description || this.getCategoryName(category)
      ),
      confidence: 0.75,
    }
  }

  // Extract amount from text
  private extractAmount(text: string): number | null {
    // Numeric patterns
    const numericMatch = text.match(/([\d.,]+)/)
    if (numericMatch && numericMatch[1]) {
      return this.parseNumber(numericMatch[1])
    }

    // Word numbers (UA/RU/EN)
    const wordNumbers: Record<string, number> = {
      // Ukrainian
      один: 1,
      одна: 1,
      одне: 1,
      два: 2,
      дві: 2,
      три: 3,
      чотири: 4,
      "п'ять": 5,
      пять: 5,
      десять: 10,
      двадцять: 20,
      тридцять: 30,
      сорок: 40,
      "п'ятдесят": 50,
      пятьдесят: 50,
      полтинник: 50,
      сто: 100,
      сотня: 100,
      сотка: 100,
      тисяча: 1000,
      тысяча: 1000,

      // Russian
      рубль: 1,
      рублей: 1,
      гривна: 1,
      гривен: 1,
      доллар: 1,
      долларов: 1,
      евро: 1,

      // English
      one: 1,
      two: 2,
      three: 3,
      four: 4,
      five: 5,
      ten: 10,
      twenty: 20,
      thirty: 30,
      forty: 40,
      fifty: 50,
      hundred: 100,
      thousand: 1000,
    }

    for (const [word, value] of Object.entries(wordNumbers)) {
      if (text.includes(word)) {
        return value
      }
    }

    return null
  }

  // Extract description from text
  private extractDescription(text: string, amountStr: string): string {
    // Remove amount and common words
    const desc = text
      .replace(amountStr, "")
      .replace(/потратил|потратила|витратив|витратила|spent|paid/gi, "")
      .replace(/на|on|for|за/gi, "")
      .replace(/получил|получила|отримав|отримала|received|got/gi, "")
      .replace(/зарплата|salary|wage|зп/gi, "salary")
      .trim()

    return desc || "Other"
  }

  // Detect transaction type from text
  private detectTypeFromText(text: string): TransactionType {
    // Expense keywords
    const expenseKeywords = [
      // UA
      "витратив",
      "витратила",
      "потратил",
      "потратила",
      "купив",
      "купила",
      "заплатив",
      "заплатила",
      "витрата",
      "расход",
      // RU
      "потратил",
      "купил",
      "заплатил",
      "расход",
      // EN
      "spent",
      "bought",
      "paid",
      "expense",
    ]

    // Income keywords
    const incomeKeywords = [
      // UA
      "отримав",
      "отримала",
      "зарплата",
      "дохід",
      "прибуток",
      // RU
      "получил",
      "получила",
      "зарплата",
      "доход",
      "зп",
      // EN
      "received",
      "got",
      "salary",
      "income",
      "wage",
      "earned",
    ]

    for (const keyword of expenseKeywords) {
      if (text.includes(keyword)) {
        return TransactionType.EXPENSE
      }
    }

    for (const keyword of incomeKeywords) {
      if (text.includes(keyword)) {
        return TransactionType.INCOME
      }
    }

    // Default to expense
    return TransactionType.EXPENSE
  }

  // Detect category from description
  private detectCategory(text: string): TransactionCategory {
    const lower = text.toLowerCase()

    // Food & Dining
    const foodKeywords = [
      // UA
      "їжа",
      "їсти",
      "кава",
      "кафе",
      "ресторан",
      "обід",
      "вечеря",
      "сніданок",
      "продукти",
      "магазин",
      "супермаркет",
      "атб",
      "сільпо",
      "новус",
      // RU
      "еда",
      "кофе",
      "кафе",
      "ресторан",
      "обед",
      "ужин",
      "завтрак",
      "продукты",
      "магазин",
      "супермаркет",
      // EN
      "food",
      "eat",
      "coffee",
      "cafe",
      "restaurant",
      "lunch",
      "dinner",
      "breakfast",
      "grocery",
      "supermarket",
      "mcdonald",
      "kfc",
      "burger",
      "pizza",
    ]

    // Transport
    const transportKeywords = [
      // UA/RU
      "транспорт",
      "таксі",
      "такси",
      "uber",
      "bolt",
      "метро",
      "автобус",
      "бензин",
      "паливо",
      "заправка",
      "парковка",
      // EN
      "transport",
      "taxi",
      "bus",
      "metro",
      "fuel",
      "gas",
      "parking",
    ]

    // Entertainment
    const entertainmentKeywords = [
      // UA/RU
      "розваги",
      "развлечения",
      "кіно",
      "кино",
      "netflix",
      "spotify",
      "ігри",
      "игры",
      "steam",
      // EN
      "entertainment",
      "cinema",
      "movie",
      "game",
      "fun",
    ]

    // Shopping
    const shoppingKeywords = [
      // UA/RU
      "покупки",
      "шопінг",
      "шопинг",
      "одяг",
      "одежда",
      "взуття",
      "обувь",
      "rozetka",
      "amazon",
      "aliexpress",
      // EN
      "shopping",
      "clothes",
      "shoes",
      "shop",
      "mall",
    ]

    // Bills
    const billsKeywords = [
      // UA/RU
      "комунальні",
      "коммунальные",
      "рахунок",
      "счет",
      "інтернет",
      "интернет",
      "телефон",
      "електрика",
      "электричество",
      "вода",
      "газ",
      "оренда",
      "аренда",
      // EN
      "bills",
      "utilities",
      "internet",
      "phone",
      "electricity",
      "water",
      "rent",
    ]

    // Health
    const healthKeywords = [
      // UA/RU
      "здоров'я",
      "здоровье",
      "аптека",
      "лікар",
      "врач",
      "клініка",
      "клиника",
      "ліки",
      "лекарства",
      "медицина",
      // EN
      "health",
      "pharmacy",
      "doctor",
      "clinic",
      "medicine",
      "hospital",
    ]

    // Salary
    const salaryKeywords = [
      // UA/RU
      "зарплата",
      "зарплата",
      "зп",
      "оклад",
      "дохід",
      "доход",
      // EN
      "salary",
      "wage",
      "income",
      "payment",
    ]

    // Check categories
    if (foodKeywords.some((k) => lower.includes(k)))
      return ExpenseCategory.FOOD_DINING
    if (transportKeywords.some((k) => lower.includes(k)))
      return ExpenseCategory.TRANSPORTATION
    if (entertainmentKeywords.some((k) => lower.includes(k)))
      return ExpenseCategory.ENTERTAINMENT
    if (shoppingKeywords.some((k) => lower.includes(k)))
      return ExpenseCategory.SHOPPING
    if (billsKeywords.some((k) => lower.includes(k)))
      return ExpenseCategory.UTILITIES
    if (healthKeywords.some((k) => lower.includes(k)))
      return ExpenseCategory.HEALTH
    if (salaryKeywords.some((k) => lower.includes(k)))
      return IncomeCategory.SALARY

    return ExpenseCategory.OTHER_EXPENSE || IncomeCategory.OTHER_INCOME
  }

  // Detect type from category
  private detectType(
    text: string,
    category: TransactionCategory
  ): TransactionType {
    // Income categories
    if (category === IncomeCategory.SALARY) {
      return TransactionType.INCOME
    }

    // Check for income keywords in text
    const incomeKeywords = [
      "salary",
      "зарплата",
      "дохід",
      "доход",
      "received",
      "отримав",
      "получил",
    ]

    if (incomeKeywords.some((k) => text.includes(k))) {
      return TransactionType.INCOME
    }

    return TransactionType.EXPENSE
  }

  // Helper: Check if string is a number
  private isNumber(str: string): boolean {
    return /^[\d.,]+$/.test(str)
  }

  // Helper: Parse number from string
  private parseNumber(str: string): number {
    return parseFloat(str.replace(",", "."))
  }

  // Helper: Capitalize first letter
  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1)
  }

  // Helper: Get category display name
  private getCategoryName(category: TransactionCategory): string {
    const names: Record<TransactionCategory, string> = {
      [ExpenseCategory.FOOD_DINING]: ExpenseCategory.FOOD_DINING,
      [ExpenseCategory.TRANSPORTATION]: ExpenseCategory.TRANSPORTATION,
      [ExpenseCategory.SHOPPING]: ExpenseCategory.SHOPPING,
      [ExpenseCategory.ENTERTAINMENT]: ExpenseCategory.ENTERTAINMENT,
      [ExpenseCategory.UTILITIES]: ExpenseCategory.UTILITIES,
      [ExpenseCategory.HEALTH]: ExpenseCategory.HEALTH,
      [ExpenseCategory.COFFEE]: ExpenseCategory.COFFEE,
      [ExpenseCategory.GROCERIES]: ExpenseCategory.GROCERIES,
      [ExpenseCategory.HOUSING]: ExpenseCategory.HOUSING,
      [ExpenseCategory.EDUCATION]: ExpenseCategory.EDUCATION,
      [ExpenseCategory.OTHER_EXPENSE]: ExpenseCategory.OTHER_EXPENSE,
      [IncomeCategory.SALARY]: IncomeCategory.SALARY,
      [IncomeCategory.FREELANCE]: IncomeCategory.FREELANCE,
      [IncomeCategory.BUSINESS]: IncomeCategory.BUSINESS,
      [IncomeCategory.INVESTMENT]: IncomeCategory.INVESTMENT,
      [IncomeCategory.TRADING]: IncomeCategory.TRADING,
      [IncomeCategory.BONUS]: IncomeCategory.BONUS,
      [IncomeCategory.GIFT]: IncomeCategory.GIFT,
      [IncomeCategory.REFUND]: IncomeCategory.REFUND,
      [IncomeCategory.OTHER_INCOME]: IncomeCategory.OTHER_INCOME,
      [InternalCategory.TRANSFER]: InternalCategory.TRANSFER,
      [InternalCategory.GOAL_DEPOSIT]: InternalCategory.GOAL_DEPOSIT,
      [InternalCategory.DEBT_REPAYMENT]: InternalCategory.DEBT_REPAYMENT,
    }
    return names[category] || category
  }
}

// Singleton instance
export const nlpParser = new NLPParser()
