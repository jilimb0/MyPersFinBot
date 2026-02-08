import fs from "fs"
import path from "path"

const ROOT = process.cwd()
const LOCALES_DIR = path.join(ROOT, "src", "i18n", "locales")
const SRC_DIR = path.join(ROOT, "src")
const REPORT_FILE = path.join(ROOT, "translation-report.txt")

const LANGS = ["en", "ru", "uk", "es", "pl"] as const

type Lang = (typeof LANGS)[number]

function flattenKeys(obj: any, prefix = ""): string[] {
  if (obj == null || typeof obj !== "object") return []
  const keys: string[] = []
  for (const [key, value] of Object.entries(obj)) {
    const next = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === "object" && !Array.isArray(value)) {
      keys.push(...flattenKeys(value, next))
    } else {
      keys.push(next)
    }
  }
  return keys
}

async function loadLocale(lang: Lang): Promise<any> {
  const modulePath = `./src/i18n/locales/${lang}`
  const mod = await import(modulePath)
  return mod[lang]
}

function uniqSorted(list: string[]): string[] {
  return Array.from(new Set(list)).sort()
}

function isTestOrTypePath(full: string): boolean {
  return (
    full.includes(`${path.sep}__tests__${path.sep}`) ||
    full.includes(`${path.sep}tests${path.sep}`) ||
    full.includes(`${path.sep}types${path.sep}`) ||
    full.includes(".test.") ||
    full.includes(".spec.") ||
    full.endsWith(".d.ts")
  )
}

const ALLOWED_PATH_PREFIXES = [
  path.join(SRC_DIR, "handlers") + path.sep,
  path.join(SRC_DIR, "wizards") + path.sep,
  path.join(SRC_DIR, "reports", "formatters") + path.sep,
]

const ALLOWED_FILES = new Set([
  path.join(SRC_DIR, "menus-i18n.ts"),
  path.join(SRC_DIR, "security.ts"),
  path.join(SRC_DIR, "analytics", "formatters.ts"),
  path.join(SRC_DIR, "currency", "formatters.ts"),
  path.join(SRC_DIR, "notifications", "formatters.ts"),
  path.join(SRC_DIR, "commands.ts"),
  path.join(SRC_DIR, "middleware", "error-handler.ts"),
])

function isAllowedFile(full: string): boolean {
  if (ALLOWED_FILES.has(full)) return true
  if (full.includes(`${path.sep}handlers${path.sep}message${path.sep}`))
    return false
  return ALLOWED_PATH_PREFIXES.some((prefix) => full.startsWith(prefix))
}

function walk(dir: string, includeAll = false): string[] {
  const results: string[] = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".next") continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (
        entry.name === "__tests__" ||
        entry.name === "tests" ||
        entry.name === "types"
      ) {
        continue
      }
      if (full.startsWith(LOCALES_DIR)) continue
      results.push(...walk(full, includeAll))
    } else if (entry.isFile()) {
      if (full.endsWith(".ts") || full.endsWith(".tsx")) {
        if (full.startsWith(LOCALES_DIR)) continue
        if (isTestOrTypePath(full)) continue
        if (full.endsWith(`${path.sep}index-old.ts`)) continue
        if (!includeAll && !isAllowedFile(full)) continue
        results.push(full)
      }
    }
  }
  return results
}

function stripComments(code: string): string {
  let out = ""
  let i = 0
  const len = code.length
  let inLine = false
  let inBlock = false
  let inSingle = false
  let inDouble = false
  let inTemplate = false

  while (i < len) {
    const ch = code[i]
    const next = code[i + 1]

    if (inLine) {
      if (ch === "\n") {
        inLine = false
        out += ch
      }
      i++
      continue
    }

    if (inBlock) {
      if (ch === "*" && next === "/") {
        inBlock = false
        i += 2
      } else {
        i++
      }
      continue
    }

    if (!inSingle && !inDouble && !inTemplate) {
      if (ch === "/" && next === "/") {
        inLine = true
        i += 2
        continue
      }
      if (ch === "/" && next === "*") {
        inBlock = true
        i += 2
        continue
      }
    }

    if (ch === "'" && !inDouble && !inTemplate) {
      inSingle = !inSingle
      out += ch
      i++
      continue
    }
    if (ch === '"' && !inSingle && !inTemplate) {
      inDouble = !inDouble
      out += ch
      i++
      continue
    }
    if (ch === "`" && !inSingle && !inDouble) {
      inTemplate = !inTemplate
      out += ch
      i++
      continue
    }

    out += ch
    i++
  }

  return out
}

function looksTechnical(str: string): boolean {
  const s = str.trim()
  if (s.length < 3) return true

  if (
    s.startsWith("/") ||
    s.startsWith("./") ||
    s.startsWith("../") ||
    s.includes("/api/") ||
    s.startsWith("http://") ||
    s.startsWith("https://") ||
    s.startsWith("file:")
  ) {
    return true
  }

  if (s.includes("process.env")) return true
  if (s === s.toUpperCase() && /[A-Z_]{3,}/.test(s)) return true

  if (/(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|PRAGMA)\b/i.test(s)) return true

  if (/^\w+\.(ts|tsx|js|jsx|json|csv|txt|md|log|sql|env)$/i.test(s)) return true

  if (/^[A-Za-z_]+:[A-Za-z_]+/.test(s)) return true

  if (/^[\w.-]+\|/.test(s) || /\|[\w.-]+$/.test(s)) return true

  if (/^[A-Z0-9_]+$/.test(s)) return true

  return false
}

function shouldSkipLine(line: string): boolean {
  const trimmed = line.trim()
  if (trimmed.startsWith("import ")) return true
  if (trimmed.startsWith("export ")) return true
  if (trimmed.startsWith("type ")) return true
  if (trimmed.startsWith("interface ")) return true
  if (trimmed.startsWith("enum ")) return true
  if (trimmed.startsWith("declare ")) return true
  if (trimmed.startsWith("namespace ")) return true
  if (trimmed.startsWith("@")) return true
  if (trimmed.includes("logger.") || trimmed.includes("console.")) return true
  if (trimmed.includes("throw new Error")) return true
  return false
}

function findStringLiterals(code: string): { text: string; index: number }[] {
  const results: { text: string; index: number }[] = []
  const regex = /(['"`])(?:\\.|(?!\1)[\s\S])*?\1/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(code))) {
    const raw = match[0]
    const text = raw.slice(1, -1)
    results.push({ text, index: match.index })
  }
  return results
}

function indexToLine(code: string, index: number): number {
  let line = 1
  for (let i = 0; i < index; i++) {
    if (code[i] === "\n") line++
  }
  return line
}

function shouldSkipLiteral(text: string): boolean {
  const s = text.trim()
  if (s.length < 3) return true
  if (looksTechnical(s)) return true

  if (/^[a-z0-9_]+(\.[a-z0-9_]+)+$/i.test(s)) return true

  if (/\$\{/.test(s)) return true

  if (/^[-+\d.,]+$/.test(s)) return true
  if (/^Markdown(V2)?$/.test(s)) return true
  if (/^[a-z0-9_]+$/.test(s)) return true
  if (/^[\n\r\s]+$/.test(s)) return true
  if (/^[─━\-=]{3,}$/.test(s)) return true
  if (/^\\n+$/i.test(s)) return true
  if (/^\\n\\n+$/i.test(s)) return true
  if (/^(en|ru|uk|es|pl)-[A-Z]{2}$/.test(s)) return true
  if (/^[A-Za-z]+\/[A-Za-z_]+$/.test(s)) return true
  if (/^\d{2}:\d{2}$/.test(s)) return true
  if (/^(utf-8|text\/csv|application\/[a-z0-9.+-]+)$/i.test(s)) return true
  if (/^\p{Emoji}+$/u.test(s)) return true
  if (/\}\)\}/.test(s)) return true

  const withoutEscapedNewlines = s.replace(/\\n/g, "").replace(/\s+/g, "")
  if (/^[─━\-=]+$/.test(withoutEscapedNewlines)) return true
  if (/^[})]+$/.test(withoutEscapedNewlines)) return true
  if (/ffmpeg/i.test(s)) return true
  if (/command not found|not recognized/i.test(s)) return true
  if (/brew install ffmpeg|apt-get install ffmpeg/i.test(s)) return true
  if (/user can use text input/i.test(s)) return true
  if (/^foreign key$/i.test(s)) return true
  if (/^uncaughtException$/i.test(s)) return true
  if (/^unhandledRejection$/i.test(s)) return true
  if (!/[A-Za-z0-9А-Яа-яЁёІіЇїЄє]/.test(s)) return true

  return false
}

function extractUsedKeys(code: string): string[] {
  const keys: string[] = []
  const keyRegexes = [
    /t\s*\(\s*[^,]+,\s*['"]([^'"\n]+)['"]/g,
    /tUser\s*\(\s*[^,]+,\s*['"]([^'"\n]+)['"]/g,
  ]
  for (const re of keyRegexes) {
    let m: RegExpExecArray | null
    while ((m = re.exec(code))) {
      const key = m[1]
      if (!key) continue
      if (key.includes("${")) continue
      if (!/^[a-z0-9_]+(\.[a-z0-9_]+)+$/i.test(key)) continue
      keys.push(key)
    }
  }
  return keys
}

async function main() {
  const locales: Record<Lang, any> = {
    en: await loadLocale("en"),
    ru: await loadLocale("ru"),
    uk: await loadLocale("uk"),
    es: await loadLocale("es"),
    pl: await loadLocale("pl"),
  }

  const enKeys = uniqSorted(flattenKeys(locales.en))

  let totalMissing = 0
  let totalExtra = 0
  let totalMissingUsed = 0
  let totalUnused = 0

  const report: string[] = []
  report.push("=== Translation Coverage Report ===")
  report.push("")
  report.push(`✓ en.ts (reference): ${enKeys.length} keys`)
  report.push("")

  for (const lang of LANGS) {
    if (lang === "en") continue
    const keys = uniqSorted(flattenKeys(locales[lang]))
    const missing = enKeys.filter((k) => !keys.includes(k))
    const extra = keys.filter((k) => !enKeys.includes(k))

    if (missing.length === 0 && extra.length === 0) {
      report.push(`${lang}.ts:`)
      report.push(`  ✓ Complete: ${keys.length}/${enKeys.length} keys`)
      report.push("")
    } else {
      report.push(`${lang}.ts:`)
      if (missing.length) {
        totalMissing += missing.length
        report.push(`  ✗ Missing keys (${missing.length}):`)
        for (const key of missing) report.push(`    - ${key}`)
      }
      if (extra.length) {
        totalExtra += extra.length
        report.push(`  ✗ Extra keys (${extra.length}):`)
        for (const key of extra) report.push(`    - ${key}`)
      }
      report.push("")
    }
  }

  report.push("=== Hardcoded Strings Report ===")
  report.push("")

  const files = walk(SRC_DIR)
  const hardcoded: Record<string, { line: number; text: string }[]> = {}
  const usedKeys = new Set<string>()

  for (const file of files) {
    const raw = fs.readFileSync(file, "utf8")
    const code = stripComments(raw)

    const lines = code.split("\n")
    const literalMatches = findStringLiterals(code)

    for (const match of literalMatches) {
      const line = indexToLine(code, match.index)
      const lineText = lines[line - 1] || ""
      if (shouldSkipLine(lineText)) continue

      const text = match.text
      if (shouldSkipLiteral(text)) continue

      if (!hardcoded[file]) hardcoded[file] = []
      hardcoded[file].push({ line, text })
    }

    for (const key of extractUsedKeys(code)) {
      usedKeys.add(key)
    }
  }

  const usedKeyFiles = walk(SRC_DIR, true)
  for (const file of usedKeyFiles) {
    const raw = fs.readFileSync(file, "utf8")
    const code = stripComments(raw)
    for (const key of extractUsedKeys(code)) {
      usedKeys.add(key)
    }
  }

  let hardcodedCount = 0
  const filesWithHardcoded = Object.keys(hardcoded).sort()
  if (filesWithHardcoded.length === 0) {
    report.push("No hardcoded strings found.")
    report.push("")
  } else {
    for (const file of filesWithHardcoded) {
      report.push(`${path.relative(ROOT, file)}:`)
      const entries = hardcoded[file] || []
      for (const entry of entries) {
        hardcodedCount++
        report.push(`  Line ${entry.line}: "${entry.text}"`)
      }
      report.push("")
    }
  }

  const categoryKeys = enKeys.filter(
    (k) => k.startsWith("categories.") || k.startsWith("categoriesShort.")
  )
  for (const key of categoryKeys) {
    usedKeys.add(key)
  }
  const usedKeysList = uniqSorted(Array.from(usedKeys))
  const missingUsedKeys = usedKeysList.filter((k) => !enKeys.includes(k))
  totalMissingUsed = missingUsedKeys.length
  const unusedKeys = enKeys.filter((k) => !usedKeys.has(k))
  totalUnused = unusedKeys.length

  report.push("=== Used Keys Report ===")
  report.push("")
  if (missingUsedKeys.length === 0) {
    report.push("No missing keys used in code.")
  } else {
    report.push(`Missing keys used in code (${missingUsedKeys.length}):`)
    for (const key of missingUsedKeys) report.push(`  - ${key}`)
  }
  report.push("")

  report.push("=== Unused Keys Report ===")
  report.push("")
  if (unusedKeys.length === 0) {
    report.push("No unused keys found.")
  } else {
    report.push(`Unused keys (${unusedKeys.length}):`)
    for (const key of unusedKeys) report.push(`  - ${key}`)
  }
  report.push("")

  report.push(
    `Total issues: ${totalMissing} missing keys, ${totalExtra} extra keys, ${totalMissingUsed} missing used keys, ${totalUnused} unused keys, ${hardcodedCount} hardcoded strings`
  )

  const reportText = report.join("\n")
  fs.writeFileSync(REPORT_FILE, reportText + "\n", "utf8")
  console.log(reportText)

  if (
    totalMissing > 0 ||
    totalExtra > 0 ||
    totalMissingUsed > 0 ||
    totalUnused > 0 ||
    hardcodedCount > 0
  ) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
