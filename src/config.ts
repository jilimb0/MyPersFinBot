import "dotenv/config"
import { z } from "zod"

const ConfigSchema = z.object({
  TELEGRAM_BOT_TOKEN: z
    .string()
    .min(20)
    .describe("Telegram bot token from @BotFather"),
  ASSEMBLYAI_API_KEY: z.string().optional(),
  FX_API_KEY: z.string().optional(),

  ALLOWED_USERS: z
    .string()
    .optional()
    .default("")
    .transform((val) => (val ? val.split(",").filter(Boolean) : []))
    .describe("Comma-separated Telegram user IDs"),
  BLOCKED_USERS: z
    .string()
    .optional()
    .default("")
    .transform((val) => (val ? val.split(",").filter(Boolean) : []))
    .describe("Comma-separated Telegram user IDs"),
  RATE_LIMIT_ENABLED: z
    .string()
    .optional()
    .default("false")
    .transform((val) => val === "true")
    .pipe(z.boolean()),
  RATE_LIMIT_MAX_MESSAGES: z.coerce.number().min(1).max(1000).default(30),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().min(1000).max(3600000).default(60000),
  LOG_UNAUTHORIZED_ACCESS: z
    .string()
    .optional()
    .default("true")
    .transform((val) => val === "true")
    .pipe(z.boolean()),
  DB_PATH: z.string().default("./data/database.db"),
  DB_WAL_ENABLED: z
    .string()
    .optional()
    .default("true")
    .transform((val) => val === "true")
    .pipe(z.boolean()),
  SCHEDULER_MINUTE: z.string().default("* * * * *"),
  RECURRING_CHECK_INTERVAL: z.coerce.number().min(1).max(60).default(1),

  VOICE_TRANSCRIPTION_TIMEOUT: z.coerce
    .number()
    .min(1000)
    .max(60000)
    .default(30000),
  VOICE_MAX_DURATION: z.coerce.number().min(1).max(300).default(60),

  ASSEMBLYAI_POLL_INTERVAL: z.coerce.number().min(100).max(5000).default(1000),
  FX_REFRESH_INTERVAL_HOURS: z.coerce.number().min(1).max(24).default(24),

  ANALYTICS_DAYS_DEFAULT: z.coerce.number().min(1).max(365).default(30),

  REMINDER_CHECK_INTERVAL: z.coerce.number().min(1).max(60).default(5),

  MAX_FILE_SIZE_MB: z.coerce.number().min(1).max(50).default(20),

  SENTRY_DSN: z.string().optional(),
  SENTRY_ENV: z.string().optional(),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0),
  SENTRY_RELEASE: z.string().optional(),

  HEALTH_HOST: z.string().default("0.0.0.0"),
  HEALTH_PORT: z.coerce.number().min(1).max(65535).default(3005),

  NODE_ENV: z.enum(["development", "production", "test"]).default("production"),
  LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),
  LOG_BOOT_DETAIL: z
    .string()
    .optional()
    .default("false")
    .transform((val) => val === "true")
    .pipe(z.boolean()),
  LOG_CACHE_VERBOSE: z
    .string()
    .optional()
    .default("false")
    .transform((val) => val === "true")
    .pipe(z.boolean()),
  LOG_SCHEDULER_TICK: z
    .string()
    .optional()
    .default("false")
    .transform((val) => val === "true")
    .pipe(z.boolean()),
})

export type AppConfig = z.infer<typeof ConfigSchema>

export const config = ConfigSchema.parse(process.env) as AppConfig

export function logConfig() {
  if (!config.LOG_BOOT_DETAIL) return
  console.log("\n⚙️  Configuration Loaded:")
  console.log(`  NODE_ENV: ${config.NODE_ENV}`)
  console.log(
    `  FX_REFRESH_INTERVAL_HOURS: ${config.FX_REFRESH_INTERVAL_HOURS}h`
  )
  console.log(
    `  VOICE_TRANSCRIPTION_TIMEOUT: ${config.VOICE_TRANSCRIPTION_TIMEOUT}ms`
  )
  console.log(`  RATE_LIMIT_ENABLED: ${config.RATE_LIMIT_ENABLED}`)
  console.log(`  LOG_LEVEL: ${config.LOG_LEVEL}`)
  console.log(`  LOG_BOOT_DETAIL: ${config.LOG_BOOT_DETAIL}`)
  console.log(`  LOG_CACHE_VERBOSE: ${config.LOG_CACHE_VERBOSE}`)

  if (config.ALLOWED_USERS.length > 0) {
    console.log(`  ALLOWED_USERS: ${config.ALLOWED_USERS.length} user(s)`)
  }
  if (config.BLOCKED_USERS.length > 0) {
    console.log(`  BLOCKED_USERS: ${config.BLOCKED_USERS.length} user(s)`)
  }

  console.log("")
}

export function validateConfig() {
  try {
    ConfigSchema.parse(process.env)
    return true
  } catch (error) {
    console.error("❌ Configuration validation failed:", error)
    process.exit(1)
  }
}

export function getConfigDump() {
  return {
    ...config,
    TELEGRAM_BOT_TOKEN: "[REDACTED]",
    ASSEMBLYAI_API_KEY: config.ASSEMBLYAI_API_KEY ? "[REDACTED]" : undefined,
    FX_API_KEY: config.FX_API_KEY ? "[REDACTED]" : undefined,
  }
}

export function isDevelopment() {
  return config.NODE_ENV === "development"
}

export function isProduction() {
  return config.NODE_ENV === "production"
}

export function getFxRefreshInterval() {
  return config.FX_REFRESH_INTERVAL_HOURS * 60 * 60 * 1000
}

export function getVoiceTimeout() {
  return config.VOICE_TRANSCRIPTION_TIMEOUT
}

export function getRateLimitMax() {
  return config.RATE_LIMIT_MAX_MESSAGES
}

export function getRateLimitWindow() {
  return config.RATE_LIMIT_WINDOW_MS
}

export function printConfigHelp() {
  const help = `
📋 Available Configuration Options:

${
  ConfigSchema.shape.TELEGRAM_BOT_TOKEN.description
    ? `TELEGRAM_BOT_TOKEN - ${ConfigSchema.shape.TELEGRAM_BOT_TOKEN.description}`
    : ""
}
${ConfigSchema.shape.ASSEMBLYAI_API_KEY.description ? `ASSEMBLYAI_API_KEY - ${ConfigSchema.shape.ASSEMBLYAI_API_KEY.description}` : ""}
${ConfigSchema.shape.FX_API_KEY.description ? `FX_API_KEY - ${ConfigSchema.shape.FX_API_KEY.description}` : ""}
${ConfigSchema.shape.ALLOWED_USERS.description ? `ALLOWED_USERS - ${ConfigSchema.shape.ALLOWED_USERS.description}` : ""}
${ConfigSchema.shape.BLOCKED_USERS.description ? `BLOCKED_USERS - ${ConfigSchema.shape.BLOCKED_USERS.description}` : ""}
RATE_LIMIT_ENABLED - ${config.RATE_LIMIT_ENABLED ? "true" : "false"} (default: false)
RATE_LIMIT_MAX_MESSAGES - ${config.RATE_LIMIT_MAX_MESSAGES} (default: 30)
RATE_LIMIT_WINDOW_MS - ${config.RATE_LIMIT_WINDOW_MS}ms (default: 60000)
LOG_UNAUTHORIZED_ACCESS - ${config.LOG_UNAUTHORIZED_ACCESS} (default: true)

Full list in .env.example
`

  console.log(help)
}

validateConfig()
