/**
 * Foreign Exchange (FX) rates service using Frankfurter API
 * Base currency: USD
 *
 * ⚡ Features:
 * - 1 hour cache with auto-refresh
 * - Exponential backoff on API errors
 * - Batch conversion for arrays
 * - Metrics for monitoring
 * - Fallback rates on failure
 */

import axios from "axios"
import undici from "undici"
import { Currency } from "./types"

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

/**
 * Fallback rates (updated manually, Jan 2026)
 */
const FALLBACK_RATES: FXRates = {
  USD: 1,
  EUR: 0.92, // Euro
  GEL: 2.7, // Georgian Lari
  RUB: 95.0, // Russian Ruble
  UAH: 41.0, // Ukrainian Hryvnia
  PLN: 4.0, // Polish Zloty
}

/**
 * Calculate retry delay with exponential backoff
 */
function getRetryDelay(errorCount: number): number {
  const delay = Math.min(
    BASE_RETRY_DELAY * Math.pow(2, errorCount),
    MAX_RETRY_DELAY
  )
  return delay
}

/**
 * Check if we should retry API call based on error count and time
 */
function shouldRetryAPI(): boolean {
  if (!cache) return true
  if (cache.errorCount === 0) return true

  const timeSinceError = Date.now() - (cache.lastError || 0)
  const retryDelay = getRetryDelay(cache.errorCount)

  return timeSinceError >= retryDelay
}

/**
 * Check if error is retryable
 */
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

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Fetch using undici (HTTP/2) if available
 */
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

/**
 * Fetch using axios (HTTP/1.1) as fallback
 */
async function fetchWithAxios(url: string): Promise<FXAPIResponse> {
  return axios.get(url, {
    timeout: 5000,
    headers: {
      Accept: "application/json",
      "User-Agent": "MyPersFinBot/1.0",
    },
  })
}

/**
 * Fetch latest exchange rates from ExchangeRate-API with retry logic
 * Base: USD, Symbols: EUR, GEL, RUB, UAH, PLN
 * Uses HTTP/2 (undici) if available, falls back to HTTP/1.1 (axios)
 */
async function fetchRates(): Promise<FXRates> {
  const useHTTP2 = !!undici

  if (useHTTP2) {
    console.log("🚀 Using HTTP/2 for FX API")
  }

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

        if (attempt > 1) {
          console.log(`✅ FX rates fetched successfully on attempt ${attempt}`)
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
            console.log(
              `⚠️ Using fallback rate for ${currency}: ${FALLBACK_RATES[currency]}`
            )
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

      console.error(
        `❌ FX API error (attempt ${attempt}/${MAX_RETRIES}): ${errorType}`,
        err.message || "Unknown error"
      )

      // Check if we should retry
      if (attempt < MAX_RETRIES && isRetryableError(error)) {
        metrics.retries++
        const delay = RETRY_DELAY_MS * attempt // Linear backoff
        console.log(`⏳ Retrying in ${delay}ms...`)
        await sleep(delay)
        continue
      }

      // No more retries or non-retryable error
      break
    }
  }

  // All retries failed
  console.error(`❌ All ${MAX_RETRIES} attempts failed. Using fallback rates.`)

  // Update cache error tracking
  if (cache) {
    cache.errorCount++
    cache.lastError = Date.now()
  }

  // Return fallback rates
  return FALLBACK_RATES
}

/**
 * Get cached rates or fetch new ones
 */
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
    console.log(
      `⏳ API retry delayed. Using fallback rates. Next retry in ${
        getRetryDelay(cache?.errorCount || 0) / 1000
      }s`
    )
    return cache?.rates || FALLBACK_RATES
  }

  const rates = await fetchRates()
  cache = {
    rates,
    timestamp: now,
    errorCount: 0, // Reset on success
  }

  // Start auto-refresh if not running
  if (!autoRefreshTimer) {
    startAutoRefresh()
  }

  return rates
}

/**
 * Get rates synchronously (uses cache or fallback)
 */
export function getRatesSync(): FXRates {
  if (cache) {
    metrics.cacheHits++
    return cache.rates
  }
  // Fallback if no cache
  metrics.cacheMisses++
  return FALLBACK_RATES
}

/**
 * Convert amount from one currency to another
 * @param amount - Amount to convert
 * @param from - Source currency
 * @param to - Target currency (default: USD)
 * @returns Converted amount
 */
export async function convert(
  amount: number,
  from: Currency,
  to: Currency = "USD"
): Promise<number> {
  if (from === to) return amount

  const rates = await getRates()

  // Convert to USD first (since our base is USD)
  const usdAmount = from === "USD" ? amount : amount / rates[from]

  // Convert from USD to target
  return to === "USD" ? usdAmount : usdAmount * rates[to]
}

/**
 * Convert amount synchronously
 */
export function convertSync(
  amount: number,
  from: Currency,
  to: Currency = "USD"
): number {
  if (from === to) return amount
  let rates = getRatesSync()

  // 🔧 Валидация: проверяем что курсы существуют
  if (!rates[from] || !rates[to]) {
    console.error(`❌ Missing currency rate: from=${from}, to=${to}`)
    console.log(`⚠️ Using fallback rates...`)

    // Используем fallback
    rates = FALLBACK_RATES

    // Если и в fallback нет - возвращаем исходную сумму
    if (!rates[from] || !rates[to]) {
      console.error(
        `❌ Currency not supported even in fallback: from=${from}, to=${to}`
      )
      return amount
    }
  }

  // Convert to USD first
  const usdAmount = from === "USD" ? amount : amount / rates[from]
  // Convert from USD to target
  return to === "USD" ? usdAmount : usdAmount * rates[to]
}

/**
 * ⚡ Batch convert multiple amounts (optimized)
 */
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

    // 🔧 Валидация
    let currentRates = rates
    if (!currentRates[from] || !currentRates[to]) {
      console.error(`❌ Missing currency rate in batch: from=${from}, to=${to}`)
      currentRates = FALLBACK_RATES

      if (!currentRates[from] || !currentRates[to]) {
        console.error(`❌ Currency not supported: from=${from}, to=${to}`)
        return amount
      }
    }

    const usdAmount = from === "USD" ? amount : amount / currentRates[from]
    return to === "USD" ? usdAmount : usdAmount * currentRates[to]
  })
}

/**
 * ⚡ Batch convert multiple amounts async
 */
export async function convertBatch(
  amounts: Array<{
    amount: number
    from: Currency
    to: Currency
  }>
): Promise<number[]> {
  const rates = await getRates()

  return amounts.map(({ amount, from, to }) => {
    if (from === to) return amount
    const usdAmount = from === "USD" ? amount : amount / rates[from]
    return to === "USD" ? usdAmount : usdAmount * rates[to]
  })
}

/**
 * ⏰ Start auto-refresh timer (refreshes 5 min before expiry)
 */
function startAutoRefresh() {
  if (autoRefreshTimer) return

  const refreshInterval = CACHE_TTL_MS - 5 * 60 * 1000 // 5 min before expiry

  autoRefreshTimer = setInterval(async () => {
    try {
      console.log("🔄 Auto-refreshing FX rates...")
      await getRates()
      console.log("✅ FX rates refreshed")
    } catch (error) {
      console.error("❌ Failed to auto-refresh FX rates:", error)
    }
  }, refreshInterval)
}

/**
 * 📏 Get metrics for monitoring
 */
export function getMetrics(): FXMetrics {
  return { ...metrics }
}

/**
 * 🔄 Reset metrics
 */
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

/**
 * 📊 Get cache hit rate percentage
 */
export function getCacheHitRate(): number {
  const total = metrics.cacheHits + metrics.cacheMisses
  return total > 0 ? Math.round((metrics.cacheHits / total) * 100) : 0
}

/**
 * 🚀 Preload exchange rates (call at bot startup)
 */
export async function preloadRates(): Promise<void> {
  try {
    console.log("🔄 Preloading FX rates...")
    await getRates()
    console.log("✅ FX rates preloaded successfully")
  } catch (error) {
    console.error("❌ Failed to preload FX rates:", error)
  }
}

/**
 * 📊 Get cache status
 */
export function getCacheStatus(): {
  hasCacheData: boolean
  cacheAge: number
  cacheValid: boolean
  errorCount: number
  nextUpdate: number
} {
  if (!cache) {
    return {
      hasCacheData: false,
      cacheAge: 0,
      cacheValid: false,
      errorCount: 0,
      nextUpdate: 0,
    }
  }

  const age = Date.now() - cache.timestamp
  const valid = age < CACHE_TTL_MS
  const nextUpdate = valid ? CACHE_TTL_MS - age : 0

  return {
    hasCacheData: true,
    cacheAge: Math.round(age / 1000), // seconds
    cacheValid: valid,
    errorCount: cache.errorCount,
    nextUpdate: Math.round(nextUpdate / 1000), // seconds
  }
}

/**
 * 🛠️ Stop auto-refresh (call on shutdown)
 */
export function stopAutoRefresh() {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer)
    autoRefreshTimer = null
    console.log("⏸️ FX auto-refresh stopped")
  }
}
