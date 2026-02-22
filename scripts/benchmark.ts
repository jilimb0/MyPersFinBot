import { performance } from "node:perf_hooks"
import { nlpParser } from "../src/services/nlp-parser"

interface BenchResult {
  name: string
  iterations: number
  totalMs: number
  avgMs: number
}

interface Tx {
  userId: string
  date: string
  amount: number
  type: "EXPENSE" | "INCOME"
  category: string
  description: string
  fromAccountId: string
  toAccountId: string
}

function benchmark(
  name: string,
  iterations: number,
  fn: () => void
): BenchResult {
  const start = performance.now()
  for (let i = 0; i < iterations; i++) {
    fn()
  }
  const totalMs = performance.now() - start
  return { name, iterations, totalMs, avgMs: totalMs / iterations }
}

function fxConvert(amount: number, fromRate: number, toRate: number): number {
  return (amount / fromRate) * toRate
}

function buildDataset(size: number): Tx[] {
  const now = Date.now()
  const data: Tx[] = []

  for (let i = 0; i < size; i++) {
    data.push({
      userId: "bench-user",
      date: new Date(now - i * 60_000).toISOString(),
      amount: (i % 500) + 1,
      type: i % 2 === 0 ? "EXPENSE" : "INCOME",
      category: i % 3 === 0 ? "FOOD_DINING" : "SALARY",
      description: i % 5 === 0 ? "coffee and lunch" : "monthly payment",
      fromAccountId: "Card",
      toAccountId: "Cash",
    })
  }

  return data
}

function queryTransactions(data: Tx[]): Tx[] {
  return data
    .filter(
      (tx) =>
        tx.userId === "bench-user" &&
        tx.type === "EXPENSE" &&
        tx.amount >= 10 &&
        tx.amount <= 200 &&
        tx.description.includes("coffee")
    )
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 20)
}

function main(): void {
  const fx = benchmark("FX conversion", 100000, () => {
    fxConvert(123.45, 1, 0.92)
    fxConvert(123.45, 0.92, 1)
    fxConvert(123.45, 1, 2.7)
  })

  const nlp = benchmark("NLP parsing", 10000, () => {
    nlpParser.parse("spent 12.5 coffee", "USD")
    nlpParser.parse("salary 2500", "USD")
    nlpParser.parse("витратив 200 на таксі", "USD")
  })

  const dataset = buildDataset(20000)
  const dbLike = benchmark("DB-like filtering", 1000, () => {
    queryTransactions(dataset)
  })

  console.log(
    `${fx.name}: total=${fx.totalMs.toFixed(2)}ms avg=${fx.avgMs.toFixed(4)}ms (${fx.iterations} iterations)`
  )
  console.log(
    `${nlp.name}: total=${nlp.totalMs.toFixed(2)}ms avg=${nlp.avgMs.toFixed(4)}ms (${nlp.iterations} iterations)`
  )
  console.log(
    `${dbLike.name}: total=${dbLike.totalMs.toFixed(2)}ms avg=${dbLike.avgMs.toFixed(4)}ms (${dbLike.iterations} iterations)`
  )
}

main()
