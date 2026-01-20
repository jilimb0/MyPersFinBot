/**
 * Centralized Configuration System
 * 
 * Features:
 * - Environment variable validation
 * - Type-safe config access
 * - Default values
 * - Runtime config dump
 * - Config validation on startup
 */

import { z } from 'zod'

// ==========================================
// CONFIG SCHEMA (Zod validation)
// ==========================================

const ConfigSchema = z.object({
  // Telegram
  TELEGRAM_BOT_TOKEN: z.string().min(20).describe("Telegram bot token from @BotFather"),

  // External APIs
  ASSEMBLYAI_API_KEY: z.string().optional(),
  FX_API_KEY: z.string().optional(),

  // Security
  ALLOWED_USERS: z.string().transform((val) => val ? val.split(',') : []).describe("Comma-separated Telegram user IDs"),
  BLOCKED_USERS: z.string().transform((val) => val ? val.split(',') : []).describe("Comma-separated Telegram user IDs"),
  RATE_LIMIT_ENABLED: z.string().transform((val) => val === 'true').pipe(z.boolean()).default(false)
  ,
  RATE_LIMIT_MAX_MESSAGES: z.coerce.number().min(1).max(1000).default(30),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().min(1000).max(3600000).default(60000),
  LOG_UNAUTHORIZED_ACCESS: z.string().transform((val) => val === 'true').pipe(z.boolean()).default(true)
  ,

  // Database
  DB_PATH: z.string().default('./data/database.db'),
  DB_WAL_ENABLED: z.string().transform((val) => val === 'true').pipe(z.boolean()).default(true)
  ,

  // Scheduler (cron schedules)
  SCHEDULER_MINUTE: z.string().default('* * * * *'), // Every minute
  RECURRING_CHECK_INTERVAL: z.coerce.number().min(1).max(60).default(1), // Minutes

  // Voice processing
  VOICE_TRANSCRIPTION_TIMEOUT: z.coerce.number().min(1000).max(60000).default(30000),
  VOICE_MAX_DURATION: z.coerce.number().min(1).max(300).default(60), // Seconds

  // Rate limits & timeouts
  ASSEMBLYAI_POLL_INTERVAL: z.coerce.number().min(100).max(5000).default(1000),
  FX_REFRESH_INTERVAL_HOURS: z.coerce.number().min(1).max(24).default(24),

  // Analytics
  ANALYTICS_DAYS_DEFAULT: z.coerce.number().min(1).max(365).default(30),

  // Reminders
  REMINDER_CHECK_INTERVAL: z.coerce.number().min(1).max(60).default(5), // Minutes

  // File uploads
  MAX_FILE_SIZE_MB: z.coerce.number().min(1).max(50).default(20),

  // Development
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
})

// ==========================================
// CONFIG INTERFACE (TypeScript types)
// ==========================================
export type AppConfig = z.infer<typeof ConfigSchema>

// ==========================================
// CONFIG INSTANCE
// ==========================================
export const config = ConfigSchema.parse(process.env) as AppConfig

// ==========================================
// CONFIG UTILITIES
// ==========================================

/**
 * Log current configuration on startup (security filtered)
 */
export function logConfig() {
  console.log('\n⚙️  Configuration Loaded:')
  console.log(`  NODE_ENV: ${config.NODE_ENV}`)
  console.log(`  DB_PATH: ${config.DB_PATH}`)
  console.log(`  FX_REFRESH_INTERVAL_HOURS: ${config.FX_REFRESH_INTERVAL_HOURS}h`)
  console.log(`  VOICE_TRANSCRIPTION_TIMEOUT: ${config.VOICE_TRANSCRIPTION_TIMEOUT}ms`)
  console.log(`  LOG_LEVEL: ${config.LOG_LEVEL}`)

  if (config.ALLOWED_USERS.length > 0) {
    console.log(`  ALLOWED_USERS: ${config.ALLOWED_USERS.length} user(s)`)
  }

  console.log('')
}

/**
 * Validate config at runtime (useful for debugging)
 */
export function validateConfig() {
  try {
    ConfigSchema.parse(process.env)
    return true
  } catch (error) {
    console.error('❌ Configuration validation failed:', error)
    process.exit(1)
  }
}

/**
 * Get full config dump (for debugging)
 */
export function getConfigDump() {
  return {
    ...config,
    TELEGRAM_BOT_TOKEN: '[REDACTED]',
    ASSEMBLYAI_API_KEY: config.ASSEMBLYAI_API_KEY ? '[REDACTED]' : undefined,
    FX_API_KEY: config.FX_API_KEY ? '[REDACTED]' : undefined,
  }
}

// ==========================================
// CONFIG HELPERS (convenience functions)
// ==========================================

export function isDevelopment() {
  return config.NODE_ENV === 'development'
}

export function isProduction() {
  return config.NODE_ENV === 'production'
}

export function getFxRefreshInterval() {
  return config.FX_REFRESH_INTERVAL_HOURS * 60 * 60 * 1000 // ms
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

// ==========================================
// CONFIG DOCUMENTATION (generated)
// ==========================================

export function printConfigHelp() {
  const help = `
📋 Available Configuration Options:

${ConfigSchema.shape
      .TELEGRAM_BOT_TOKEN.description ? `TELEGRAM_BOT_TOKEN - ${ConfigSchema.shape.TELEGRAM_BOT_TOKEN.description}` : ''}
${ConfigSchema.shape.ASSEMBLYAI_API_KEY.description ? `ASSEMBLYAI_API_KEY - ${ConfigSchema.shape.ASSEMBLYAI_API_KEY.description}` : ''}
${ConfigSchema.shape.FX_API_KEY.description ? `FX_API_KEY - ${ConfigSchema.shape.FX_API_KEY.description}` : ''}
${ConfigSchema.shape.ALLOWED_USERS.description ? `ALLOWED_USERS - ${ConfigSchema.shape.ALLOWED_USERS.description}` : ''}
${ConfigSchema.shape.BLOCKED_USERS.description ? `BLOCKED_USERS - ${ConfigSchema.shape.BLOCKED_USERS.description}` : ''}
RATE_LIMIT_ENABLED - ${config.RATE_LIMIT_ENABLED ? 'true' : 'false'} (default: false)
RATE_LIMIT_MAX_MESSAGES - ${config.RATE_LIMIT_MAX_MESSAGES} (default: 30)
RATE_LIMIT_WINDOW_MS - ${config.RATE_LIMIT_WINDOW_MS}ms (default: 60000)
LOG_UNAUTHORIZED_ACCESS - ${config.LOG_UNAUTHORIZED_ACCESS} (default: true)

Full list in .env.example
`

  console.log(help)
}

// Auto-validate on import
validateConfig()
