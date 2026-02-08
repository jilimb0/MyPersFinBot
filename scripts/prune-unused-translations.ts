import fs from "fs"
import path from "path"

const ROOT = process.cwd()
const LOCALES_DIR = path.join(ROOT, "src", "i18n", "locales")
const SRC_DIR = path.join(ROOT, "src")

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
  const modulePath = `../src/i18n/locales/${lang}`
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

function walk(dir: string): string[] {
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
      results.push(...walk(full))
    } else if (entry.isFile()) {
      if (full.endsWith(".ts") || full.endsWith(".tsx")) {
        if (full.startsWith(LOCALES_DIR)) continue
        if (isTestOrTypePath(full)) continue
        if (full.endsWith(`${path.sep}index-old.ts`)) continue
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

function pruneObject(obj: any, allowed: Set<string>, prefix = ""): any {
  if (obj == null || typeof obj !== "object") return obj
  const out: any = Array.isArray(obj) ? [] : {}
  for (const [key, value] of Object.entries(obj)) {
    const next = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const nested = pruneObject(value, allowed, next)
      if (nested && Object.keys(nested).length > 0) {
        out[key] = nested
      }
    } else {
      if (allowed.has(next)) {
        out[key] = value
      }
    }
  }
  return out
}

async function main() {
  const files = walk(SRC_DIR)
  const usedKeys = new Set<string>()

  for (const file of files) {
    const raw = fs.readFileSync(file, "utf8")
    const code = stripComments(raw)
    for (const key of extractUsedKeys(code)) {
      usedKeys.add(key)
    }
  }

  const usedKeyList = uniqSorted(Array.from(usedKeys))
  const enLocale = await loadLocale("en")
  const enKeys = uniqSorted(flattenKeys(enLocale))
  const categoryKeys = enKeys.filter(
    (k) => k.startsWith("categories.") || k.startsWith("categoriesShort.")
  )
  const allowed = new Set<string>([...usedKeyList, ...categoryKeys])

  for (const lang of LANGS) {
    const locale = await loadLocale(lang)
    const pruned = pruneObject(locale, allowed)
    const outPath = path.join(LOCALES_DIR, `${lang}.ts`)
    const content = `export const ${lang} = ${JSON.stringify(
      pruned,
      null,
      2
    )}\n`
    fs.writeFileSync(outPath, content, "utf8")
    const removed =
      flattenKeys(locale).length - flattenKeys(pruned).length
    console.log(`✔ ${lang}.ts pruned (${removed} keys removed)`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
