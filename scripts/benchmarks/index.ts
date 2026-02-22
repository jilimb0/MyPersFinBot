import { benchmarkDb } from "./db"
import { benchmarkFx } from "./fx"
import { benchmarkNlp } from "./nlp"
import { printBench } from "./common"
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"

function getArgValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag)
  if (idx === -1) return undefined
  return process.argv[idx + 1]
}

async function main(): Promise<void> {
  const startedAt = new Date().toISOString()
  console.log(`[bench] started at ${startedAt}`)

  const fx = await benchmarkFx()
  printBench(fx)

  const db = await benchmarkDb()
  printBench(db)

  const nlp = await benchmarkNlp()
  printBench(nlp)

  const jsonPath = getArgValue("--json")
  if (jsonPath) {
    mkdirSync(dirname(jsonPath), { recursive: true })
    writeFileSync(
      jsonPath,
      JSON.stringify(
        {
          startedAt,
          finishedAt: new Date().toISOString(),
          results: [fx, db, nlp],
        },
        null,
        2
      )
    )
    console.log(`[bench] json report saved: ${jsonPath}`)
  }

  console.log("[bench] done")
}

void main()
