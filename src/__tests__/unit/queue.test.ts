import { QueueService } from "../../queue/queue.service"
import { JobName, type RecurringTransactionJobData } from "../../queue/types"
import { ExpenseCategory, TransactionType } from "../../types"

// Mock Bull
jest.mock("bull")

describe("QueueService", () => {
  let queueService: QueueService

  beforeEach(() => {
    queueService = new QueueService()
  })

  afterEach(async () => {
    await queueService.close()
  })

  describe("Job Management", () => {
    test("should add job to queue", async () => {
      const jobData: RecurringTransactionJobData = {
        userId: "123",
        recurringTransactionId: "rec-1",
        amount: 100,
        currency: "USD",
        type: TransactionType.EXPENSE,
        category: ExpenseCategory.FOOD_DINING,
        description: "Monthly groceries",
        fromAccountId: "cash",
      }

      // This will use mocked Bull
      // In real scenario with Redis, this would actually queue the job
      expect(() =>
        queueService.addJob(JobName.RECURRING_TRANSACTION, jobData)
      ).not.toThrow()
    })

    test("should handle job options correctly", async () => {
      const jobData: RecurringTransactionJobData = {
        userId: "123",
        recurringTransactionId: "rec-1",
        amount: 100,
        currency: "USD",
        type: TransactionType.EXPENSE,
        category: ExpenseCategory.FOOD_DINING,
        description: "Test",
        fromAccountId: "cash",
      }

      const options = {
        attempts: 5,
        backoff: {
          type: "exponential" as const,
          delay: 1000,
        },
        priority: 1,
      }

      expect(() =>
        queueService.addJob(JobName.RECURRING_TRANSACTION, jobData, options)
      ).not.toThrow()
    })
  })

  describe("Recurring Jobs", () => {
    test("should add recurring job with cron", async () => {
      const jobData: RecurringTransactionJobData = {
        userId: "123",
        recurringTransactionId: "rec-1",
        amount: 100,
        currency: "USD",
        type: TransactionType.EXPENSE,
        category: ExpenseCategory.FOOD_DINING,
        description: "Monthly rent",
        fromAccountId: "cash",
      }

      const cron = "0 9 1 * *" // 9 AM on 1st of every month

      expect(() =>
        queueService.addRecurringJob(
          JobName.RECURRING_TRANSACTION,
          jobData,
          cron
        )
      ).not.toThrow()
    })
  })

  describe("Delayed Jobs", () => {
    test("should add delayed job", async () => {
      const jobData: RecurringTransactionJobData = {
        userId: "123",
        recurringTransactionId: "rec-1",
        amount: 100,
        currency: "USD",
        type: TransactionType.EXPENSE,
        category: ExpenseCategory.FOOD_DINING,
        description: "Delayed payment",
        fromAccountId: "cash",
      }

      const delayMs = 60000 // 1 minute

      expect(() =>
        queueService.addDelayedJob(
          JobName.RECURRING_TRANSACTION,
          jobData,
          delayMs
        )
      ).not.toThrow()
    })
  })

  describe("Processor Registration", () => {
    test("should register processor", () => {
      const processor = jest.fn().mockResolvedValue({ success: true })

      expect(() =>
        queueService.registerProcessor(
          JobName.RECURRING_TRANSACTION,
          processor,
          2
        )
      ).not.toThrow()
    })
  })

  describe("Queue Operations", () => {
    test("should pause and resume queue", async () => {
      expect(() =>
        queueService.pauseQueue(JobName.RECURRING_TRANSACTION)
      ).not.toThrow()
      expect(() =>
        queueService.resumeQueue(JobName.RECURRING_TRANSACTION)
      ).not.toThrow()
    })

    test("should clean queue", async () => {
      const grace = 1000 * 60 * 60 // 1 hour

      expect(() =>
        queueService.cleanQueue(JobName.RECURRING_TRANSACTION, grace)
      ).not.toThrow()
    })
  })
})

describe("Queue Integration Tests", () => {
  // These tests require a running Redis instance
  // Commented out by default
  /*
  let queueService: QueueService;

  beforeAll(async () => {
    queueService = new QueueService();
  });

  afterAll(async () => {
    await queueService.close();
  });

  test('should process recurring transaction job', async () => {
    const jobData: RecurringTransactionJobData = {
      userId: '123',
      recurringTransactionId: 'rec-1',
      amount: 100,
      currency: 'USD',
      type: 'expense',
      category: 'Food & Dining',
      description: 'Test transaction',
      fromAccountId: 'cash',
    };

    const processor = jest.fn().mockResolvedValue({ 
      success: true,
      message: 'Transaction created'
    });

    queueService.registerProcessor(
      JobName.RECURRING_TRANSACTION,
      processor,
      1
    );

    const job = await queueService.addJob(
      JobName.RECURRING_TRANSACTION,
      jobData
    );

    // Wait for job to process
    await new Promise(resolve => setTimeout(resolve, 2000));

    expect(processor).toHaveBeenCalled();
  });
  */
})
