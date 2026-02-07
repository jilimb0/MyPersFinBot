import http from "http"
import { config } from "./config"
import logger from "./logger"
import { config as appConfig } from "./config"

let server: http.Server | null = null

export function startHealthServer() {
  if (server) return server

  server = http.createServer((req, res) => {
    const url = req.url || "/"

    if (url === "/healthz" || url === "/readyz") {
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

    res.writeHead(404, { "Content-Type": "text/plain" })
    res.end("Not Found")
  })

  server.listen(config.HEALTH_PORT, config.HEALTH_HOST, () => {
    if (appConfig.LOG_BOOT_DETAIL) {
      logger.info(
        `✅ Health server listening on ${config.HEALTH_HOST}:${config.HEALTH_PORT}`
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
