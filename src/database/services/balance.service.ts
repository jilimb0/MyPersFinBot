import logger from "../../logger"
import { tgObservability } from "../../observability/tgwrapper-observability"
import {
  type Currency,
  InternalCategory,
  type TransactionType,
} from "../../types"
import { AppDataSource } from "../data-source"
import { Balance } from "../entities/Balance"
import { Transaction } from "../entities/Transaction"

/**
 * Balance Service with pessimistic locking for race condition protection
 * Prevents concurrent balance updates from corrupting data
 */
export class BalanceService {
  /**
   * Safely update balance with pessimistic write lock
   * Prevents race conditions when multiple transactions try to update the same balance
   */
  async safeUpdateBalance(
    userId: string,
    accountId: string,
    amountDelta: number,
    currency: Currency,
    transactionData?: Partial<Transaction>
  ): Promise<Balance> {
    return await tgObservability.instrumentDbOperation(
      "transaction",
      async () =>
        await AppDataSource.transaction(async (entityManager) => {
          // Acquire pessimistic write lock on the balance row
          const balance = await entityManager.findOne(Balance, {
            where: { userId, accountId, currency },
            lock: { mode: "pessimistic_write" },
          })

          if (!balance) {
            throw new Error(`Balance not found for account: ${accountId}`)
          }

          // Check for insufficient funds
          const newAmount = balance.amount + amountDelta
          if (newAmount < 0) {
            logger.warn("Insufficient funds", {
              userId,
              accountId,
              current: balance.amount,
              required: Math.abs(amountDelta),
            })
            throw new Error(
              `Insufficient funds. Current: ${balance.amount}, Required: ${Math.abs(amountDelta)}`
            )
          }

          // Update balance
          balance.amount = newAmount
          balance.lastUpdated = new Date()

          await entityManager.save(Balance, balance)

          // Create transaction record if data provided
          if (transactionData) {
            const transaction = entityManager.create(Transaction, {
              ...transactionData,
              userId,
              fromAccountId: amountDelta < 0 ? accountId : undefined,
              toAccountId: amountDelta > 0 ? accountId : undefined,
              date: transactionData.date || new Date(),
            })

            await entityManager.save(Transaction, transaction)
            logger.info("Transaction created", {
              userId,
              transactionId: transaction.id,
            })
          }

          return balance
        }),
      "balances"
    )
  }

  /**
   * Safely transfer between accounts with locking
   * Locks both accounts to prevent deadlocks (in sorted order)
   */
  async safeTransfer(
    userId: string,
    fromAccountId: string,
    toAccountId: string,
    amount: number,
    currency: Currency,
    description?: string
  ): Promise<{ fromBalance: Balance; toBalance: Balance }> {
    if (amount <= 0) {
      throw new Error("Transfer amount must be positive")
    }

    return await tgObservability.instrumentDbOperation(
      "transaction",
      async () =>
        await AppDataSource.transaction(async (entityManager) => {
          // Lock both balances in consistent order to prevent deadlocks
          const [accountA, accountB] = [fromAccountId, toAccountId].sort()

          const balanceA = await entityManager.findOne(Balance, {
            where: { userId, accountId: accountA, currency },
            lock: { mode: "pessimistic_write" },
          })

          const balanceB = await entityManager.findOne(Balance, {
            where: { userId, accountId: accountB, currency },
            lock: { mode: "pessimistic_write" },
          })

          if (!balanceA || !balanceB) {
            throw new Error("One or both accounts not found")
          }

          const fromBalance = accountA === fromAccountId ? balanceA : balanceB
          const toBalance = accountA === toAccountId ? balanceA : balanceB

          // Check sufficient funds
          if (fromBalance.amount < amount) {
            throw new Error(
              `Insufficient funds in ${fromAccountId}: ${fromBalance.amount} < ${amount}`
            )
          }

          // Perform transfer
          fromBalance.amount -= amount
          toBalance.amount += amount
          fromBalance.lastUpdated = new Date()
          toBalance.lastUpdated = new Date()

          await entityManager.save(Balance, [fromBalance, toBalance])

          // Create transfer transaction
          const transaction = entityManager.create(Transaction, {
            userId,
            type: "transfer" as TransactionType,
            amount,
            currency,
            category: InternalCategory.TRANSFER as any,
            description:
              description || `Transfer from ${fromAccountId} to ${toAccountId}`,
            fromAccountId,
            toAccountId,
            date: new Date(),
          })

          await entityManager.save(Transaction, transaction)

          logger.info("Transfer completed", {
            userId,
            from: fromAccountId,
            to: toAccountId,
            amount,
            currency,
          })

          return { fromBalance, toBalance }
        }),
      "balances"
    )
  }

  /**
   * Batch update balances atomically
   * Useful for processing multiple balance changes at once
   */
  async batchUpdateBalances(
    updates: Array<{
      userId: string
      accountId: string
      currency: Currency
      amountDelta: number
    }>
  ): Promise<Balance[]> {
    return await tgObservability.instrumentDbOperation(
      "transaction",
      async () =>
        await AppDataSource.transaction(async (entityManager) => {
          const results: Balance[] = []

          // Sort by accountId to prevent deadlocks
          const sortedUpdates = [...updates].sort((a, b) =>
            a.accountId.localeCompare(b.accountId)
          )

          for (const update of sortedUpdates) {
            const balance = await entityManager.findOne(Balance, {
              where: {
                userId: update.userId,
                accountId: update.accountId,
                currency: update.currency,
              },
              lock: { mode: "pessimistic_write" },
            })

            if (!balance) {
              throw new Error(`Balance not found: ${update.accountId}`)
            }

            const newAmount = balance.amount + update.amountDelta
            if (newAmount < 0) {
              throw new Error(`Insufficient funds in ${update.accountId}`)
            }

            balance.amount = newAmount
            balance.lastUpdated = new Date()

            await entityManager.save(Balance, balance)
            results.push(balance)
          }

          return results
        }),
      "balances"
    )
  }

  /**
   * Get balance with optional lock
   */
  async getBalance(
    userId: string,
    accountId: string,
    currency: Currency,
    lock: boolean = false
  ): Promise<Balance | null> {
    const options: any = {
      where: { userId, accountId, currency },
    }

    if (lock) {
      options.lock = { mode: "pessimistic_write" }
    }

    return await tgObservability.instrumentDbOperation(
      "findOne",
      async () => await AppDataSource.getRepository(Balance).findOne(options),
      "balances"
    )
  }
}

export const balanceService = new BalanceService()
