# 📝 JSDoc Documentation Examples

This guide provides examples of how to document your code using JSDoc comments for TypeDoc generation.

---

## 📋 Table of Contents

- [Functions](#functions)
- [Classes](#classes)
- [Interfaces](#interfaces)
- [Types](#types)
- [Constants](#constants)
- [Async Functions](#async-functions)
- [Complex Examples](#complex-examples)

---

## Functions

### Basic Function

```typescript
/**
 * Converts an amount from one currency to another.
 * 
 * @param amount - The amount to convert
 * @param from - Source currency code
 * @param to - Target currency code (defaults to USD)
 * @returns The converted amount
 * 
 * @example
 * ```typescript
 * const euros = convertSync(100, "USD", "EUR")
 * console.log(euros) // ~92.5
 * ```
 */
export function convertSync(
  amount: number,
  from: Currency,
  to: Currency = "USD"
): number {
  // Implementation
}
```

### Function with Errors

```typescript
/**
 * Fetches exchange rates from the API.
 * 
 * @returns Promise resolving to exchange rates object
 * @throws {Error} When API request fails
 * @throws {Error} When response is invalid
 * 
 * @example
 * ```typescript
 * try {
 *   const rates = await fetchRates()
 *   console.log(rates.USD) // 1
 * } catch (error) {
 *   console.error("Failed to fetch rates", error)
 * }
 * ```
 */
async function fetchRates(): Promise<FXRates> {
  // Implementation
}
```

---

## Classes

### Basic Class

```typescript
/**
 * Service for voice message transcription using AssemblyAI.
 * 
 * @remarks
 * This service handles audio file upload, transcription job creation,
 * and polling for results.
 * 
 * @example
 * ```typescript
 * const service = new AssemblyAIService({ apiKey: "your-key" })
 * const text = await service.transcribeFile("path/to/audio.wav")
 * console.log(text)
 * ```
 */
export class AssemblyAIService {
  /**
   * AssemblyAI API key.
   * @private
   */
  private apiKey: string

  /**
   * Base URL for AssemblyAI API.
   * @private
   */
  private baseUrl = "https://api.assemblyai.com/v2"

  /**
   * Creates a new AssemblyAI service instance.
   * 
   * @param config - Configuration object
   * @param config.apiKey - AssemblyAI API key
   */
  constructor(config: AssemblyAIConfig) {
    this.apiKey = config.apiKey
  }

  /**
   * Checks if the service is configured and ready to use.
   * 
   * @returns True if API key is configured, false otherwise
   */
  isAvailable(): boolean {
    return !!this.apiKey && this.apiKey !== "YOUR_ASSEMBLYAI_API_KEY"
  }

  /**
   * Transcribes an audio file to text.
   * 
   * @param filePath - Path to the audio file
   * @returns Transcribed text, or null if transcription failed
   * @throws {Error} If file doesn't exist
   * @throws {Error} If upload fails
   * 
   * @example
   * ```typescript
   * const text = await service.transcribeFile("./recording.wav")
   * if (text) {
   *   console.log("Transcription:", text)
   * }
   * ```
   */
  async transcribeFile(filePath: string): Promise<string | null> {
    // Implementation
  }
}
```

---

## Interfaces

### Basic Interface

```typescript
/**
 * Configuration for FX rate caching.
 * 
 * @interface
 */
interface FXCache {
  /**
   * Exchange rates object with currency codes as keys.
   */
  rates: FXRates

  /**
   * Timestamp when rates were fetched (Unix milliseconds).
   */
  timestamp: number

  /**
   * Timestamp of last error (Unix milliseconds).
   * @optional
   */
  lastError?: number

  /**
   * Number of consecutive errors.
   * @default 0
   */
  errorCount: number
}
```

### Complex Interface

```typescript
/**
 * Represents a financial transaction.
 * 
 * @interface
 * @category Database
 */
interface Transaction {
  /**
   * Unique transaction identifier.
   * @readonly
   */
  readonly id: string

  /**
   * Transaction amount (always positive).
   * @minimum 0.01
   * @maximum 1000000
   */
  amount: number

  /**
   * Currency code (ISO 4217).
   * @example "USD", "EUR", "GEL"
   */
  currency: Currency

  /**
   * Transaction type.
   */
  type: TransactionType

  /**
   * Transaction category.
   * @see TransactionCategory
   */
  category: string

  /**
   * Optional transaction description.
   * @maxLength 500
   */
  description?: string

  /**
   * Transaction date.
   * @default Current date
   */
  date: Date

  /**
   * User who created the transaction.
   */
  userId: string
}
```

---

## Types

### Union Types

```typescript
/**
 * Supported currency codes.
 * 
 * @typedef {string} Currency
 * 
 * @remarks
 * Limited to currencies supported by the FX rate API.
 */
export type Currency = "USD" | "EUR" | "GEL" | "RUB" | "UAH" | "PLN"

/**
 * Transaction type indicator.
 * 
 * @typedef {string} TransactionType
 */
export type TransactionType = "income" | "expense"
```

### Complex Types

```typescript
/**
 * Result of a transcription operation.
 * 
 * @typedef {Object} TranscriptionResult
 * @property {string} id - Transcription job ID
 * @property {TranscriptionStatus} status - Current status
 * @property {string} [text] - Transcribed text (if completed)
 * @property {string} [error] - Error message (if failed)
 */
type TranscriptionResult = {
  id: string
  status: "queued" | "processing" | "completed" | "error"
  text?: string
  error?: string
}
```

---

## Constants

```typescript
/**
 * Maximum number of retry attempts for API calls.
 * 
 * @constant
 * @type {number}
 * @default 3
 */
const MAX_RETRIES = 3

/**
 * Cache TTL in milliseconds (1 hour).
 * 
 * @constant
 * @type {number}
 * @default 3600000
 */
const CACHE_TTL_MS = 60 * 60 * 1000

/**
 * Default fallback exchange rates.
 * 
 * @constant
 * @type {FXRates}
 * @readonly
 * 
 * @remarks
 * Used when API is unavailable. Rates are approximate.
 */
const FALLBACK_RATES: FXRates = {
  USD: 1,
  EUR: 0.92,
  GEL: 2.7,
  RUB: 95.0,
  UAH: 41.0,
  PLN: 4.0,
}
```

---

## Async Functions

### Promise-based

```typescript
/**
 * Fetches current exchange rates from the API.
 * 
 * @async
 * @returns Promise that resolves to exchange rates object
 * 
 * @throws {Error} When API request fails after retries
 * @throws {Error} When response format is invalid
 * 
 * @remarks
 * - Uses caching with 1-hour TTL
 * - Implements retry logic with exponential backoff
 * - Falls back to hardcoded rates on failure
 * 
 * @example
 * ```typescript
 * const rates = await getRates()
 * console.log(`1 USD = ${rates.EUR} EUR`)
 * ```
 * 
 * @see {@link CACHE_TTL_MS} for cache duration
 * @see {@link FALLBACK_RATES} for fallback values
 */
export async function getRates(): Promise<FXRates> {
  // Implementation
}
```

### With Complex Logic

```typescript
/**
 * Handles voice message processing and transcription.
 * 
 * @async
 * @param bot - Telegram bot instance
 * @param msg - Incoming message object
 * @param wizard - Wizard manager for state management
 * 
 * @returns Promise that resolves when processing completes
 * 
 * @throws {Error} When FFmpeg is not installed
 * @throws {Error} When transcription times out
 * 
 * @remarks
 * Processing steps:
 * 1. Download voice message from Telegram
 * 2. Convert OGA to WAV format
 * 3. Transcribe using AssemblyAI
 * 4. Parse transcription with NLP
 * 5. Create transaction from parsed data
 * 
 * @example
 * ```typescript
 * bot.on("voice", async (msg) => {
 *   await handleVoiceMessage(bot, msg, wizard)
 * })
 * ```
 * 
 * @category Handlers
 */
export async function handleVoiceMessage(
  bot: TelegramBot,
  msg: TelegramBot.Message,
  wizard: WizardManager
): Promise<void> {
  // Implementation
}
```

---

## Complex Examples

### Service Class

```typescript
/**
 * Foreign exchange rate service with caching and retry logic.
 * 
 * @remarks
 * Features:
 * - Automatic rate fetching from API
 * - In-memory caching with configurable TTL
 * - Persistent cache to disk
 * - Retry logic with exponential backoff
 * - Fallback rates for offline operation
 * - Metrics tracking (cache hits, API calls, errors)
 * 
 * @example
 * ```typescript
 * // Initialize and fetch rates
 * await preloadRates()
 * 
 * // Convert currencies
 * const amount = convertSync(100, "USD", "EUR")
 * console.log(`100 USD = ${amount.toFixed(2)} EUR`)
 * 
 * // Batch conversion
 * const results = convertBatchSync([
 *   { amount: 100, from: "USD", to: "EUR" },
 *   { amount: 50, from: "EUR", to: "GEL" }
 * ])
 * 
 * // Get metrics
 * const metrics = getMetrics()
 * console.log(`Cache hit rate: ${getCacheHitRate()}%`)
 * ```
 * 
 * @category Services
 * @module fx
 */

/**
 * Preloads exchange rates on application startup.
 * 
 * @async
 * @returns Promise that resolves when rates are loaded
 * 
 * @remarks
 * - Attempts to load from disk cache first
 * - Fetches from API if cache is stale or missing
 * - Starts auto-refresh timer
 * 
 * @throws {Error} Only logs errors, never throws
 * 
 * @example
 * ```typescript
 * // In application startup
 * await preloadRates()
 * console.log("FX rates ready")
 * ```
 */
export async function preloadRates(): Promise<void> {
  // Implementation
}
```

### Handler Function

```typescript
/**
 * Processes NLP-parsed transaction data and creates transaction.
 * 
 * @async
 * @param bot - Telegram bot instance
 * @param chatId - Chat ID for responses
 * @param userId - User ID
 * @param text - Original text input
 * @param wizard - Wizard manager
 * 
 * @returns Promise that resolves when processing completes
 * 
 * @remarks
 * Steps:
 * 1. Parse text with NLP service
 * 2. Validate parsed data
 * 3. Get or create balance
 * 4. Create transaction
 * 5. Send confirmation to user
 * 
 * @throws {Error} Catches and logs all errors
 * 
 * @example
 * ```typescript
 * // Handle text input
 * await handleNLPInput(
 *   bot,
 *   msg.chat.id,
 *   msg.from.id.toString(),
 *   "Spent 50 dollars on groceries",
 *   wizard
 * )
 * ```
 * 
 * @see {@link nlpParser} for text parsing
 * @see {@link createTransaction} for transaction creation
 * 
 * @category Handlers
 * @internal
 */
async function handleNLPInput(
  bot: TelegramBot,
  chatId: number,
  userId: string,
  text: string,
  wizard: WizardManager
): Promise<void> {
  // Implementation
}
```

---

## Tags Reference

### Common Tags

| Tag | Description |
| ------------------ |
| `@param` | Function parameter |
| `@returns` | Return value |
| `@throws` | Error that might be thrown |
| `@example` | Usage example |
| `@remarks` | Additional notes |
| `@see` | Related items |
| `@category` | Group in documentation |
| `@internal` | Internal API (not public) |
| `@deprecated` | Deprecated feature |
| `@since` | Version when added |
| `@default` | Default value |
| `@readonly` | Read-only property |
| `@async` | Async function |

### Type Tags

| Tag | Description |
| ------------------ |
| `@type` | Variable type |
| `@typedef` | Type definition |
| `@interface` | Interface definition |
| `@enum` | Enum definition |
| `@template` | Generic type parameter |

### Validation Tags

| Tag | Description |
| ------------------ |
| `@minimum` | Minimum value |
| `@maximum` | Maximum value |
| `@minLength` | Minimum string length |
| `@maxLength` | Maximum string length |
| `@pattern` | Regex pattern |

---

## Best Practices

### Do's ✅

- Document all exported functions, classes, and types
- Provide examples for complex APIs
- Use `@remarks` for implementation details
- Link related items with `@see`
- Document all parameters and return values
- Keep descriptions concise but informative

### Don'ts ❌

- Don't document obvious code
- Don't repeat information from type signatures
- Don't write novels (keep it concise)
- Don't forget to update docs when changing code
- Don't use JSDoc for internal implementation details

---

## Generate Documentation

```bash
# Install dependencies
pnpm install

# Generate API documentation
pnpm run docs:generate

# Serve documentation locally
pnpm run docs:serve

# Clean generated docs
pnpm run docs:clean
```

Documentation will be generated in `docs/api/` directory.

---

## View Documentation

After generation:

```bash
# Option 1: Serve locally
pnpm run docs:serve
# Open http://localhost:3000

# Option 2: Open directly
open docs/api/index.html
```

---

## Further Reading

- [TypeDoc Documentation](https://typedoc.org/)
- [JSDoc Reference](https://jsdoc.app/)
- [TSDoc Specification](https://tsdoc.org/)

---

**Happy documenting!** 📚
