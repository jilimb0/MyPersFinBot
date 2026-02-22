import { performance } from "node:perf_hooks"

interface TimerSample {
  count: number
  totalMs: number
  maxMs: number
}

class APMCollector {
  private counters = new Map<string, number>()
  private timers = new Map<string, TimerSample>()

  increment(metric: string, value: number = 1): void {
    this.counters.set(metric, (this.counters.get(metric) || 0) + value)
  }

  observe(metric: string, ms: number): void {
    const current = this.timers.get(metric) || {
      count: 0,
      totalMs: 0,
      maxMs: 0,
    }
    current.count += 1
    current.totalMs += ms
    current.maxMs = Math.max(current.maxMs, ms)
    this.timers.set(metric, current)
  }

  async trackAsync<T>(metric: string, fn: () => Promise<T>): Promise<T> {
    const started = performance.now()
    try {
      return await fn()
    } finally {
      this.observe(metric, performance.now() - started)
    }
  }

  getSnapshot() {
    const counters = Object.fromEntries(this.counters.entries())
    const timers = Object.fromEntries(
      Array.from(this.timers.entries()).map(([k, v]) => [
        k,
        {
          count: v.count,
          totalMs: Number(v.totalMs.toFixed(2)),
          avgMs: Number((v.totalMs / Math.max(1, v.count)).toFixed(2)),
          maxMs: Number(v.maxMs.toFixed(2)),
        },
      ])
    )

    return { counters, timers, timestamp: new Date().toISOString() }
  }
}

export const apmCollector = new APMCollector()
