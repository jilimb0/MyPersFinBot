import { randomUUID } from "node:crypto"
import fs from "node:fs"
import http from "node:http"
import https from "node:https"
import path from "node:path"
import { config as appConfig, config } from "./config"
import { dbStorage } from "./database/storage-db"
import logger from "./logger"
import { tgObservability } from "./observability/tgwrapper-observability"

let server: http.Server | https.Server | null = null
const ADMIN_LOGIN_TTL_MS = 5 * 60 * 1000
const ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000
const ADMIN_AUDIT_RETENTION_MS =
  config.ADMIN_AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000
const ADMIN_AUDIT_PRUNE_INTERVAL_MS =
  config.ADMIN_AUDIT_PRUNE_INTERVAL_HOURS * 60 * 60 * 1000
const adminLoginChallenges = new Map<
  string,
  { userId: string; code: string; expiresAt: number; messageId?: number }
>()
const adminSessions = new Map<
  string,
  { userId: string; actor: string; expiresAt: number }
>()
let adminAuditPruneTimer: NodeJS.Timeout | null = null

function sanitizeAdminPayload(
  payload: Record<string, unknown>
): Record<string, unknown> {
  return {
    userId: payload.userId ?? null,
    tier: payload.tier ?? null,
    days: payload.days ?? null,
    premiumDays: payload.premiumDays ?? null,
    provider: payload.provider ?? null,
  }
}

function auditAdminAction(
  req: http.IncomingMessage,
  action: string,
  payload: Record<string, unknown>,
  ok: boolean,
  error?: string
): void {
  const entry = {
    ts: new Date().toISOString(),
    action,
    ok,
    error: error ?? null,
    actor: getAdminActor(req),
    ip: req.socket.remoteAddress ?? null,
    userAgent: req.headers["user-agent"] ?? null,
    payload: sanitizeAdminPayload(payload),
  }

  logger.info("admin.action", entry)

  try {
    const dir = path.resolve(__dirname, "../logs")
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.appendFileSync(
      path.resolve(dir, "admin-actions.jsonl"),
      `${JSON.stringify(entry)}\n`,
      "utf8"
    )
  } catch (err) {
    logger.warn("admin.action.audit_write_failed", { err })
  }
}

function pruneAdminAuditLog(retentionMs = ADMIN_AUDIT_RETENTION_MS): void {
  try {
    const filePath = path.resolve(__dirname, "../logs/admin-actions.jsonl")
    if (!fs.existsSync(filePath)) return
    const raw = fs.readFileSync(filePath, "utf8")
    if (!raw.trim()) return
    const cutoff = Date.now() - retentionMs
    const kept: string[] = []
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue
      try {
        const parsed = JSON.parse(line) as { ts?: string }
        const ts = parsed.ts ? new Date(parsed.ts).getTime() : NaN
        if (!Number.isFinite(ts) || ts >= cutoff) {
          kept.push(line)
        }
      } catch {
        // Keep malformed lines to avoid data loss from parse edge-cases.
        kept.push(line)
      }
    }
    fs.writeFileSync(
      filePath,
      `${kept.join("\n")}${kept.length ? "\n" : ""}`,
      "utf8"
    )
  } catch (err) {
    logger.warn("admin.action.audit_prune_failed", { err })
  }
}

function readAdminActions(limit = 50): Array<Record<string, unknown>> {
  try {
    const filePath = path.resolve(__dirname, "../logs/admin-actions.jsonl")
    if (!fs.existsSync(filePath)) return []
    const raw = fs.readFileSync(filePath, "utf8").trim()
    if (!raw) return []
    const lines = raw.split("\n")
    const out: Array<Record<string, unknown>> = []
    for (let i = lines.length - 1; i >= 0 && out.length < limit; i -= 1) {
      const line = lines[i]
      if (!line) continue
      try {
        out.push(JSON.parse(line) as Record<string, unknown>)
      } catch {
        // skip malformed line
      }
    }
    return out
  } catch {
    return []
  }
}

function unauthorized(res: http.ServerResponse): void {
  res.writeHead(401, {
    "Content-Type": "text/plain",
    "WWW-Authenticate": 'Basic realm="health"',
  })
  res.end("Unauthorized")
}

function isAuthEnabled(): boolean {
  return !!(config.HEALTH_BASIC_AUTH_USER && config.HEALTH_BASIC_AUTH_PASS)
}

function checkBasicAuth(req: http.IncomingMessage): boolean {
  if (!isAuthEnabled()) return true

  const header = req.headers.authorization
  if (!header || !header.startsWith("Basic ")) return false

  const base64 = header.slice("Basic ".length)
  const decoded = Buffer.from(base64, "base64").toString("utf8")
  const [user, pass] = decoded.split(":")

  return (
    user === config.HEALTH_BASIC_AUTH_USER &&
    pass === config.HEALTH_BASIC_AUTH_PASS
  )
}

function parseCookies(req: http.IncomingMessage): Record<string, string> {
  const cookie = req.headers.cookie
  if (!cookie) return {}
  const out: Record<string, string> = {}
  for (const part of cookie.split(";")) {
    const [rawKey, ...rawValue] = part.trim().split("=")
    if (!rawKey) continue
    out[rawKey] = decodeURIComponent(rawValue.join("=") || "")
  }
  return out
}

function pruneAdminAuthState(): void {
  const now = Date.now()
  for (const [id, challenge] of adminLoginChallenges.entries()) {
    if (challenge.expiresAt <= now) adminLoginChallenges.delete(id)
  }
  for (const [id, session] of adminSessions.entries()) {
    if (session.expiresAt <= now) adminSessions.delete(id)
  }
}

function getAdminSession(
  req: http.IncomingMessage
): { userId: string; actor: string; expiresAt: number } | null {
  pruneAdminAuthState()
  const cookies = parseCookies(req)
  const sessionId = cookies.admin_session
  if (!sessionId) return null
  const session = adminSessions.get(sessionId)
  if (!session) return null
  if (session.expiresAt <= Date.now()) {
    adminSessions.delete(sessionId)
    return null
  }
  return session
}

function getAdminActor(req: http.IncomingMessage): string {
  const session = getAdminSession(req)
  if (!session) return "unknown"
  return session.actor
}

function isAllowedAdminUser(userId: string): boolean {
  // If allow-list is empty, fallback to open login flow via Telegram code.
  // In production, set ALLOWED_USERS to explicit admin IDs.
  if (config.ALLOWED_USERS.length === 0) return true
  return config.ALLOWED_USERS.includes(userId)
}

function checkAdminSession(req: http.IncomingMessage): boolean {
  return !!getAdminSession(req)
}

function checkAdminAccess(req: http.IncomingMessage): boolean {
  return checkAdminSession(req)
}

async function sendTelegramAdminCode(
  userId: string,
  code: string
): Promise<number | undefined> {
  const response = await fetch(
    `https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: userId,
        text:
          `Admin login code: ${code}\n` +
          "Code expires in 5 minutes.\n" +
          "If this wasn't you, ignore this message.",
      }),
    }
  )
  if (!response.ok) {
    throw new Error(`Failed to send code (${response.status})`)
  }
  const body = (await response.json()) as { ok?: boolean; description?: string }
  if (!body.ok) {
    throw new Error(body.description || "Failed to send code")
  }
  const messageId = (body as { result?: { message_id?: number } }).result
    ?.message_id
  return typeof messageId === "number" ? messageId : undefined
}

async function resolveTelegramActorLabel(userId: string): Promise<string> {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}/getChat`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: userId }),
      }
    )
    if (!response.ok) return `tg:${userId}`
    const body = (await response.json()) as {
      ok?: boolean
      result?: { username?: string; first_name?: string; last_name?: string }
    }
    if (!body.ok || !body.result) return `tg:${userId}`
    const username = body.result.username?.trim()
    if (username) return `@${username} (${userId})`
    const name =
      `${body.result.first_name || ""} ${body.result.last_name || ""}`.trim()
    if (name) return `${name} (${userId})`
    return `tg:${userId}`
  } catch {
    return `tg:${userId}`
  }
}

async function deleteTelegramMessage(
  userId: string,
  messageId?: number
): Promise<void> {
  if (!messageId) return
  const response = await fetch(
    `https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}/deleteMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: userId,
        message_id: messageId,
      }),
    }
  )
  if (!response.ok) return
}

async function readJsonBody(
  req: http.IncomingMessage
): Promise<Record<string, unknown>> {
  const bodyChunks: Buffer[] = []
  for await (const chunk of req) {
    bodyChunks.push(Buffer.from(chunk))
  }
  const raw = Buffer.concat(bodyChunks).toString("utf8").trim()
  if (!raw) return {}
  return JSON.parse(raw) as Record<string, unknown>
}

function checkMobileSyncAuth(req: http.IncomingMessage): boolean {
  const token = process.env.MOBILE_SYNC_TOKEN
  if (!token) return true
  const auth = req.headers.authorization || ""
  if (!auth.startsWith("Bearer ")) return false
  return auth.slice("Bearer ".length).trim() === token
}

async function requestHandler(
  req: http.IncomingMessage,
  res: http.ServerResponse
): Promise<void> {
  if (!checkBasicAuth(req)) {
    unauthorized(res)
    return
  }

  const rawUrl = req.url || "/"
  const parsedUrl = new URL(rawUrl, "http://localhost")
  const url = parsedUrl.pathname

  if (url === "/health" || url === "/healthz" || url === "/readyz") {
    const payload = JSON.stringify({
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    })

    res.writeHead(200, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    })
    res.end(payload)
    return
  }

  if (url === "/metrics") {
    const snapshot = tgObservability.getSnapshot()
    const diagnostics = await tgObservability.getDiagnostics()
    const health = await tgObservability.getHealth()
    const payload = JSON.stringify({
      apm: snapshot,
      tgwrapper: snapshot,
      diagnostics,
      health,
    })
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    })
    res.end(payload)
    return
  }

  if (url === "/metrics/prometheus") {
    const payload = tgObservability.getPrometheusMetrics()
    res.writeHead(200, {
      "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
      "Cache-Control": "no-store",
    })
    res.end(payload)
    return
  }

  if (url.startsWith("/mobile/sync/")) {
    if (!checkMobileSyncAuth(req)) {
      res.writeHead(401, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Unauthorized mobile sync access" }))
      return
    }

    if (url === "/mobile/sync/state" && req.method === "GET") {
      const userId = String(parsedUrl.searchParams.get("userId") || "").trim()
      if (!userId) {
        res.writeHead(400, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ error: "userId is required" }))
        return
      }

      const userData = await dbStorage.getUserData(userId)
      const reminders = await dbStorage.getAllReminders(userId)
      const recurring = await dbStorage.getAllRecurringTransactions(userId)
      const subscription = await dbStorage.getSubscriptionStatus(userId)
      const language = await dbStorage.getUserLanguage(userId)

      const payload = JSON.stringify({
        user: {
          id: userId,
          language,
          defaultCurrency: userData.defaultCurrency,
          subscriptionTier: subscription.tier,
          trialUsed: subscription.trialUsed,
          trialExpiresAt: subscription.trialExpiresAt
            ? subscription.trialExpiresAt.toISOString()
            : undefined,
          premiumExpiresAt: subscription.premiumExpiresAt
            ? subscription.premiumExpiresAt.toISOString()
            : undefined,
          transactionsThisMonth: 0,
          transactionsMonthKey: new Date().toISOString().slice(0, 7),
          voiceInputsToday: 0,
          voiceDayKey: new Date().toISOString().slice(0, 10),
        },
        accounts: userData.balances.map((b) => ({
          id: b.accountId,
          name: b.accountId,
          amount: b.amount,
          currency: b.currency,
        })),
        transactions: userData.transactions,
        budgets: userData.budgets,
        goals: userData.goals,
        debts: userData.debts,
        reminders: reminders.map((r) => ({
          id: r.id,
          title: r.message,
          date: r.reminderDate,
          relatedEntityType: r.type,
          relatedEntityId: r.entityId,
          isDone: r.isProcessed,
        })),
        recurring: recurring.map((r) => ({
          id: r.id,
          type: r.type,
          amount: r.amount,
          currency: r.currency,
          category: r.category,
          accountId: r.accountId,
          frequency: r.frequency,
          nextExecutionDate: r.nextExecutionDate,
          isActive: r.isActive,
          description: r.description,
        })),
        templates: (userData.templates || []).map((t) => ({
          id: t.id,
          title: t.name,
          type: t.type,
          amount: t.amount,
          category: t.category,
          currency: t.currency,
          accountId: t.accountId || "Main",
        })),
      })
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      })
      res.end(payload)
      return
    }

    if (req.method === "POST") {
      const parsed = await readJsonBody(req)
      const userId = String(parsed.userId || "").trim()
      if (!userId) {
        res.writeHead(400, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ error: "userId is required" }))
        return
      }

      if (url === "/mobile/sync/transaction") {
        await dbStorage.addTransaction(userId, {
          id: String(parsed.id || randomUUID()),
          date: parsed.date ? new Date(String(parsed.date)) : new Date(),
          type: String(parsed.type || "EXPENSE") as never,
          amount: Number(parsed.amount || 0),
          currency: String(parsed.currency || "USD") as never,
          category: String(parsed.category || "OTHER_EXPENSE") as never,
          description: parsed.description
            ? String(parsed.description)
            : undefined,
          fromAccountId: parsed.fromAccountId
            ? String(parsed.fromAccountId)
            : undefined,
          toAccountId: parsed.toAccountId
            ? String(parsed.toAccountId)
            : undefined,
        })
        res.writeHead(200, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ ok: true }))
        return
      }

      if (url === "/mobile/sync/budget") {
        await dbStorage.setCategoryBudget(
          userId,
          String(parsed.category || "OTHER_EXPENSE") as never,
          Number(parsed.amount || 0),
          String(parsed.currency || "USD") as never,
          String(parsed.period || "MONTHLY") as never
        )
        res.writeHead(200, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ ok: true }))
        return
      }

      if (url === "/mobile/sync/goal") {
        await dbStorage.addGoal(userId, {
          id: String(parsed.id || randomUUID()),
          name: String(parsed.name || "Goal"),
          targetAmount: Number(parsed.targetAmount || 0),
          currentAmount: Number(parsed.currentAmount || 0),
          currency: String(parsed.currency || "USD") as never,
          status: String(parsed.status || "ACTIVE") as never,
          deadline: parsed.deadline
            ? new Date(String(parsed.deadline))
            : undefined,
        })
        res.writeHead(200, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ ok: true }))
        return
      }

      if (url === "/mobile/sync/debt") {
        await dbStorage.addDebt(userId, {
          id: String(parsed.id || randomUUID()),
          name: String(parsed.name || "Debt"),
          counterparty: String(parsed.counterparty || "Unknown"),
          amount: Number(parsed.amount || 0),
          currency: String(parsed.currency || "USD") as never,
          type: String(parsed.type || "I_OWE") as never,
          dueDate: parsed.dueDate
            ? new Date(String(parsed.dueDate))
            : undefined,
          description: parsed.description
            ? String(parsed.description)
            : undefined,
          paidAmount: Number(parsed.paidAmount || 0),
          isPaid: Boolean(parsed.isPaid),
        })
        res.writeHead(200, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ ok: true }))
        return
      }

      if (url === "/mobile/sync/reminder") {
        await dbStorage.createReminder({
          userId,
          type: String(parsed.relatedEntityType || "GOAL") as never,
          entityId: String(parsed.relatedEntityId || "manual"),
          reminderDate: parsed.date
            ? new Date(String(parsed.date))
            : new Date(),
          message: String(parsed.title || "Reminder"),
        })
        res.writeHead(200, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ ok: true }))
        return
      }

      if (url === "/mobile/sync/recurring") {
        const startDate = new Date()
        await dbStorage.createRecurringTransaction({
          userId,
          type: String(parsed.type || "EXPENSE") as never,
          amount: Number(parsed.amount || 0),
          currency: String(parsed.currency || "USD") as never,
          category: String(parsed.category || "OTHER_EXPENSE") as never,
          accountId: String(parsed.accountId || "Main"),
          frequency: String(parsed.frequency || "MONTHLY") as never,
          startDate,
          nextExecutionDate: parsed.nextExecutionDate
            ? new Date(String(parsed.nextExecutionDate))
            : startDate,
          description: parsed.description
            ? String(parsed.description)
            : undefined,
        })
        res.writeHead(200, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ ok: true }))
        return
      }

      if (url === "/mobile/sync/template") {
        await dbStorage.addTemplate(userId, {
          name: String(parsed.title || "Template"),
          category: String(parsed.category || "OTHER_EXPENSE"),
          amount: Number(parsed.amount || 0),
          currency: String(parsed.currency || "USD") as never,
          type: String(parsed.type || "EXPENSE") as never,
          accountId: parsed.accountId ? String(parsed.accountId) : undefined,
        })
        res.writeHead(200, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ ok: true }))
        return
      }
    }

    res.writeHead(404, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Not Found" }))
    return
  }

  if (url.startsWith("/admin/")) {
    if (url === "/admin/auth/start" && req.method === "POST") {
      const parsed = await readJsonBody(req)
      const userId = String(parsed.userId || "").trim()
      if (!userId) {
        res.writeHead(400, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ error: "userId is required" }))
        return
      }
      if (!isAllowedAdminUser(userId)) {
        res.writeHead(403, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ error: "User is not allowed as admin" }))
        return
      }

      const challengeId = randomUUID()
      const code = String(Math.floor(100000 + Math.random() * 900000))
      adminLoginChallenges.set(challengeId, {
        userId,
        code,
        expiresAt: Date.now() + ADMIN_LOGIN_TTL_MS,
      })
      try {
        const messageId = await sendTelegramAdminCode(userId, code)
        const challenge = adminLoginChallenges.get(challengeId)
        if (challenge) {
          challenge.messageId = messageId
          adminLoginChallenges.set(challengeId, challenge)
        }
        res.writeHead(200, { "Content-Type": "application/json" })
        res.end(
          JSON.stringify({
            ok: true,
            challengeId,
            expiresInSec: Math.floor(ADMIN_LOGIN_TTL_MS / 1000),
          })
        )
      } catch (error) {
        adminLoginChallenges.delete(challengeId)
        res.writeHead(500, { "Content-Type": "application/json" })
        res.end(
          JSON.stringify({
            error:
              error instanceof Error
                ? error.message
                : "Failed to deliver Telegram code",
          })
        )
      }
      return
    }

    if (url === "/admin/auth/verify" && req.method === "POST") {
      const parsed = await readJsonBody(req)
      const challengeId = String(parsed.challengeId || "").trim()
      const code = String(parsed.code || "").trim()
      const challenge = adminLoginChallenges.get(challengeId)
      if (!challenge) {
        res.writeHead(400, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ error: "Challenge not found or expired" }))
        return
      }
      if (challenge.expiresAt <= Date.now()) {
        adminLoginChallenges.delete(challengeId)
        res.writeHead(400, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ error: "Challenge expired" }))
        return
      }
      if (challenge.code !== code) {
        res.writeHead(400, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ error: "Invalid code" }))
        return
      }

      adminLoginChallenges.delete(challengeId)
      const sessionId = randomUUID()
      const actor = await resolveTelegramActorLabel(challenge.userId)
      adminSessions.set(sessionId, {
        userId: challenge.userId,
        actor,
        expiresAt: Date.now() + ADMIN_SESSION_TTL_MS,
      })
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Set-Cookie": `admin_session=${sessionId}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${Math.floor(
          ADMIN_SESSION_TTL_MS / 1000
        )}`,
      })
      res.end(JSON.stringify({ ok: true }))
      await deleteTelegramMessage(challenge.userId, challenge.messageId)
      return
    }

    if (url === "/admin/auth/logout" && req.method === "POST") {
      const cookies = parseCookies(req)
      const sessionId = cookies.admin_session
      if (sessionId) adminSessions.delete(sessionId)
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Set-Cookie":
          "admin_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0",
      })
      res.end(JSON.stringify({ ok: true }))
      return
    }

    if (url === "/admin/auth/test-login" && req.method === "POST") {
      if (process.env.NODE_ENV !== "test") {
        res.writeHead(404, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ error: "Not Found" }))
        return
      }
      const parsed = await readJsonBody(req)
      const userId = String(parsed.userId || "").trim()
      if (!userId) {
        res.writeHead(400, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ error: "userId is required" }))
        return
      }
      const actor = `test:${userId}`
      const sessionId = randomUUID()
      adminSessions.set(sessionId, {
        userId,
        actor,
        expiresAt: Date.now() + ADMIN_SESSION_TTL_MS,
      })
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Set-Cookie": `admin_session=${sessionId}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${Math.floor(
          ADMIN_SESSION_TTL_MS / 1000
        )}`,
      })
      res.end(JSON.stringify({ ok: true }))
      return
    }

    if (url === "/admin/auth/me" && req.method === "GET") {
      const ok = checkAdminAccess(req)
      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ ok }))
      return
    }

    if (url.startsWith("/admin/ui") && req.method === "GET") {
      // UI can be opened without token; data access below is still protected.
    } else if (!checkAdminAccess(req)) {
      res.writeHead(401, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Unauthorized admin access" }))
      return
    }

    if (url === "/admin/monetization" && req.method === "GET") {
      const stats = await dbStorage.getMonetizationStats()
      const users = await dbStorage.getSubscriptionAdminList(100)
      const payload = JSON.stringify({
        stats,
        users,
        generatedAt: new Date().toISOString(),
      })
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      })
      res.end(payload)
      return
    }

    if (url === "/admin/audit" && req.method === "GET") {
      const limit = Math.max(
        1,
        Math.min(200, Number(parsedUrl.searchParams.get("limit") || 50))
      )
      const items = readAdminActions(limit)
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      })
      res.end(JSON.stringify({ items, generatedAt: new Date().toISOString() }))
      return
    }

    if (url.startsWith("/admin/ui") && req.method === "GET") {
      const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>MyPersFinBot Admin</title>
  <style>
    :root{--bg:#f4f6f8;--card:#fff;--text:#111;--muted:#667085;--line:#e8ebef;--soft:#fafbfc;--ok:#0a8f4b;--danger:#d33}
    *{box-sizing:border-box}
    body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;margin:0;background:var(--bg);color:var(--text)}
    .container{max-width:1240px;margin:0 auto;padding:20px}
    h1{margin:0 0 16px;font-size:32px;line-height:1.1}
    h3{margin:0 0 12px}
    .card{background:var(--card);border-radius:12px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,.08);margin-bottom:14px}
    .table-wrap{overflow:auto}
    table{width:100%;border-collapse:collapse;font-size:13px;min-width:980px}
    th{font-weight:600}
    th,td{border-bottom:1px solid var(--line);padding:10px;text-align:left;vertical-align:top}
    button{padding:7px 11px;border-radius:8px;border:1px solid #cdd5df;background:#fff;cursor:pointer;line-height:1.1}
    button:hover{background:#f8fafc}
    input,select{padding:8px 10px;border-radius:8px;border:1px solid #cdd5df}
    .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
    .danger{border-color:var(--danger);color:var(--danger)}
    .ok{border-color:var(--ok);color:var(--ok)}
    .muted{color:var(--muted)}
    .result{margin-top:10px;white-space:pre-wrap}
    .dashboard{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
    .kpi{background:var(--soft);border:1px solid var(--line);border-radius:10px;padding:12px 12px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
    .kpi .v{font-size:22px;font-weight:700;line-height:1.1}
    .kpi .l{font-size:12px;color:var(--muted)}
    #status{font-size:12px}
    .cell-actions{display:flex;gap:6px;flex-wrap:wrap}
    .chip{display:inline-block;padding:2px 7px;border-radius:999px;border:1px solid var(--line);font-size:11px;background:#fff}
    .chip.ok{color:var(--ok);border-color:#a6d8bb}
    .chip.pause{color:#9a6700;border-color:#f0d39a}
    .users-toolbar{margin-bottom:8px;justify-content:space-between}
    .users-toolbar .left{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
    .users-toolbar .right{display:flex;gap:8px;align-items:center}
    .pager{display:flex;gap:8px;align-items:center;justify-content:flex-end;margin-top:10px}
    .filter-row th{background:transparent;padding-top:6px;padding-bottom:10px}
    .filter-row input,.filter-row select{width:100%}
    .sort-btn{border:none;background:transparent;padding:0;font:inherit;font-weight:600;cursor:pointer}
    .sort-btn .arr{margin-left:4px;color:var(--muted);font-size:11px}
    .toast{position:fixed;right:16px;bottom:16px;max-width:340px;padding:10px 12px;border-radius:10px;background:#111;color:#fff;opacity:0;pointer-events:none;transform:translateY(8px);transition:.2s ease;font-size:13px}
    .toast.show{opacity:1;transform:translateY(0)}
    .toast.error{background:#b42318}
    .toast.ok{background:#0a8f4b}
  </style>
</head>
<body>
  <div class="container">
  <h1>MyPersFinBot Admin</h1>
  <div class="card" id="authCard" style="display:none">
    <h3 style="margin:0 0 10px">Telegram Admin Login</h3>
    <div class="row">
      <input id="authUserId" placeholder="Your Telegram user ID" />
      <button id="authSendCode">Send code in Telegram</button>
    </div>
    <div class="row" style="margin-top:8px">
      <input id="authCode" placeholder="6-digit code" />
      <button id="authVerify">Verify</button>
    </div>
    <div class="row" style="margin-top:8px">
      <span id="authStatus" class="muted"></span>
    </div>
  </div>
  <div id="adminApp" style="display:none">
  <div class="card">
    <div class="row" style="justify-content:space-between">
      <h3 style="margin:0">Overview</h3>
      <span id="status" class="muted"></span>
    </div>
    <div id="stats" class="dashboard" style="margin-top:10px"></div>
  </div>
  <div class="card">
    <div class="row users-toolbar" style="margin-bottom:8px">
      <h3 style="margin:0">Users</h3>
      <div class="right"><span id="usersCount" class="muted"></span></div>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th><button class="sort-btn" data-sort="username">Username<span class="arr"></span></button></th>
            <th><button class="sort-btn" data-sort="user">User ID<span class="arr"></span></button></th>
            <th><button class="sort-btn" data-sort="tier">Subscription<span class="arr"></span></button></th>
            <th><button class="sort-btn" data-sort="access">Access<span class="arr"></span></button></th>
            <th><button class="sort-btn" data-sort="usage">Usage<span class="arr"></span></button></th>
            <th>Actions</th>
          </tr>
          <tr class="filter-row">
            <th colspan="2"><input id="usersSearch" placeholder="Search by username or user ID" /></th>
            <th>
              <select id="usersFilter">
                <option value="all">All</option>
                <option value="free">Free</option>
                <option value="trial">Trial</option>
                <option value="premium">Premium</option>
              </select>
            </th>
            <th><button id="usersReset">Reset</button></th>
            <th></th>
            <th></th>
          </tr>
        </thead>
        <tbody id="users"></tbody>
      </table>
    </div>
    <div class="pager" id="usersPager">
      <button id="usersPrev">Prev</button>
      <span id="usersPageInfo" class="muted"></span>
      <button id="usersNext">Next</button>
    </div>
  </div>
  <div class="card">
    <div class="row users-toolbar" style="margin-bottom:8px">
      <h3 style="margin:0">Admin Activity</h3>
      <div class="right">
        <button id="auditRefresh">Refresh</button>
      </div>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>Time</th><th>Actor</th><th>Action</th><th>Status</th><th>Details</th></tr>
        </thead>
        <tbody id="auditRows"></tbody>
      </table>
    </div>
  </div>
  <div id="toast" class="toast"></div>
<script>
let authChallengeId = ''
let usersCache = []
let usersFilteredCache = []
let usersPage = 1
let usersOrderBy = 'user'
let usersOrderDir = 'desc'
const usersPageSize = 50
const dtf = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit'
})
function buildUrl(path){
  return path
}
function setAuthUi(authorized){
  document.getElementById('authCard').style.display = authorized ? 'none' : 'block'
  document.getElementById('adminApp').style.display = authorized ? 'block' : 'none'
}
async function isAuthorized(){
  const res = await fetch('/admin/auth/me', { credentials: 'include' })
  if(!res.ok) return false
  const body = await res.json()
  return !!body.ok
}
async function startTelegramAuth(){
  const userId = String(document.getElementById('authUserId').value || '').trim()
  if(!userId){
    showToast('Enter Telegram user ID', 'error')
    return
  }
  const status = document.getElementById('authStatus')
  status.textContent = 'Sending code...'
  const res = await fetch('/admin/auth/start', {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({ userId })
  })
  const body = await res.json()
  if(!res.ok){
    status.textContent = body.error || ('HTTP ' + res.status)
    return
  }
  authChallengeId = body.challengeId || ''
  status.textContent = 'Code sent. Check Telegram and enter it below.'
}
async function verifyTelegramAuth(){
  const code = String(document.getElementById('authCode').value || '').trim()
  const status = document.getElementById('authStatus')
  if(!authChallengeId){
    status.textContent = 'Request code first.'
    return
  }
  if(!code){
    status.textContent = 'Enter code.'
    return
  }
  status.textContent = 'Verifying...'
  const res = await fetch('/admin/auth/verify', {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({ challengeId: authChallengeId, code }),
    credentials: 'include'
  })
  const body = await res.json()
  if(!res.ok){
    status.textContent = body.error || ('HTTP ' + res.status)
    return
  }
  status.textContent = 'Authorized.'
  setAuthUi(true)
  await load()
}
function showToast(message, kind){
  const toast = document.getElementById('toast')
  toast.textContent = message
  toast.className = 'toast ' + (kind || 'ok') + ' show'
  clearTimeout(showToast._timer)
  showToast._timer = setTimeout(()=>{
    toast.className = 'toast ' + (kind || 'ok')
  }, 2200)
}
function formatRemaining(ms){
  if(!ms || ms <= 0) return '-'
  const totalMinutes = Math.floor(ms / 60000)
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  const parts = []
  if(days) parts.push(days + 'd')
  if(hours) parts.push(hours + 'h')
  if(minutes || parts.length === 0) parts.push(minutes + 'm')
  return parts.join(' ')
}
function formatIso(iso){
  if(!iso) return '-'
  const d = new Date(iso)
  if(Number.isNaN(d.getTime())) return '-'
  return dtf.format(d)
}
function buildStatsKpi(stats){
  const items = [
    {label:'Total users', value: stats.totalUsers || 0},
    {label:'Free', value: stats.freeUsers || 0},
    {label:'Trial', value: stats.trialUsers || 0},
    {label:'Premium', value: stats.premiumUsers || 0},
    {label:'Active premium', value: stats.activePremiumUsers || 0},
  ]
  return items.map(i => '<div class="kpi"><div class="v">'+i.value+'</div><div class="l">'+i.label+'</div></div>').join('')
}
function getAccessText(u){
  if(u.subscriptionPaused){
    return 'paused • ' + formatRemaining(u.pausedRemainingMs)
  }
  if(u.tier === 'premium'){
    return 'until ' + formatIso(u.premiumExpiresAt)
  }
  if(u.tier === 'trial'){
    return 'until ' + formatIso(u.trialExpiresAt)
  }
  return '-'
}
function subscriptionLabel(u){
  if(u.subscriptionPaused){
    return '<span class="chip pause">' + (u.tier || 'free') + ' (paused)</span>'
  }
  if(u.tier === 'premium' || u.tier === 'trial'){
    return '<span class="chip ok">' + u.tier + ' (active)</span>'
  }
  return '<span class="chip">free</span>'
}
function actionButtons(u){
  const uid = String(u.userId || '')
  const list = []
  if(u.subscriptionPaused){
    list.push('<button class="ok" data-action="resume" data-user="' + uid + '">Resume</button>')
    list.push('<button class="danger" data-action="cancel" data-user="' + uid + '">Cancel</button>')
  } else if(u.tier === 'premium' || u.tier === 'trial'){
    list.push('<button class="danger" data-action="pause" data-user="' + uid + '">Pause</button>')
    list.push('<button class="danger" data-action="cancel" data-user="' + uid + '">Cancel</button>')
    list.push('<button data-action="grant30" data-user="' + uid + '">+30d</button>')
    list.push('<button data-action="grant365" data-user="' + uid + '">+365d</button>')
    list.push('<button data-action="grantLifetime" data-user="' + uid + '">Lifetime</button>')
  } else {
    list.push('<button data-action="setTrial" data-user="' + uid + '">Set trial</button>')
    list.push('<button data-action="setPremium30" data-user="' + uid + '">Set premium 30d</button>')
    list.push('<button data-action="setPremium365" data-user="' + uid + '">Set premium 365d</button>')
    list.push('<button data-action="setPremiumLifetime" data-user="' + uid + '">Set lifetime</button>')
  }
  return '<div class="cell-actions">' + list.join('') + '</div>'
}
function tierRank(u){
  if(u.tier === 'premium') return 3
  if(u.tier === 'trial') return 2
  return 1
}
function accessTs(u){
  if(u.subscriptionPaused) return Number(u.pausedRemainingMs || 0)
  const raw = u.tier === 'premium' ? u.premiumExpiresAt : (u.tier === 'trial' ? u.trialExpiresAt : null)
  const ts = raw ? new Date(raw).getTime() : 0
  return Number.isFinite(ts) ? ts : 0
}
function usageScore(u){
  return Number(u.transactionsThisMonth || 0) + Number(u.voiceInputsToday || 0)
}
function compareUsers(a, b, orderBy, orderDir){
  const dir = orderDir === 'asc' ? 1 : -1
  let value = 0
  if(orderBy === 'username') value = String(a.username || '').localeCompare(String(b.username || ''), undefined, { sensitivity: 'base' })
  else if(orderBy === 'tier') value = tierRank(a) - tierRank(b)
  else if(orderBy === 'access') value = accessTs(a) - accessTs(b)
  else if(orderBy === 'usage') value = usageScore(a) - usageScore(b)
  else value = String(a.userId).localeCompare(String(b.userId), undefined, { numeric: true })
  return value * dir
}
function readTableStateFromUrl(){
  const params = new URLSearchParams(location.search)
  const search = params.get('usersSearch')
  const filter = params.get('usersFilter')
  const orderBy = params.get('usersOrderBy')
  const orderDir = params.get('usersOrderDir')
  const page = Number(params.get('usersPage') || '1')
  if(search !== null) document.getElementById('usersSearch').value = search
  if(filter !== null) document.getElementById('usersFilter').value = filter
  if(orderBy !== null) usersOrderBy = orderBy
  if(orderDir !== null) usersOrderDir = orderDir
  usersPage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
}
function writeTableStateToUrl(){
  const params = new URLSearchParams(location.search)
  const search = String(document.getElementById('usersSearch').value || '')
  const filter = String(document.getElementById('usersFilter').value || 'all')
  params.set('usersSearch', search)
  params.set('usersFilter', filter)
  params.set('usersOrderBy', usersOrderBy)
  params.set('usersOrderDir', usersOrderDir)
  params.set('usersPage', String(usersPage))
  const next = location.pathname + '?' + params.toString()
  history.replaceState(null, '', next)
}
function renderSortIndicators(){
  document.querySelectorAll('.sort-btn').forEach((btn)=>{
    const key = btn.getAttribute('data-sort') || ''
    const arr = btn.querySelector('.arr')
    if(!arr) return
    if(key !== usersOrderBy){
      arr.textContent = ''
      return
    }
    arr.textContent = usersOrderDir === 'asc' ? '▲' : '▼'
  })
}
function applyUsersView(){
  const search = String(document.getElementById('usersSearch').value || '').trim().toLowerCase()
  const filter = String(document.getElementById('usersFilter').value || 'all')
  let users = usersCache.slice()
  if(search){
    users = users.filter((u)=>
      String(u.userId || '').toLowerCase().includes(search) ||
      String(u.username || '').toLowerCase().includes(search)
    )
  }
  if(filter !== 'all'){
    users = users.filter((u)=> String(u.tier || 'free') === filter)
  }
  users.sort((a,b)=> compareUsers(a,b,usersOrderBy,usersOrderDir))
  usersFilteredCache = users
  const totalPages = Math.max(1, Math.ceil(usersFilteredCache.length / usersPageSize))
  if(usersPage > totalPages) usersPage = totalPages
  if(usersPage < 1) usersPage = 1
  const start = (usersPage - 1) * usersPageSize
  const pageUsers = usersFilteredCache.slice(start, start + usersPageSize)

  const tbody = document.getElementById('users')
  tbody.innerHTML = ''
  for(const u of pageUsers){
    const tr = document.createElement('tr')
    const username = u.username ? ('@' + u.username) : '-'
    const subscription = subscriptionLabel(u)
    const usage = 'tx: ' + (u.transactionsThisMonth || 0) + ' • voice: ' + (u.voiceInputsToday || 0)
    tr.innerHTML = '<td>'+username+'</td><td>'+u.userId+'</td><td>'+subscription+'</td><td>'+getAccessText(u)+'</td><td>'+usage+'</td>' +
      '<td>'+actionButtons(u)+'</td>'
    tbody.appendChild(tr)
  }
  document.getElementById('usersCount').textContent = 'Shown: ' + pageUsers.length + ' / ' + usersFilteredCache.length + ' (total ' + usersCache.length + ')'
  document.getElementById('usersPageInfo').textContent = 'Page ' + usersPage + ' / ' + totalPages
  document.getElementById('usersPrev').disabled = usersPage <= 1
  document.getElementById('usersNext').disabled = usersPage >= totalPages
  document.getElementById('usersPager').style.display = totalPages <= 1 ? 'none' : 'flex'
  renderSortIndicators()
  writeTableStateToUrl()
}
function stringifyDetails(payload){
  if(!payload || typeof payload !== 'object') return '-'
  const p = payload
  const parts = []
  if(p.userId) parts.push('user=' + p.userId)
  if(p.tier) parts.push('tier=' + p.tier)
  if(p.days) parts.push('days=' + p.days)
  if(p.premiumDays) parts.push('premiumDays=' + p.premiumDays)
  if(p.provider) parts.push('provider=' + p.provider)
  return parts.length ? parts.join(' • ') : '-'
}
async function loadAudit(){
  const res = await fetch(buildUrl('/admin/audit?limit=50'), { credentials: 'include' })
  if(!res.ok){
    if(res.status === 401){
      setAuthUi(false)
      return
    }
    throw new Error('Failed to load audit: ' + res.status)
  }
  const data = await res.json()
  const rows = Array.isArray(data.items) ? data.items : []
  const tbody = document.getElementById('auditRows')
  tbody.innerHTML = ''
  for(const row of rows){
    const tr = document.createElement('tr')
    const ts = row.ts ? formatIso(String(row.ts)) : '-'
    const actor = row.actor || '-'
    const action = row.action || '-'
    const status = row.ok ? 'ok' : 'error'
    const details = stringifyDetails(row.payload || {})
    tr.innerHTML = '<td>' + ts + '</td><td>' + actor + '</td><td>' + action + '</td><td>' + status + '</td><td>' + details + '</td>'
    tbody.appendChild(tr)
  }
}
async function load(){
  const st = document.getElementById('status')
  st.textContent = 'Loading...'
  const res = await fetch(buildUrl('/admin/monetization'), { credentials: 'include' })
  if(!res.ok){
    if(res.status === 401){
      setAuthUi(false)
      st.textContent = 'Unauthorized'
      return
    }
    st.textContent = 'Failed: ' + res.status
    return
  }
  const data = await res.json()
  document.getElementById('stats').innerHTML = buildStatsKpi(data.stats || {})
  usersCache = Array.isArray(data.users) ? data.users : []
  applyUsersView()
  await loadAudit()
  st.textContent = 'Updated at ' + dtf.format(new Date())
}

async function postJson(path, payload){
  const res = await fetch(buildUrl(path), {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify(payload || {}),
    credentials: 'include'
  })
  const text = await res.text()
  let body
  try { body = JSON.parse(text) } catch { body = { raw:text } }
  if(!res.ok){
    throw new Error((body && (body.error || body.message)) || ('HTTP ' + res.status))
  }
  return body
}

async function act(fn){
  try{
    await fn()
    showToast('Done', 'ok')
    await load()
  }catch(err){
    showToast(err && err.message ? err.message : String(err), 'error')
  }
}

document.getElementById('users').addEventListener('click', (event)=>{
  const target = event.target
  if(!(target instanceof HTMLElement)) return
  const btn = target.closest('button[data-action]')
  if(!btn) return
  const action = btn.getAttribute('data-action') || ''
  const userId = btn.getAttribute('data-user') || ''
  if(!userId) return

  act(async ()=>{
    if(action === 'cancel'){
      const confirmed = confirm('Cancel subscription completely for this user?')
      if(!confirmed) return { skipped: true }
      return await postJson('/admin/subscription/cancel', { userId })
    }
    if(action === 'pause') return await postJson('/admin/subscription/pause', { userId })
    if(action === 'resume') return await postJson('/admin/subscription/resume', { userId })
    if(action === 'setTrial') return await postJson('/admin/subscription', { userId, tier: 'trial', days: 7 })
    if(action === 'setPremium30') return await postJson('/admin/subscription', { userId, tier: 'premium', days: 30 })
    if(action === 'setPremium365') return await postJson('/admin/subscription', { userId, tier: 'premium', days: 365 })
    if(action === 'setPremiumLifetime') return await postJson('/admin/subscription', { userId, tier: 'premium', days: 3650 })
    if(action === 'grant30') return await postJson('/admin/payment', { userId, provider: 'manual', reference: 'quick_30_' + Date.now(), premiumDays: 30 })
    if(action === 'grant365') return await postJson('/admin/payment', { userId, provider: 'manual', reference: 'quick_365_' + Date.now(), premiumDays: 365 })
    if(action === 'grantLifetime') return await postJson('/admin/payment', { userId, provider: 'manual', reference: 'quick_lifetime_' + Date.now(), premiumDays: 3650 })
    throw new Error('Unknown action')
  })
})
document.getElementById('usersSearch').addEventListener('input', ()=>{
  usersPage = 1
  applyUsersView()
})
document.getElementById('usersFilter').addEventListener('change', ()=>{
  usersPage = 1
  applyUsersView()
})
document.querySelectorAll('.sort-btn').forEach((btn)=>{
  btn.addEventListener('click', ()=>{
    const nextSort = btn.getAttribute('data-sort') || 'user'
    if(usersOrderBy === nextSort){
      usersOrderDir = usersOrderDir === 'asc' ? 'desc' : 'asc'
    } else {
      usersOrderBy = nextSort
      usersOrderDir = 'desc'
    }
    usersPage = 1
    applyUsersView()
  })
})
document.getElementById('usersReset').addEventListener('click', ()=>{
  document.getElementById('usersSearch').value = ''
  document.getElementById('usersFilter').value = 'all'
  usersOrderBy = 'user'
  usersOrderDir = 'desc'
  usersPage = 1
  applyUsersView()
})
document.getElementById('usersPrev').addEventListener('click', ()=>{
  usersPage = Math.max(1, usersPage - 1)
  applyUsersView()
})
document.getElementById('usersNext').addEventListener('click', ()=>{
  usersPage += 1
  applyUsersView()
})
document.getElementById('auditRefresh').addEventListener('click', ()=>{
  void loadAudit()
})
document.getElementById('authSendCode').addEventListener('click', ()=>{
  void startTelegramAuth()
})
document.getElementById('authVerify').addEventListener('click', ()=>{
  void verifyTelegramAuth()
})

readTableStateFromUrl()
void (async ()=>{
  const ok = await isAuthorized()
  setAuthUi(ok)
  if(ok){
    await load()
  }
})()
</script>
</div>
</div>
</body></html>`
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
      res.end(html)
      return
    }

    if (url.startsWith("/admin/subscription/pause") && req.method === "POST") {
      const parsed = await readJsonBody(req)
      const userId = String(parsed.userId || "")
      if (!userId) {
        auditAdminAction(
          req,
          "subscription.pause",
          parsed,
          false,
          "userId is required"
        )
        res.writeHead(400, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ error: "userId is required" }))
        return
      }
      const status = await dbStorage.pauseSubscription(userId)
      auditAdminAction(req, "subscription.pause", parsed, true)
      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ ok: true, status }))
      return
    }

    if (url.startsWith("/admin/subscription/resume") && req.method === "POST") {
      const parsed = await readJsonBody(req)
      const userId = String(parsed.userId || "")
      if (!userId) {
        auditAdminAction(
          req,
          "subscription.resume",
          parsed,
          false,
          "userId is required"
        )
        res.writeHead(400, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ error: "userId is required" }))
        return
      }
      const status = await dbStorage.resumePausedSubscription(userId)
      auditAdminAction(req, "subscription.resume", parsed, true)
      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ ok: true, status }))
      return
    }

    if (url.startsWith("/admin/subscription/cancel") && req.method === "POST") {
      const parsed = await readJsonBody(req)
      const userId = String(parsed.userId || "")
      if (!userId) {
        auditAdminAction(
          req,
          "subscription.cancel",
          parsed,
          false,
          "userId is required"
        )
        res.writeHead(400, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ error: "userId is required" }))
        return
      }
      const status = await dbStorage.setSubscriptionTier(userId, "free")
      auditAdminAction(req, "subscription.cancel", parsed, true)
      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ ok: true, status }))
      return
    }

    if (url.startsWith("/admin/subscription") && req.method === "POST") {
      const parsed = await readJsonBody(req)
      const userId = String(parsed.userId || "")
      const tier = String(parsed.tier || "free") as "free" | "trial" | "premium"
      const days = Number(parsed.days || 30)
      if (!userId) {
        auditAdminAction(
          req,
          "subscription.set",
          parsed,
          false,
          "userId is required"
        )
        res.writeHead(400, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ error: "userId is required" }))
        return
      }
      const status = await dbStorage.setSubscriptionTier(userId, tier, days)
      auditAdminAction(req, "subscription.set", parsed, true)
      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ ok: true, status }))
      return
    }

    if (url.startsWith("/admin/payment") && req.method === "POST") {
      const parsed = await readJsonBody(req)
      const userId = String(parsed.userId || "")
      const provider = String(parsed.provider || "manual")
      const reference = String(parsed.reference || `manual_${Date.now()}`)
      const premiumDays = Number(parsed.premiumDays || 30)
      if (!userId) {
        auditAdminAction(
          req,
          "payment.grant",
          parsed,
          false,
          "userId is required"
        )
        res.writeHead(400, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ error: "userId is required" }))
        return
      }
      const status = await dbStorage.recordPayment(
        userId,
        provider,
        reference,
        premiumDays
      )
      auditAdminAction(req, "payment.grant", parsed, true)
      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ ok: true, status }))
      return
    }
  }

  res.writeHead(404, { "Content-Type": "text/plain" })
  res.end("Not Found")
}

export function startHealthServer() {
  if (server) return server

  if (config.HEALTH_TLS_ENABLED) {
    if (!config.HEALTH_TLS_KEY_PATH || !config.HEALTH_TLS_CERT_PATH) {
      throw new Error(
        "HEALTH_TLS_ENABLED=true requires HEALTH_TLS_KEY_PATH and HEALTH_TLS_CERT_PATH"
      )
    }

    const key = fs.readFileSync(config.HEALTH_TLS_KEY_PATH)
    const cert = fs.readFileSync(config.HEALTH_TLS_CERT_PATH)

    server = https.createServer({ key, cert }, (req, res) => {
      void requestHandler(req, res)
    })
  } else {
    server = http.createServer((req, res) => {
      void requestHandler(req, res)
    })
  }

  server.listen(config.HEALTH_PORT, config.HEALTH_HOST, () => {
    if (appConfig.LOG_BOOT_DETAIL) {
      const protocol = config.HEALTH_TLS_ENABLED ? "https" : "http"
      logger.info(
        `✅ Health server listening on ${protocol}://${config.HEALTH_HOST}:${config.HEALTH_PORT}`
      )
    }
  })

  server.on("error", (err) => {
    logger.error("Health server error", err)
  })

  pruneAdminAuditLog()
  if (!adminAuditPruneTimer) {
    adminAuditPruneTimer = setInterval(() => {
      pruneAdminAuditLog()
    }, ADMIN_AUDIT_PRUNE_INTERVAL_MS)
  }

  return server
}

export function stopHealthServer() {
  if (!server) return
  server.close()
  server = null
  if (adminAuditPruneTimer) {
    clearInterval(adminAuditPruneTimer)
    adminAuditPruneTimer = null
  }
}
