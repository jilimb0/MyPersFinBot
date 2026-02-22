import { performance } from "node:perf_hooks"
import { config } from "../config"

type ObsModule = typeof import("@jilimb0/tgwrapper-observability")
type JsonObject = import("@jilimb0/tgwrapper-observability").JsonObject
type RuntimeLogger = import("@jilimb0/tgwrapper-observability").Logger
type ObservabilityConfig =
  import("@jilimb0/tgwrapper-observability").ObservabilityConfig
type MetricsRegistry =
  import("@jilimb0/tgwrapper-observability").MetricsRegistry
type Tracer = import("@jilimb0/tgwrapper-observability").Tracer

type CounterEntry = {
  metric: string
  tags?: Record<string, string>
}

type TimerEntry = CounterEntry & {
  values: number[]
}

const dynamicImport: (specifier: string) => Promise<unknown> = new Function(
  "s",
  "return import(s)"
) as (specifier: string) => Promise<unknown>

class TgWrapperObservability {
  private module?: ObsModule
  private modulePromise?: Promise<ObsModule>
  private metrics?: MetricsRegistry
  private tracer?: Tracer
  private logger?: RuntimeLogger
  private runtimeHooks?: ReturnType<
    ObsModule["createRuntimeObservabilityHooks"]
  >
  private diagnosticsConfig?: ObservabilityConfig
  private prometheusScrape?: () => string
  private stopProcessSampler?: () => void
  private readonly counters = new Map<string, CounterEntry>()
  private readonly timers = new Map<string, TimerEntry>()
  private initPromise?: Promise<void>

  private async loadModule(): Promise<ObsModule> {
    if (this.module) return this.module
    if (this.modulePromise) return await this.modulePromise

    this.modulePromise = (async () => {
      try {
        const mod = (await dynamicImport(
          "@jilimb0/tgwrapper-observability"
        )) as ObsModule
        this.module = mod
        return mod
      } catch {
        const mod = (await dynamicImport(
          "@jilimb0/tgwrapper-observability/dist/index.js"
        )) as ObsModule
        this.module = mod
        return mod
      }
    })()

    return await this.modulePromise
  }

  async init(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise
      return
    }

    this.initPromise = (async () => {
      const mod = await this.loadModule()
      const validated = mod.validateObservabilityConfig({
        enabled: true,
        serviceName: "my-pers-fin-bot",
        serviceVersion: process.env.npm_package_version || "0.0.0",
        env: config.NODE_ENV === "development" ? "dev" : config.NODE_ENV,
        sampleRate: 1,
        exporter: "console",
        flushIntervalMs: 10_000,
        queueSize: 2_000,
        featureFlags: {
          tracing: true,
          metrics: true,
          logs: true,
          export: false,
        },
        logLevel: config.LOG_LEVEL,
      })
      if (!validated.ok) {
        throw new Error(
          `Observability config invalid: ${validated.issues.join(", ")}`
        )
      }

      this.diagnosticsConfig = validated.value
      this.metrics = new mod.MetricsRegistry({
        sampleRate: validated.value.sampleRate,
        maxSeriesPerMetric: 1_000,
        maxSeriesUpdatesPerSecond: 10_000,
        truncateLabelValuesAt: 120,
        hashLabelKeys: ["user_id", "chat_id"],
      })
      this.tracer = new mod.Tracer()
      this.logger = new mod.ConfigurableLogger({
        level: validated.value.logLevel || "info",
        redact: (data) =>
          data ? (mod.redactSensitiveData(data) as JsonObject) : undefined,
        sink: (event) => {
          process.stdout.write(`${JSON.stringify(event)}\n`)
        },
      })
      this.runtimeHooks = mod.createRuntimeObservabilityHooks({
        metrics: this.metrics,
        logger: this.logger,
        serviceName: "my-pers-fin-bot",
      })
      this.prometheusScrape = mod.createPrometheusScrapeHandler(this.metrics)
      this.stopProcessSampler = mod.createProcessMetricsSampler(this.metrics, {
        intervalMs: 10_000,
      })
    })()

    await this.initPromise
  }

  shutdown(): void {
    this.stopProcessSampler?.()
    this.stopProcessSampler = undefined
  }

  private key(metric: string, tags?: Record<string, string>): string {
    const sortedTags = tags
      ? Object.entries(tags)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => `${k}=${v}`)
          .join(",")
      : ""
    return `${metric}|${sortedTags}`
  }

  increment(metric: string, value = 1, tags?: Record<string, string>): void {
    this.metrics?.increment(metric, value, tags)
    this.counters.set(this.key(metric, tags), { metric, tags })
  }

  observe(metric: string, value: number, tags?: Record<string, string>): void {
    this.metrics?.observe(metric, value, tags)
    const key = this.key(metric, tags)
    const current = this.timers.get(key)
    if (current) {
      current.values.push(value)
      return
    }
    this.timers.set(key, { metric, tags, values: [value] })
  }

  async trackAsync<T>(
    metric: string,
    fn: () => Promise<T>,
    tags?: Record<string, string>
  ): Promise<T> {
    if (!this.metrics) {
      const started = performance.now()
      try {
        return await fn()
      } finally {
        this.observe(metric, performance.now() - started, tags)
      }
    }
    const mod = await this.loadModule()
    return await mod.trackAsync(this.metrics, metric, fn, tags)
  }

  async instrumentTelegramCall<T>(
    method: string,
    fn: () => Promise<T>
  ): Promise<T> {
    if (!this.metrics || !this.tracer) return await fn()
    const mod = await this.loadModule()
    this.runtimeHooks?.onApiCall?.({ method })
    const started = performance.now()
    try {
      const result = await mod.instrumentTelegramCall(
        this.tracer,
        this.metrics,
        method,
        fn
      )
      this.runtimeHooks?.onApiResult?.({
        method,
        durationMs: performance.now() - started,
      })
      return result
    } catch (error) {
      this.runtimeHooks?.onApiError?.({ method, error })
      throw error
    }
  }

  async instrumentDbOperation<T>(
    operation: string,
    fn: () => Promise<T>,
    table?: string
  ): Promise<T> {
    if (!this.metrics || !this.tracer) return await fn()
    const mod = await this.loadModule()
    return await mod.instrumentDbOperation(
      this.tracer,
      this.metrics,
      operation,
      fn,
      table
    )
  }

  async instrumentQueueJob<T>(queue: string, fn: () => Promise<T>): Promise<T> {
    if (!this.metrics || !this.tracer) return await fn()
    const mod = await this.loadModule()
    return await mod.instrumentQueueJob(this.tracer, this.metrics, queue, fn)
  }

  async instrumentScheduledTask<T>(
    task: string,
    fn: () => Promise<T>
  ): Promise<T> {
    if (!this.metrics || !this.tracer) return await fn()
    const mod = await this.loadModule()
    return await mod.instrumentScheduledTask(
      this.tracer,
      this.metrics,
      task,
      fn
    )
  }

  onBotUpdate(updateType: string): void {
    if (!this.metrics) return
    this.runtimeHooks?.onBotUpdate?.({ updateType, tenantKey: "default" })
  }

  onRuntimeError(error: unknown): void {
    if (!this.metrics) return
    this.runtimeHooks?.onRuntimeError?.({ error })
  }

  logInfo(event: string, data?: JsonObject): void {
    this.logger?.log({
      level: "info",
      event,
      timestamp: new Date().toISOString(),
      data,
    })
  }

  logError(event: string, data?: JsonObject): void {
    this.logger?.log({
      level: "error",
      event,
      timestamp: new Date().toISOString(),
      data,
    })
  }

  getSnapshot(): {
    counters: Record<string, number>
    timers: Record<string, { p50: number; p95: number; samples: number }>
    timestamp: string
  } {
    const counters: Record<string, number> = {}
    const timers: Record<
      string,
      { p50: number; p95: number; samples: number }
    > = {}

    for (const [key, entry] of this.counters.entries()) {
      counters[key] = this.metrics?.getCounter(entry.metric, entry.tags) ?? 0
    }

    for (const [key, entry] of this.timers.entries()) {
      timers[key] = {
        p50: this.metrics?.latencyP50(entry.metric, entry.tags) ?? 0,
        p95: this.metrics?.latencyP95(entry.metric, entry.tags) ?? 0,
        samples: entry.values.length,
      }
    }

    return { counters, timers, timestamp: new Date().toISOString() }
  }

  getPrometheusMetrics(): string {
    return this.prometheusScrape?.() || ""
  }

  async getHealth() {
    if (!this.metrics) return null
    const mod = await this.loadModule()
    return mod.getObservabilityHealth(this.metrics)
  }

  async getDiagnostics(): Promise<JsonObject> {
    if (!this.metrics || !this.tracer || !this.diagnosticsConfig) {
      return {}
    }
    const mod = await this.loadModule()
    return mod.createDiagnosticsSnapshot({
      registry: this.metrics,
      tracer: this.tracer,
      config: this.diagnosticsConfig,
    })
  }
}

export const tgObservability = new TgWrapperObservability()
