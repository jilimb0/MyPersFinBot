#!/usr/bin/env node

const { spawnSync } = require("node:child_process")

const ALLOWED_GHSAS = new Set([
  // Transitive minimatch issue in upstream deps (exceljs/typeorm/sentry chains).
  "GHSA-3ppc-4f35-3m26",
])

function extractJson(output) {
  const start = output.indexOf("{")
  if (start < 0) return null
  const candidate = output.slice(start)
  try {
    return JSON.parse(candidate)
  } catch {
    return null
  }
}

const result = spawnSync("pnpm", ["audit", "--prod", "--json"], {
  encoding: "utf8",
})

const raw = `${result.stdout || ""}\n${result.stderr || ""}`.trim()
const report = extractJson(raw)

if (!report) {
  console.error("Failed to parse pnpm audit JSON output")
  if (raw) console.error(raw)
  process.exit(1)
}

const advisories = Object.values(report.advisories || {})
const blocking = advisories.filter((advisory) => {
  const ghsa = advisory.github_advisory_id
  if (ghsa && ALLOWED_GHSAS.has(ghsa)) return false
  return advisory.severity === "high" || advisory.severity === "critical"
})

if (blocking.length > 0) {
  console.error("Security audit failed. Blocking advisories:")
  for (const advisory of blocking) {
    console.error(
      `- ${advisory.github_advisory_id || advisory.id}: ${advisory.title}`
    )
  }
  process.exit(1)
}

console.log("Security audit passed (with explicit allowlist).")
