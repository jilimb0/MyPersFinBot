import fs from "node:fs"
import http from "node:http"
import https from "node:https"
import { config as appConfig, config } from "./config"
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

async function requestHandler(
  req: http.IncomingMessage,
  res: http.ServerResponse
): Promise<void> {
  if (!checkBasicAuth(req)) {
    unauthorized(res)
    return
  }

  const url = req.url || "/"

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
