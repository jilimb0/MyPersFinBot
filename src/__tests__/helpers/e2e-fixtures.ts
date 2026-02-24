import { dbStorage } from "../../database/storage-db"

export function setupExpenseIncomeFixtures(balanceAmount = 100) {
  ;(
    dbStorage.getUserUiMode as jest.MockedFunction<typeof dbStorage.getUserUiMode>
  ).mockResolvedValue("basic")
  ;(
    dbStorage.getDefaultCurrency as jest.MockedFunction<
      typeof dbStorage.getDefaultCurrency
    >
  ).mockResolvedValue("USD")
  ;(
    dbStorage.getTopCategories as jest.MockedFunction<
      typeof dbStorage.getTopCategories
    >
  ).mockResolvedValue([])
  ;(
    dbStorage.getBalancesList as jest.MockedFunction<
      typeof dbStorage.getBalancesList
    >
  ).mockResolvedValue([
    {
      accountId: "Cash",
      amount: balanceAmount,
      currency: "USD",
      lastUpdated: "2026-01-01",
    },
  ])
  ;(
    dbStorage.getCurrencyDenominations as jest.MockedFunction<
      typeof dbStorage.getCurrencyDenominations
    >
  ).mockReturnValue([5, 10, 20])
}

export function setupAnalyticsFixtures() {
  ;(
    dbStorage.getUserData as jest.MockedFunction<typeof dbStorage.getUserData>
  ).mockResolvedValue({
    balances: [],
    transactions: [],
    debts: [],
    goals: [],
    budgets: [],
    incomeSources: [],
    templates: [],
    defaultCurrency: "USD",
  })

  ;(
    dbStorage.getTransactionsPaginated as jest.MockedFunction<
      typeof dbStorage.getTransactionsPaginated
    >
  ).mockResolvedValue({
    transactions: [],
    total: 0,
    hasMore: false,
  })
}
