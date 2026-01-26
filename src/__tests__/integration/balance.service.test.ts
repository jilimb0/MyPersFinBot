import { AppDataSource } from "../../database/data-source"
import { balanceService } from "../../database/services/balance.service"
import { Balance } from "../../database/entities/Balance"
import { Transaction } from "../../database/entities/Transaction"

/**
 * Integration tests for BalanceService
 * Tests pessimistic locking and race condition prevention
 */

describe.skip("BalanceService Integration Tests (requires User entity setup)", () => {
  beforeAll(async () => {
    // Initialize in-memory database for tests
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize()
    }
  })

  afterAll(async () => {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy()
    }
  })

  beforeEach(async () => {
    // Clear all data before each test
    await AppDataSource.getRepository(Transaction).clear()
    await AppDataSource.getRepository(Balance).clear()
  })

  describe("safeUpdateBalance", () => {
    test("should update balance atomically", async () => {
      // Create test balance
      const balance = AppDataSource.getRepository(Balance).create({
        userId: "test-user",
        accountId: "cash",
        amount: 1000,
        currency: "USD",
      })
      await AppDataSource.getRepository(Balance).save(balance)

      // Update balance
      const updated = await balanceService.safeUpdateBalance(
        "test-user",
        "cash",
        -100,
        "USD"
      )

      expect(updated.amount).toBe(900)
    })

    test("should throw error on insufficient funds", async () => {
      const balance = AppDataSource.getRepository(Balance).create({
        userId: "test-user",
        accountId: "cash",
        amount: 50,
        currency: "USD",
      })
      await AppDataSource.getRepository(Balance).save(balance)

      await expect(
        balanceService.safeUpdateBalance("test-user", "cash", -100, "USD")
      ).rejects.toThrow("Insufficient funds")
    })

    test("should create transaction record when provided", async () => {
      const balance = AppDataSource.getRepository(Balance).create({
        userId: "test-user",
        accountId: "cash",
        amount: 1000,
        currency: "USD",
      })
      await AppDataSource.getRepository(Balance).save(balance)

      await balanceService.safeUpdateBalance("test-user", "cash", -50, "USD", {
        type: "expense",
        amount: 50,
        currency: "USD",
        category: "Food & Dining",
        description: "Lunch",
      } as any)

      const transactions = await AppDataSource.getRepository(Transaction).find()
      expect(transactions).toHaveLength(1)
      expect(transactions?.[0]?.amount).toBe(50)
      expect(transactions?.[0]?.fromAccountId).toBe("cash")
    })
  })

  describe("safeTransfer", () => {
    test("should transfer between accounts atomically", async () => {
      // Create two balances
      const balance1 = AppDataSource.getRepository(Balance).create({
        userId: "test-user",
        accountId: "cash",
        amount: 1000,
        currency: "USD",
      })
      const balance2 = AppDataSource.getRepository(Balance).create({
        userId: "test-user",
        accountId: "card",
        amount: 500,
        currency: "USD",
      })
      await AppDataSource.getRepository(Balance).save([balance1, balance2])

      // Transfer
      const result = await balanceService.safeTransfer(
        "test-user",
        "cash",
        "card",
        200,
        "USD",
        "Test transfer"
      )

      expect(result.fromBalance.amount).toBe(800)
      expect(result.toBalance.amount).toBe(700)

      // Check transaction was created
      const transactions = await AppDataSource.getRepository(Transaction).find()
      expect(transactions).toHaveLength(1)
      expect(transactions?.[0]?.type).toBe("transfer")
      expect(transactions?.[0]?.fromAccountId).toBe("cash")
      expect(transactions?.[0]?.toAccountId).toBe("card")
    })

    test("should prevent deadlocks by locking in order", async () => {
      const balance1 = AppDataSource.getRepository(Balance).create({
        userId: "test-user",
        accountId: "account-a",
        amount: 1000,
        currency: "USD",
      })
      const balance2 = AppDataSource.getRepository(Balance).create({
        userId: "test-user",
        accountId: "account-b",
        amount: 1000,
        currency: "USD",
      })
      await AppDataSource.getRepository(Balance).save([balance1, balance2])

      // Concurrent transfers in opposite directions
      const transfer1 = balanceService.safeTransfer(
        "test-user",
        "account-a",
        "account-b",
        100,
        "USD"
      )

      const transfer2 = balanceService.safeTransfer(
        "test-user",
        "account-b",
        "account-a",
        50,
        "USD"
      )

      // Both should complete without deadlock
      await expect(Promise.all([transfer1, transfer2])).resolves.toBeDefined()
    })

    test("should throw error if insufficient funds", async () => {
      const balance1 = AppDataSource.getRepository(Balance).create({
        userId: "test-user",
        accountId: "cash",
        amount: 50,
        currency: "USD",
      })
      const balance2 = AppDataSource.getRepository(Balance).create({
        userId: "test-user",
        accountId: "card",
        amount: 500,
        currency: "USD",
      })
      await AppDataSource.getRepository(Balance).save([balance1, balance2])

      await expect(
        balanceService.safeTransfer("test-user", "cash", "card", 100, "USD")
      ).rejects.toThrow("Insufficient funds")
    })
  })

  describe("batchUpdateBalances", () => {
    test("should update multiple balances atomically", async () => {
      // Create balances
      const balances = [
        {
          userId: "test-user",
          accountId: "cash",
          amount: 1000,
          currency: "USD" as const,
        },
        {
          userId: "test-user",
          accountId: "card",
          amount: 500,
          currency: "USD" as const,
        },
        {
          userId: "test-user",
          accountId: "bank",
          amount: 2000,
          currency: "USD" as const,
        },
      ].map((b) => AppDataSource.getRepository(Balance).create(b))

      await AppDataSource.getRepository(Balance).save(balances)

      // Batch update
      const result = await balanceService.batchUpdateBalances([
        {
          userId: "test-user",
          accountId: "cash",
          currency: "USD",
          amountDelta: -100,
        },
        {
          userId: "test-user",
          accountId: "card",
          currency: "USD",
          amountDelta: 50,
        },
        {
          userId: "test-user",
          accountId: "bank",
          currency: "USD",
          amountDelta: -200,
        },
      ])

      expect(result).toHaveLength(3)
      expect(result?.[0]?.amount).toBe(2000 - 200) // bank (sorted first)
      expect(result?.[1]?.amount).toBe(500 + 50) // card
      expect(result?.[2]?.amount).toBe(1000 - 100) // cash
    })

    test("should rollback all changes if one fails", async () => {
      const balances = [
        {
          userId: "test-user",
          accountId: "cash",
          amount: 1000,
          currency: "USD" as const,
        },
        {
          userId: "test-user",
          accountId: "card",
          amount: 50,
          currency: "USD" as const,
        },
      ].map((b) => AppDataSource.getRepository(Balance).create(b))

      await AppDataSource.getRepository(Balance).save(balances)

      // Try batch update with insufficient funds in one
      await expect(
        balanceService.batchUpdateBalances([
          {
            userId: "test-user",
            accountId: "cash",
            currency: "USD",
            amountDelta: -100,
          },
          {
            userId: "test-user",
            accountId: "card",
            currency: "USD",
            amountDelta: -100,
          }, // Should fail
        ])
      ).rejects.toThrow("Insufficient funds")

      // Verify no changes were made
      const updatedBalances = await AppDataSource.getRepository(Balance).find()
      expect(updatedBalances?.[0]?.amount).toBe(1000) // Original amount
      expect(updatedBalances?.[1]?.amount).toBe(50) // Original amount
    })
  })

  describe("Race Condition Tests", () => {
    test("should handle concurrent updates without data corruption", async () => {
      const balance = AppDataSource.getRepository(Balance).create({
        userId: "test-user",
        accountId: "cash",
        amount: 1000,
        currency: "USD",
      })
      await AppDataSource.getRepository(Balance).save(balance)

      // Simulate 10 concurrent -10 updates
      const updates = Array(10)
        .fill(null)
        .map(() =>
          balanceService.safeUpdateBalance("test-user", "cash", -10, "USD")
        )

      await Promise.all(updates)

      // Final balance should be exactly 900
      const final = await AppDataSource.getRepository(Balance).findOne({
        where: { userId: "test-user", accountId: "cash" },
      })

      expect(final?.amount).toBe(900)
    })
  })
})
