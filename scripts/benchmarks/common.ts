import { performance } from "node:perf_hooks"

export type BenchStats = {
  name: string
  iterations: number
  totalMs: number
  avgMs: number
  p50Ms: number
  p95Ms: number
  opsPerSec: number
  memDeltaMb: number
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * q)))
  return sorted[idx] || 0
}

export async function runBench(
  name: string,
  iterations: number,
  fn: () => void | Promise<void>
): Promise<BenchStats> {
  const samples: number[] = []
  const memBefore = process.memoryUsage().heapUsed
  const started = performance.now()

  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now()
    await fn()
    samples.push(performance.now() - t0)
  }

  const totalMs = performance.now() - started
  const sorted = [...samples].sort((a, b) => a - b)
  const memAfter = process.memoryUsage().heapUsed

  return {
    name,
    iterations,
    totalMs,
    avgMs: totalMs / iterations,
    p50Ms: quantile(sorted, 0.5),
    p95Ms: quantile(sorted, 0.95),
    opsPerSec: iterations / (totalMs / 1000),
    memDeltaMb: (memAfter - memBefore) / (1024 * 1024),
  }
}

export function printBench(stats: BenchStats): void {
  console.log(
    [
      `${stats.name}`,
      `iters=${stats.iterations}`,
      `total=${stats.totalMs.toFixed(2)}ms`,
      `avg=${stats.avgMs.toFixed(4)}ms`,
      `p50=${stats.p50Ms.toFixed(4)}ms`,
      `p95=${stats.p95Ms.toFixed(4)}ms`,
      `ops=${stats.opsPerSec.toFixed(1)}/s`,
      `memDelta=${stats.memDeltaMb.toFixed(2)}MB`,
    ].join(" | ")
  )
}
