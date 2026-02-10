import { promises as fs } from "node:fs"
import path from "node:path"
import axios from "axios"
import undici from "undici"
import { config } from "./config"
import logger from "./logger"
import type { Currency } from "./types"

interface FXRates {
  [currency: string]: number
}

interface FXCache {
  rates: FXRates
  timestamp: number
  lastError?: number
  errorCount: number
}

interface FXMetrics {
  cacheHits: number
  cacheMisses: number
  apiCalls: number
  apiErrors: number
  lastUpdate: number
  retries: number
  http2Used: boolean
}

interface FXAPIResponse {
  data: {
    rates: Record<string, number>
  }
}

const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour
const API_URL = "https://open.er-api.com/v6/latest/USD" // ExchangeRate-API (free, no key required)
const MAX_RETRY_DELAY = 5 * 60 * 1000 // 5 minutes
const BASE_RETRY_DELAY = 30 * 1000 // 30 seconds
const MAX_RETRIES = 3 // Maximum retry attempts
const RETRY_DELAY_MS = 1000 // 1 second between retries

const FX_CACHE_PATH = path.resolve(__dirname, "../data/fx-cache.json")

let cache: FXCache | null = null
let metrics: FXMetrics = {
  cacheHits: 0,
  cacheMisses: 0,
  apiCalls: 0,
  apiErrors: 0,
  lastUpdate: 0,
  retries: 0,
  http2Used: !!undici,
}
let autoRefreshTimer: NodeJS.Timeout | null = null

const FALLBACK_RATES: FXRates = {
  USD: 1,
  EUR: 0.92,
  GEL: 2.7,
  RUB: 95.0,
  UAH: 41.0,
  PLN: 4.0,
}

async function persistRates(cache: FXCache): Promise<void> {
  try {
    const dataDir = path.dirname(FX_CACHE_PATH)

    // Создаем папку data если не существует
    await fs.mkdir(dataDir, { recursive: true })

    const data = JSON.stringify(
      {
        rates: cache.rates,
        timestamp: cache.timestamp,
        errorCount: cache.errorCount,
        version: "1.0", // Для будущей миграции
      },
      null,
      2
    )

    await fs.writeFile(FX_CACHE_PATH, data, "utf-8")
  } catch (error) {
    logger.error("❌ Failed to persist FX cache:", error)
    // Не пробрасываем ошибку - это не критично
  }
}

async function loadPersistedRates(): Promise<FXCache | null> {
  try {
    const data = await fs.readFile(FX_CACHE_PATH, "utf-8")
    const parsed = JSON.parse(data)

    // Проверяем TTL
    if (Date.now() - parsed.timestamp < CACHE_TTL_MS) {
      if (config.LOG_BOOT_DETAIL) {
        logger.info(
          `✅ Loaded persisted FX rates (age: ${Math.round((Date.now() - parsed.timestamp) / 1000)}s)`
        )
      }
      return {
        rates: parsed.rates,
        timestamp: parsed.timestamp,
        errorCount: parsed.errorCount || 0,
      }
    } else {
      if (config.LOG_BOOT_DETAIL) {
        logger.warn("⚠️ Persisted FX cache expired")
      }
      return null
    }
  } catch (error: unknown) {
    const err = error as { code?: string }
    if (err.code !== "ENOENT") {
      logger.error("❌ Failed to load persisted FX cache:", error)
    }
    return null
  }
}

function getRetryDelay(errorCount: number): number {
  const delay = Math.min(BASE_RETRY_DELAY * 2 ** errorCount, MAX_RETRY_DELAY)
  return delay
}

function shouldRetryAPI(): boolean {
  if (!cache) return true
  if (cache.errorCount === 0) return true

  const timeSinceError = Date.now() - (cache.lastError || 0)
  const retryDelay = getRetryDelay(cache.errorCount)

  return timeSinceError >= retryDelay
}

function isRetryableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false

  const err = error as { code?: string; response?: { status?: number } }

  // Timeout errors
  if (err.code === "ECONNABORTED" || err.code === "ETIMEDOUT") {
    return true
  }

  // Network errors
  if (
    err.code === "ECONNREFUSED" ||
    err.code === "ENOTFOUND" ||
    err.code === "ECONNRESET"
  ) {
    return true
  }

  // HTTP status codes that should be retried
  if (err.response?.status) {
    const status = err.response.status
    return status === 429 || status === 503 || status === 504 || status >= 500
  }

  return false
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchWithUndici(url: string): Promise<FXAPIResponse> {
  if (!undici) throw new Error("undici not available")

  const { request } = undici
  const { statusCode, body } = await request(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "User-Agent": "MyPersFinBot/1.0 (HTTP/2)",
    },
    bodyTimeout: 5000,
    headersTimeout: 5000,
  })

  if (statusCode !== 200) {
    throw new Error(`HTTP ${statusCode}`)
  }

  // Parse response body
  const chunks = []
  for await (const chunk of body) {
    chunks.push(chunk)
  }
  const data = JSON.parse(Buffer.concat(chunks).toString())

  return { data }
}

async function fetchWithAxios(url: string): Promise<FXAPIResponse> {
  return axios.get(url, {
    timeout: 5000,
    headers: {
      Accept: "application/json",
      "User-Agent": "MyPersFinBot/1.0",
    },
  })
}

async function fetchRates(): Promise<FXRates> {
  const useHTTP2 = !!undici

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    metrics.apiCalls++

    try {
      const url = API_URL // ExchangeRate-API returns all currencies

      // Try HTTP/2 first if available, otherwise use axios
      let response: FXAPIResponse
      if (useHTTP2) {
        response = await fetchWithUndici(url)
      } else {
        response = await fetchWithAxios(url)
      }

      if (response.data?.rates) {
        metrics.lastUpdate = Date.now()

        // Reset error count on success
        if (cache) {
          cache.errorCount = 0
        }

        if (attempt > 1 && config.LOG_BOOT_DETAIL) {
          logger.info(`✅ FX rates fetched successfully on attempt ${attempt}`)
        }

        // ExchangeRate-API возвращает ВСЕ валюты, фильтруем нужные
        const apiRates = response.data.rates
        const supportedCurrencies = ["USD", "EUR", "GEL", "RUB", "UAH", "PLN"]
        const filteredRates: FXRates = { USD: 1 } // Base currency

        supportedCurrencies.forEach((currency) => {
          if (apiRates[currency]) {
            filteredRates[currency] = apiRates[currency]
          } else if (FALLBACK_RATES[currency]) {
            // Если валюты нет в API - используем fallback
            filteredRates[currency] = FALLBACK_RATES[currency]
            if (config.LOG_BOOT_DETAIL) {
              logger.warn(
                `⚠️ Using fallback rate for ${currency}: ${FALLBACK_RATES[currency]}`
              )
            }
          }
        })

        return filteredRates
      }

      throw new Error("Invalid API response")
    } catch (error: unknown) {
      metrics.apiErrors++

      const err = error as { code?: string; message?: string }
      const isTimeout = err.code === "ECONNABORTED" || err.code === "ETIMEDOUT"
      const errorType = isTimeout ? "timeout" : err.code || "unknown"

      logger.error(
        `❌ FX API error (attempt ${attempt}/${MAX_RETRIES}): ${errorType}`,
        err.message || "Unknown error"
      )

      // Check if we should retry
      if (attempt < MAX_RETRIES && isRetryableError(error)) {
        metrics.retries++
        const delay = RETRY_DELAY_MS * attempt // Linear backoff
        if (config.LOG_BOOT_DETAIL) {
          logger.info(`⏳ Retrying in ${delay}ms...`)
        }
        await sleep(delay)
        continue
      }

      // No more retries or non-retryable error
      break
    }
  }

  // All retries failed
  logger.error(`❌ All ${MAX_RETRIES} attempts failed. Using fallback rates.`)

  // Update cache error tracking
  if (cache) {
    cache.errorCount++
    cache.lastError = Date.now()
  }

  // Return fallback rates
  return FALLBACK_RATES
}

export async function getRates(): Promise<FXRates> {
  const now = Date.now()

  // Check cache validity
  if (cache && now - cache.timestamp < CACHE_TTL_MS) {
    metrics.cacheHits++
    return cache.rates
  }

  metrics.cacheMisses++

  // Check if we should retry API (exponential backoff)
  if (!shouldRetryAPI()) {
    if (config.LOG_BOOT_DETAIL) {
      logger.info(
        `⏳ API retry delayed. Using fallback rates. Next retry in ${getRetryDelay(cache?.errorCount || 0) / 1000}s`
      )
    }
    return cache?.rates || FALLBACK_RATES
  }

  const rates = await fetchRates()
  cache = {
    rates,
    timestamp: now,
    errorCount: 0,
  }

  // ✨ NEW: Сохраняем в файл
  await persistRates(cache)

  // Start auto-refresh if not running
  if (!autoRefreshTimer) {
    startAutoRefresh()
  }

  return rates
}

export function getRatesSync(): FXRates {
  if (cache) {
    metrics.cacheHits++
    return cache.rates
  }
  // Fallback if no cache
  metrics.cacheMisses++
  return FALLBACK_RATES
}

export function convertSync(
  amount: number,
  from: Currency,
  to: Currency = "USD"
): number {
  if (from === to) return amount
  let rates = getRatesSync()

  if (!rates[from] || !rates[to]) {
    logger.error(`❌ Missing currency rate: from=${from}, to=${to}`)
    if (config.LOG_BOOT_DETAIL) {
      logger.warn("⚠️ Using fallback rates...")
    }

    rates = FALLBACK_RATES

    if (!rates[from] || !rates[to]) {
      logger.error(
        `❌ Currency not supported even in fallback: from=${from}, to=${to}`
      )
      return amount
    }
  }

  const usdAmount = from === "USD" ? amount : amount / rates[from]
  return to === "USD" ? usdAmount : usdAmount * rates[to]
}

export function convertBatchSync(
  amounts: Array<{
    amount: number
    from: Currency
    to: Currency
  }>
): number[] {
  const rates = getRatesSync()

  return amounts.map(({ amount, from, to }) => {
    if (from === to) return amount

    let currentRates = rates
    if (!currentRates[from] || !currentRates[to]) {
      logger.error(`❌ Missing currency rate in batch: from=${from}, to=${to}`)
      currentRates = FALLBACK_RATES

      if (!currentRates[from] || !currentRates[to]) {
        logger.error(`❌ Currency not supported: from=${from}, to=${to}`)
        return amount
      }
    }

    const usdAmount = from === "USD" ? amount : amount / currentRates[from]
    return to === "USD" ? usdAmount : usdAmount * currentRates[to]
  })
}

function startAutoRefresh() {
  if (autoRefreshTimer) return

  const refreshInterval = CACHE_TTL_MS - 5 * 60 * 1000

  autoRefreshTimer = setInterval(async () => {
    try {
      await getRates()
      if (config.LOG_BOOT_DETAIL) {
        logger.info("✅ FX rates refreshed")
      }
    } catch (error) {
      logger.error("❌ Failed to auto-refresh FX rates:", error)
    }
  }, refreshInterval)
}

export async function preloadRates(): Promise<void> {
  try {
    const persisted = await loadPersistedRates()

    if (persisted) {
      cache = persisted
      if (config.LOG_BOOT_DETAIL) {
        logger.info("✅ Using persisted FX rates (no API call needed)")
      }

      startAutoRefresh()
      return
    }

    await getRates()
    if (config.LOG_BOOT_DETAIL) {
      logger.info("✅ FX rates preloaded successfully")
    }
  } catch (error) {
    logger.error("❌ Failed to preload FX rates:", error)
  }
}

export function stopAutoRefresh() {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer)
    autoRefreshTimer = null
    if (config.LOG_BOOT_DETAIL) {
      logger.info("⏸️ FX auto-refresh stopped")
    }
  }
}

export function getMetrics(): FXMetrics {
  return { ...metrics }
}

export function resetMetrics() {
  metrics = {
    cacheHits: 0,
    cacheMisses: 0,
    apiCalls: 0,
    apiErrors: 0,
    lastUpdate: 0,
    retries: 0,
    http2Used: !!undici,
  }
}

export function getCacheHitRate(): number {
  const total = metrics.cacheHits + metrics.cacheMisses
  return total > 0 ? Math.round((metrics.cacheHits / total) * 100) : 0
}

export function getCacheStatus(): {
  hasCacheData: boolean
  cacheAge: number
  cacheValid: boolean
  errorCount: number
  nextUpdate: number
  isPersisted: boolean
} {
  if (!cache) {
    return {
      hasCacheData: false,
      cacheAge: 0,
      cacheValid: false,
      errorCount: 0,
      nextUpdate: 0,
      isPersisted: false,
    }
  }

  const age = Date.now() - cache.timestamp
  const valid = age < CACHE_TTL_MS
  const nextUpdate = valid ? CACHE_TTL_MS - age : 0

  return {
    hasCacheData: true,
    cacheAge: Math.round(age / 1000),
    cacheValid: valid,
    errorCount: cache.errorCount,
    nextUpdate: Math.round(nextUpdate / 1000),
    isPersisted: true, // ✨ NEW
  }
}

export async function clearPersistedCache(): Promise<void> {
  try {
    await fs.unlink(FX_CACHE_PATH)
    if (config.LOG_BOOT_DETAIL) {
      logger.info("✅ Persisted FX cache cleared")
    }
  } catch (error: unknown) {
    const err = error as { code?: string }
    if (err.code !== "ENOENT") {
      logger.error("❌ Failed to clear persisted cache:", error)
    }
  }
}
