import { runBench } from "./common"

function fxConvert(amount: number, fromRate: number, toRate: number): number {
  return (amount / fromRate) * toRate
}

export async function benchmarkFx(): Promise<Awaited<ReturnType<typeof runBench>>> {
  return await runBench("FX conversion", 120000, () => {
    fxConvert(123.45, 1, 0.92)
    fxConvert(123.45, 0.92, 1)
    fxConvert(123.45, 1, 2.7)
    fxConvert(999.99, 1, 0.0089)
  })
}

if (require.main === module) {
  void benchmarkFx().then((stats) => {
    console.log(JSON.stringify(stats, null, 2))
  })
}
