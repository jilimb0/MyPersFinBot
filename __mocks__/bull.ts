type Handler = (...args: any[]) => void

class BullMock {
  name: string
  opts: any
  handlers: Record<string, Handler> = {}

  constructor(name: string, opts?: any) {
    this.name = name
    this.opts = opts
  }

  on(event: string, handler: Handler) {
    this.handlers[event] = handler
    return this
  }

  async add(data: any, options?: any) {
    return {
      id: options?.jobId || "job-1",
      data,
      attemptsMade: 0,
      processedOn: Date.now(),
    }
  }

  async getJob(_jobId: string) {
    return null
  }

  async removeRepeatable(_repeat: any) {
    return
  }

  async getWaitingCount() {
    return 0
  }
  async getActiveCount() {
    return 0
  }
  async getCompletedCount() {
    return 0
  }
  async getFailedCount() {
    return 0
  }
  async getDelayedCount() {
    return 0
  }

  async clean(_grace: number, _type: string) {
    return
  }

  async pause() {
    return
  }

  async resume() {
    return
  }

  async close() {
    return
  }

  process(_concurrency: number, _processor: any) {
    return
  }
}

export default BullMock as any
