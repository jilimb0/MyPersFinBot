import fs from "node:fs"
import http from "node:http"
import https from "node:https"
import { config as appConfig, config } from "./config"
import { dbStorage } from "./database/storage-db"
import logger from "./logger"
import { tgObservability } from "./observability/tgwrapper-observability"

let server: http.Server | https.Server | null = null

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

function checkAdminToken(req: http.IncomingMessage): boolean {
  const token = config.ADMIN_API_TOKEN
  if (!token) return false
  const headerToken = req.headers["x-admin-token"]
  if (typeof headerToken === "string" && headerToken === token) return true
  const url = new URL(req.url || "/", "http://localhost")
  const queryToken = url.searchParams.get("token")
  return queryToken === token
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

  if (url.startsWith("/admin/")) {
    if (!checkAdminToken(req)) {
      res.writeHead(401, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Unauthorized admin token" }))
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

    if (url.startsWith("/admin/ui") && req.method === "GET") {
      const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>MyPersFinBot Admin</title>
  <style>
    body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;margin:24px;background:#f4f6f8;color:#111}
    h1{margin:0 0 16px}
    .card{background:#fff;border-radius:10px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,.08);margin-bottom:16px}
    table{width:100%;border-collapse:collapse;font-size:13px}
    th,td{border-bottom:1px solid #eee;padding:8px;text-align:left}
    button{padding:8px 12px;border-radius:8px;border:1px solid #ccc;background:#fff;cursor:pointer}
    .muted{color:#666}
  </style>
</head>
<body>
  <h1>MyPersFinBot Admin</h1>
  <div class="card">
    <button id="refresh">Refresh</button>
    <p class="muted" id="status"></p>
  </div>
  <div class="card">
    <h3>Stats</h3>
    <pre id="stats">Loading...</pre>
  </div>
  <div class="card">
    <h3>Users</h3>
    <table>
      <thead>
        <tr><th>User</th><th>Tier</th><th>Paused</th><th>Remaining</th><th>Premium Exp</th><th>Trial Exp</th><th>Tx Month</th><th>Voice Day</th></tr>
      </thead>
      <tbody id="users"></tbody>
    </table>
  </div>
<script>
const token = new URLSearchParams(location.search).get('token') || ''
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
async function load(){
  const st = document.getElementById('status')
  st.textContent = 'Loading...'
  const res = await fetch('/admin/monetization?token=' + encodeURIComponent(token))
  if(!res.ok){ st.textContent = 'Failed: ' + res.status; return }
  const data = await res.json()
  document.getElementById('stats').textContent = JSON.stringify(data.stats, null, 2)
  const tbody = document.getElementById('users')
  tbody.innerHTML = ''
  for(const u of data.users){
    const tr = document.createElement('tr')
    const rem = formatRemaining(u.pausedRemainingMs)
    tr.innerHTML = '<td>'+u.userId+'</td><td>'+u.tier+'</td><td>'+(u.subscriptionPaused ? 'yes' : 'no')+'</td><td>'+rem+'</td><td>'+(u.premiumExpiresAt||'-')+'</td><td>'+(u.trialExpiresAt||'-')+'</td><td>'+u.transactionsThisMonth+'</td><td>'+u.voiceInputsToday+'</td>'
    tbody.appendChild(tr)
  }
  st.textContent = 'Updated at ' + new Date().toISOString()
}
document.getElementById('refresh').addEventListener('click', load)
load()
</script>
</body></html>`
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
      res.end(html)
      return
    }

    if (url.startsWith("/admin/subscription/pause") && req.method === "POST") {
      const bodyChunks: Buffer[] = []
      for await (const chunk of req) {
        bodyChunks.push(Buffer.from(chunk))
      }
      const raw = Buffer.concat(bodyChunks).toString("utf8")
      const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
      const userId = String(parsed.userId || "")
      if (!userId) {
        res.writeHead(400, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ error: "userId is required" }))
        return
      }
      const status = await dbStorage.pauseSubscription(userId)
      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ ok: true, status }))
      return
    }

    if (url.startsWith("/admin/subscription") && req.method === "POST") {
      const bodyChunks: Buffer[] = []
      for await (const chunk of req) {
        bodyChunks.push(Buffer.from(chunk))
      }
      const raw = Buffer.concat(bodyChunks).toString("utf8")
      const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
      const userId = String(parsed.userId || "")
      const tier = String(parsed.tier || "free") as "free" | "trial" | "premium"
      const days = Number(parsed.days || 30)
      if (!userId) {
        res.writeHead(400, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ error: "userId is required" }))
        return
      }
      const status = await dbStorage.setSubscriptionTier(userId, tier, days)
      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ ok: true, status }))
      return
    }

    if (url.startsWith("/admin/payment") && req.method === "POST") {
      const bodyChunks: Buffer[] = []
      for await (const chunk of req) {
        bodyChunks.push(Buffer.from(chunk))
      }
      const raw = Buffer.concat(bodyChunks).toString("utf8")
      const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
      const userId = String(parsed.userId || "")
      const provider = String(parsed.provider || "manual")
      const reference = String(parsed.reference || `manual_${Date.now()}`)
      const premiumDays = Number(parsed.premiumDays || 30)
      if (!userId) {
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

  return server
}

export function stopHealthServer() {
  if (!server) return
  server.close()
  server = null
}
