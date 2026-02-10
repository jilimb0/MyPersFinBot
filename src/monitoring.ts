import type { Logger, QueryRunner } from "typeorm"
import { config } from "./config"
import { logger as log } from "./logger"

export class QueryMonitor {
  private static instance: QueryMonitor
  private slowQueries: Map<
    string,
    { count: number; totalTime: number; maxTime: number }
  > = new Map()
  private queryLog: Array<{ query: string; time: number; timestamp: Date }> = []
  private readonly MAX_LOG_SIZE = 100
  private readonly SLOW_QUERY_THRESHOLD = 500 // ms

  private constructor() {}

  static getInstance(): QueryMonitor {
    if (!QueryMonitor.instance) {
      QueryMonitor.instance = new QueryMonitor()
    }
    return QueryMonitor.instance
  }

  logQuery(query: string, time: number) {
    // Логирование медленных запросов
    if (time > this.SLOW_QUERY_THRESHOLD) {
      log.warn(`⚠️ SLOW QUERY (${time}ms): ${this.truncateQuery(query)}`)

      const key = this.normalizeQuery(query)
      const existing = this.slowQueries.get(key)

      if (existing) {
        existing.count++
        existing.totalTime += time
        existing.maxTime = Math.max(existing.maxTime, time)
      } else {
        this.slowQueries.set(key, { count: 1, totalTime: time, maxTime: time })
      }

      // Добавляем в лог
      this.queryLog.push({ query: key, time, timestamp: new Date() })

      // Ограничиваем размер лога
      if (this.queryLog.length > this.MAX_LOG_SIZE) {
        this.queryLog.shift()
      }
    }
  }

  private normalizeQuery(query: string): string {
    // Убираем параметры для группировки
    return query
      .replace(/\$\d+/g, "?") // PostgreSQL params
      .replace(/'[^']*'/g, "?") // String literals
      .replace(/\d+/g, "?") // Numbers
      .replace(/\s+/g, " ") // Multiple spaces
      .trim()
      .substring(0, 200)
  }

  private truncateQuery(query: string, maxLength: number = 100): string {
    return query.length > maxLength
      ? `${query.substring(0, maxLength)}...`
      : query
  }

  getSlowQueries(limit: number = 10) {
    return Array.from(this.slowQueries.entries())
      .map(([query, stats]) => ({
        query,
        ...stats,
        avgTime: Math.round(stats.totalTime / stats.count),
      }))
      .sort((a, b) => b.totalTime - a.totalTime)
      .slice(0, limit)
  }

  getRecentSlowQueries(limit: number = 10) {
    return this.queryLog.slice(-limit).reverse()
  }

  getStats() {
    const totalSlowQueries = this.queryLog.length
    const uniqueSlowQueries = this.slowQueries.size

    let totalTime = 0
    let maxTime = 0

    this.slowQueries.forEach((stats) => {
      totalTime += stats.totalTime
      maxTime = Math.max(maxTime, stats.maxTime)
    })

    return {
      totalSlowQueries,
      uniqueSlowQueries,
      totalTime,
      maxTime,
      avgTime:
        totalSlowQueries > 0 ? Math.round(totalTime / totalSlowQueries) : 0,
    }
  }

  formatReport(): string {
    const stats = this.getStats()
    const topQueries = this.getSlowQueries(5)
    const recentQueries = this.getRecentSlowQueries(5)

    let report = "🔍 *Query Performance Report*\n\n"
    report += "📊 *Statistics:*\n"
    report += `• Total slow queries: ${stats.totalSlowQueries}\n`
    report += `• Unique slow queries: ${stats.uniqueSlowQueries}\n`
    report += `• Max query time: ${stats.maxTime}ms\n`
    report += `• Avg query time: ${stats.avgTime}ms\n\n`

    if (topQueries.length > 0) {
      report += "🐌 *Top 5 Slowest Queries:*\n"
      topQueries.forEach((q, i) => {
        report += `${i + 1}. ${this.truncateQuery(q.query, 60)}\n`
        report += `   Count: ${q.count} | Avg: ${q.avgTime}ms | Max: ${q.maxTime}ms\n`
      })
      report += "\n"
    }

    if (recentQueries.length > 0) {
      report += "🕒 *Recent Slow Queries:*\n"
      recentQueries.forEach((q, i) => {
        const timeAgo = this.formatTimeAgo(q.timestamp)
        report += `${i + 1}. ${q.time}ms - ${timeAgo}\n`
        report += `   ${this.truncateQuery(q.query, 60)}\n`
      })
    }

    return report
  }

  private formatTimeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000)

    if (seconds < 60) return `${seconds}s ago`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    return `${Math.floor(seconds / 86400)}d ago`
  }

  reset() {
    this.slowQueries.clear()
    this.queryLog = []
    log.info("✅ Query monitor statistics reset")
  }
}

// Custom TypeORM Logger
export class CustomQueryLogger implements Logger {
  private monitor = QueryMonitor.getInstance()

  logQuery(_query: string, _parameters?: any[], _queryRunner?: QueryRunner) {
    // Не логируем все запросы, только медленные
  }

  logQueryError(
    error: string | Error,
    query: string,
    parameters?: any[],
    _queryRunner?: QueryRunner
  ) {
    log.error(`❌ Query Error: ${error}`, { query, parameters })
  }

  logQuerySlow(
    time: number,
    query: string,
    _parameters?: any[],
    _queryRunner?: QueryRunner
  ) {
    this.monitor.logQuery(query, time)
  }

  logSchemaBuild(message: string, _queryRunner?: QueryRunner) {
    if (config.LOG_BOOT_DETAIL) {
      log.info(`🛠️ Schema: ${message}`)
    }
  }

  logMigration(message: string, _queryRunner?: QueryRunner) {
    if (config.LOG_BOOT_DETAIL) {
      log.info(`📦 Migration: ${message}`)
    }
  }

  log(
    level: "log" | "info" | "warn",
    message: any,
    _queryRunner?: QueryRunner
  ) {
    switch (level) {
      case "log":
      case "info":
        if (config.LOG_BOOT_DETAIL) {
          log.info(message)
        }
        break
      case "warn":
        log.warn(message)
        break
    }
  }
}

export const queryMonitor = QueryMonitor.getInstance()
