import { nlpParser } from "../../src/services/nlp-parser"
import { runBench } from "./common"

const samples = [
  "spent 12.5 coffee",
  "salary 2500",
  "витратив 200 на таксі",
  "получил 5000 зарплата",
  "bought groceries 87.4",
]

export async function benchmarkNlp(): Promise<Awaited<ReturnType<typeof runBench>>> {
  let idx = 0
  return await runBench("NLP parsing", 25000, () => {
    const text = samples[idx % samples.length] || samples[0] || ""
    idx++
    nlpParser.parse(text, "USD")
  })
}

if (require.main === module) {
  void benchmarkNlp().then((stats) => {
    console.log(JSON.stringify(stats, null, 2))
  })
}
