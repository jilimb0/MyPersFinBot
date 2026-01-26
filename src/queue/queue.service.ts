import Bull, { Queue, Job, JobOptions } from "bull"
import logger from "../logger"
import { JobName, JobData, QueueJobOptions, JobResult } from "./types"

/**
 * Queue Service for background job processing
 * Uses Bull with Redis for distributed job queue
 */
export class QueueService {
  private queues: Map<JobName, Queue> = new Map()
  private redisConfig: Bull.QueueOptions

  constructor() {
    this.redisConfig = {
      redis: {
        host: process.env.REDIS_HOST || "127.0.0.1",
        port: Number(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD,
        db: Number(process.env.REDIS_QUEUE_DB) || 1, // Different DB for queues
        maxRetriesPerRequest: null, // Bull handles retries
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000, // Start with 2 seconds
        },
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 500, // Keep last 500 failed jobs for debugging
      },
    }
  }

  /**
   * Get or create queue for job type
   */
  private getQueue(jobName: JobName): Queue {
    if (!this.queues.has(jobName)) {
      const queue = new Bull(jobName, this.redisConfig)

      // Setup event listeners
      queue.on("error", (error) => {
        logger.error(`Queue ${jobName} error`, { error: error.message })
      })

      queue.on("completed", (job: Job, result: JobResult) => {
        logger.info(`Job ${jobName} completed`, {
          jobId: job?.id || "unknown",
          duration: Date.now() - job.processedOn!,
          result,
        })
      })

      queue.on("failed", (job: Job, error: Error) => {
        logger.error(`Job ${jobName} failed`, {
          jobId: job?.id || "unknown",
          attempts: job.attemptsMade,
          error: error.message,
          data: job.data,
        })
      })

      queue.on("stalled", (job: Job) => {
        logger.warn(`Job ${jobName} stalled`, {
          jobId: job?.id || "unknown",
          data: job.data,
        })
      })

      this.queues.set(jobName, queue)
      logger.info(`Queue ${jobName} initialized`)
    }

    return this.queues.get(jobName)!
  }

  /**
   * Add job to queue
   */
  async addJob(
    jobName: JobName,
    data: JobData,
    options?: QueueJobOptions
  ): Promise<Job> {
    const queue = this.getQueue(jobName)

    const jobOptions = {
      ...options,
      jobId: options?.repeat ? undefined : `${jobName}-${Date.now()}`, // No jobId for repeating jobs
    } as JobOptions

    const job = await queue.add(data, jobOptions)

    logger.info(`Job ${jobName} added`, {
      jobId: job?.id || "unknown",
      data,
      options,
    })

    return job
  }

  /**
   * Add recurring job (cron-like)
   */
  async addRecurringJob(
    jobName: JobName,
    data: JobData,
    cronExpression: string,
    options?: Omit<QueueJobOptions, "repeat">
  ): Promise<Job> {
    return this.addJob(jobName, data, {
      ...options,
      repeat: {
        cron: cronExpression,
      },
    })
  }

  /**
   * Add delayed job
   */
  async addDelayedJob(
    jobName: JobName,
    data: JobData,
    delayMs: number,
    options?: Omit<QueueJobOptions, "delay">
  ): Promise<Job> {
    return this.addJob(jobName, data, {
      ...options,
      delay: delayMs,
    })
  }

  /**
   * Remove job by ID
   */
  async removeJob(jobName: JobName, jobId: string): Promise<void> {
    const queue = this.getQueue(jobName)
    const job = await queue.getJob(jobId)

    if (job) {
      await job.remove()
      logger.info(`Job ${jobName} removed`, { jobId })
    }
  }

  /**
   * Remove repeating job
   */
  async removeRepeatingJob(
    jobName: JobName,
    repeat: { cron?: string; every?: number }
  ): Promise<void> {
    const queue = this.getQueue(jobName)
    await queue.removeRepeatable(repeat as any)
    logger.info(`Repeating job ${jobName} removed`, { repeat })
  }

  /**
   * Get job by ID
   */
  async getJob(jobName: JobName, jobId: string): Promise<Job | null> {
    const queue = this.getQueue(jobName)
    return await queue.getJob(jobId)
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(jobName: JobName) {
    const queue = this.getQueue(jobName)

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ])

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + completed + failed + delayed,
    }
  }

  /**
   * Get all queue statistics
   */
  async getAllStats() {
    const stats: Record<string, any> = {}

    for (const [jobName, _queue] of this.queues) {
      stats[jobName] = await this.getQueueStats(jobName)
    }

    return stats
  }

  /**
   * Clean old jobs
   */
  async cleanQueue(
    jobName: JobName,
    grace: number = 1000 * 60 * 60 * 24 // 1 day
  ): Promise<void> {
    const queue = this.getQueue(jobName)

    await Promise.all([
      queue.clean(grace, "completed"),
      queue.clean(grace, "failed"),
    ])

    logger.info(`Queue ${jobName} cleaned`, { grace })
  }

  /**
   * Pause queue
   */
  async pauseQueue(jobName: JobName): Promise<void> {
    const queue = this.getQueue(jobName)
    await queue.pause()
    logger.info(`Queue ${jobName} paused`)
  }

  /**
   * Resume queue
   */
  async resumeQueue(jobName: JobName): Promise<void> {
    const queue = this.getQueue(jobName)
    await queue.resume()
    logger.info(`Queue ${jobName} resumed`)
  }

  /**
   * Close all queues
   */
  async close(): Promise<void> {
    for (const [jobName, queue] of this.queues) {
      await queue.close()
      logger.info(`Queue ${jobName} closed`)
    }

    this.queues.clear()
  }

  /**
   * Register processor for job type
   */
  registerProcessor(
    jobName: JobName,
    processor: (job: Job<any>) => Promise<JobResult>,
    concurrency: number = 1
  ): void {
    const queue = this.getQueue(jobName)

    queue.process(concurrency, async (job: Job<any>) => {
      logger.info(`Processing job ${jobName}`, {
        jobId: job?.id || "unknown",
        attempt: job.attemptsMade + 1,
        data: job.data,
      })

      try {
        const result = await processor(job)
        return result
      } catch (error: any) {
        logger.error(`Job ${jobName} processor error`, {
          jobId: job?.id || "unknown",
          error: error.message,
          stack: error.stack,
        })
        throw error // Re-throw for Bull to handle retries
      }
    })

    logger.info(`Processor registered for ${jobName}`, { concurrency })
  }
}

// Singleton instance
let queueServiceInstance: QueueService | null = null

/**
 * Get queue service instance
 */
export function getQueueService(): QueueService {
  if (!queueServiceInstance) {
    queueServiceInstance = new QueueService()
  }
  return queueServiceInstance
}

/**
 * Close queue service
 */
export async function closeQueueService(): Promise<void> {
  if (queueServiceInstance) {
    await queueServiceInstance.close()
    queueServiceInstance = null
  }
}
