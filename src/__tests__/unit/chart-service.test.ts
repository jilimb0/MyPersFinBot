import { dbStorage } from "../../database/storage-db"
import { generateChartImage } from "../../services/chart-service"
import { TransactionType } from "../../types"

jest.mock("../../database/storage-db", () => ({
  dbStorage: {
    getUserData: jest.fn(),
    getTransactions: jest.fn(),
  },
}))

const mockDb = dbStorage as jest.Mocked<typeof dbStorage>

function decodeChartConfig(url: string): any {
  const parsed = new URL(url)
  const encoded = parsed.searchParams.get("c")
  if (!encoded) throw new Error("Missing chart config query parameter")
  return JSON.parse(decodeURIComponent(encoded))
}

describe("chart-service", () => {
  beforeEach(() => {
    jest.resetAllMocks()
    mockDb.getUserData.mockResolvedValue({
      defaultCurrency: "USD",
    } as any)
  })

  test("returns null when there are no transactions", async () => {
    mockDb.getTransactions.mockResolvedValue([])
    const fetchMock = jest.fn()
    ;(globalThis as any).fetch = fetchMock

    const result = await generateChartImage("u1", "trends", "en", 6)

    expect(result).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test("builds trends chart and returns image buffer", async () => {
    mockDb.getTransactions.mockResolvedValue([
      {
        date: new Date("2026-01-05T10:00:00.000Z"),
        amount: 100,
        currency: "USD",
        type: TransactionType.INCOME,
        category: "SALARY",
      },
      {
        date: new Date("2026-01-06T10:00:00.000Z"),
        amount: 40,
        currency: "USD",
        type: TransactionType.EXPENSE,
        category: "FOOD_DINING",
      },
    ] as any[])

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    })
    ;(globalThis as any).fetch = fetchMock

    const result = await generateChartImage("u1", "trends", "en", 6)

    expect(result).toBeInstanceOf(Buffer)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const config = decodeChartConfig(fetchMock.mock.calls[0][0] as string)
    expect(config.type).toBe("line")
    expect(config.data.datasets).toHaveLength(2)
    expect(config.data.datasets[0].label).toContain("Income")
    expect(config.data.datasets[1].label).toContain("Expense")
  })

  test("builds categories chart for expense categories", async () => {
    mockDb.getTransactions.mockResolvedValue([
      {
        date: new Date("2026-01-05T10:00:00.000Z"),
        amount: 30,
        currency: "USD",
        type: TransactionType.EXPENSE,
        category: "FOOD_DINING",
      },
      {
        date: new Date("2026-01-10T10:00:00.000Z"),
        amount: 20,
        currency: "USD",
        type: TransactionType.EXPENSE,
        category: "TRANSPORT",
      },
    ] as any[])

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new Uint8Array([4, 5, 6]).buffer,
    })
    ;(globalThis as any).fetch = fetchMock

    await generateChartImage("u1", "categories", "en", 3)
    const config = decodeChartConfig(fetchMock.mock.calls[0][0] as string)

    expect(config.type).toBe("doughnut")
    expect(config.data.labels.length).toBeGreaterThan(0)
    expect(config.data.datasets[0].data).toEqual([30, 20])
  })

  test("builds balance history chart", async () => {
    mockDb.getTransactions.mockResolvedValue([
      {
        date: new Date("2026-01-01T10:00:00.000Z"),
        amount: 100,
        currency: "USD",
        type: TransactionType.INCOME,
        category: "SALARY",
      },
      {
        date: new Date("2026-01-02T10:00:00.000Z"),
        amount: 60,
        currency: "USD",
        type: TransactionType.EXPENSE,
        category: "FOOD_DINING",
      },
    ] as any[])

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new Uint8Array([7, 8, 9]).buffer,
    })
    ;(globalThis as any).fetch = fetchMock

    await generateChartImage("u1", "balance", "en", 6)
    const config = decodeChartConfig(fetchMock.mock.calls[0][0] as string)

    expect(config.type).toBe("line")
    expect(config.data.datasets[0].label).toContain("Balance")
    expect(config.data.datasets[0].data).toEqual([100, 40])
  })

  test("throws on quickchart non-200 response", async () => {
    mockDb.getTransactions.mockResolvedValue([
      {
        date: new Date("2026-01-05T10:00:00.000Z"),
        amount: 30,
        currency: "USD",
        type: TransactionType.EXPENSE,
        category: "FOOD_DINING",
      },
    ] as any[])

    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      arrayBuffer: async () => new ArrayBuffer(0),
    })
    ;(globalThis as any).fetch = fetchMock

    await expect(generateChartImage("u1", "trends", "en", 6)).rejects.toThrow(
      "Failed to generate chart: HTTP 503"
    )
  })
})
