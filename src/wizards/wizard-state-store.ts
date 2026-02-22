import logger from "../logger"
import type { WizardState } from "./wizards"

type PersistedWizardState = WizardState & { version: number }

type SessionStorage<TSession> = {
  get(key: string): Promise<TSession | null>
  set(key: string, value: TSession): Promise<void>
  delete(key: string): Promise<void>
}

export class WizardStateStore {
  private adapter?: SessionStorage<PersistedWizardState>
  private initPromise?: Promise<void>

  async init(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise
      return
    }

    this.initPromise = Promise.resolve().then(async () => {
      const redisUrl = process.env.REDIS_URL
      if (!redisUrl) {
        return
      }

      try {
        const dynamicImport: (specifier: string) => Promise<unknown> =
          new Function("s", "return import(s)") as (
            specifier: string
          ) => Promise<unknown>
        const load = async () => {
          try {
            return (await dynamicImport(
              "@jilimb0/tgwrapper-adapter-redis"
            )) as {
              RedisSessionAdapter: new (options: {
                redisUrl: string
                tenantId: string
                botId: string
                ttlSeconds: number
              }) => SessionStorage<PersistedWizardState>
            }
          } catch {
            return (await dynamicImport(
              "@jilimb0/tgwrapper-adapter-redis/dist/index.js"
            )) as {
              RedisSessionAdapter: new (options: {
                redisUrl: string
                tenantId: string
                botId: string
                ttlSeconds: number
              }) => SessionStorage<PersistedWizardState>
            }
          }
        }
        const mod = await load()
        this.adapter = new mod.RedisSessionAdapter({
          redisUrl,
          tenantId: process.env.TGWRAPPER_TENANT_ID || "my-pers-fin",
          botId: process.env.TGWRAPPER_BOT_ID || "telegram",
          ttlSeconds: Number(process.env.WIZARD_STATE_TTL_SECONDS) || 86400,
        })
      } catch (error) {
        logger.error("Failed to initialize RedisSessionAdapter", error)
      }
    })

    await this.initPromise
  }

  isEnabled(): boolean {
    return Boolean(this.adapter)
  }

  async get(userId: string): Promise<PersistedWizardState | null> {
    await this.init()
    if (!this.adapter) return null
    try {
      return await this.adapter.get(userId)
    } catch (error) {
      logger.error("Wizard state get failed", error, { userId })
      return null
    }
  }

  async set(userId: string, state: PersistedWizardState): Promise<void> {
    await this.init()
    if (!this.adapter) return
    try {
      await this.adapter.set(userId, state)
    } catch (error) {
      logger.error("Wizard state set failed", error, { userId })
    }
  }

  async delete(userId: string): Promise<void> {
    await this.init()
    if (!this.adapter) return
    try {
      await this.adapter.delete(userId)
    } catch (error) {
      logger.error("Wizard state delete failed", error, { userId })
    }
  }
}

export const wizardStateStore = new WizardStateStore()
