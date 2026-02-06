/**
 * Export formatters for Telegram messages
 */

import { ExportResult, ExportFormat } from "./types"
import { Language, t } from "../i18n"

function getLocale(lang: Language): string {
  switch (lang) {
    case "ru":
      return "ru-RU"
    case "uk":
      return "uk-UA"
    case "es":
      return "es-ES"
    case "pl":
      return "pl-PL"
    default:
      return "en-US"
  }
}

/**
 * Format export result message
 */
export function formatExportResult(
  lang: Language,
  result: ExportResult
): string {
  let message = t(lang, "export.result.title") + "\n\n"

  message += t(lang, "export.result.file", { filename: result.filename }) + "\n"
  message +=
    t(lang, "export.result.records", {
      count: result.recordCount,
    }) + "\n"
  message +=
    t(lang, "export.result.size", {
      size: formatFileSize(lang, result.data),
    }) + "\n"

  return message
}

/**
 * Format export menu
 */
export function formatExportMenu(lang: Language): string {
  let message = t(lang, "export.menu.title") + "\n\n"

  message += t(lang, "export.menu.chooseFormat") + "\n\n"

  message += t(lang, "export.menu.csvTitle") + "\n"
  message += t(lang, "export.menu.csvAll") + "\n"
  message += t(lang, "export.menu.csvExpenses") + "\n"
  message += t(lang, "export.menu.csvIncome") + "\n\n"

  message += t(lang, "export.menu.xlsxTitle") + "\n"
  message += t(lang, "export.menu.xlsxCategories") + "\n"
  message += t(lang, "export.menu.xlsxAutoSum") + "\n\n"

  message += t(lang, "export.menu.jsonTitle") + "\n"
  message += t(lang, "export.menu.jsonAll") + "\n"
  message += t(lang, "export.menu.jsonRestore") + "\n\n"

  message += t(lang, "export.menu.commands") + "\n"
  message += t(lang, "export.menu.commandCsv") + "\n"
  message += t(lang, "export.menu.commandXlsx") + "\n"
  message += t(lang, "export.menu.commandJson")

  return message
}

/**
 * Format export presets
 */
export function formatPresets(lang: Language): string {
  let message = t(lang, "export.presets.title") + "\n\n"

  message += t(lang, "export.presets.all") + "\n"
  message += t(lang, "export.presets.expenses") + "\n"
  message += t(lang, "export.presets.income") + "\n"
  message += t(lang, "export.presets.month") + "\n"
  message += t(lang, "export.presets.lastMonth") + "\n"
  message += t(lang, "export.presets.backup")

  return message
}

/**
 * Format file size
 */
function formatFileSize(lang: Language, data: Buffer | string): string {
  const bytes =
    typeof data === "string" ? Buffer.byteLength(data, "utf8") : data.length

  if (bytes < 1024) {
    return t(lang, "export.size.bytes", { count: bytes })
  } else if (bytes < 1024 * 1024) {
    return t(lang, "export.size.kb", { count: (bytes / 1024).toFixed(1) })
  } else {
    return t(lang, "export.size.mb", {
      count: (bytes / (1024 * 1024)).toFixed(1),
    })
  }
}

/**
 * Format export error
 */
export function formatExportError(lang: Language, error: Error): string {
  let message = t(lang, "export.error.title") + "\n\n"

  if (error.message.includes("No transactions")) {
    message += t(lang, "export.error.noTransactions")
  } else {
    message += t(lang, "export.error.generic", { error: error.message })
  }

  return message
}

/**
 * Format backup info
 */
export function formatBackupInfo(lang: Language, recordCount: number): string {
  let message = t(lang, "export.backup.title") + "\n\n"

  message += t(lang, "export.backup.records", { count: recordCount }) + "\n"
  message += t(lang, "export.backup.balances") + "\n"
  message += t(lang, "export.backup.debts") + "\n"
  message += t(lang, "export.backup.goals") + "\n"
  message += t(lang, "export.backup.budgets") + "\n"
  message += t(lang, "export.backup.incomeSources") + "\n\n"

  message += t(lang, "export.backup.keepSafe")

  return message
}

/**
 * Format restore confirmation
 */
export function formatRestoreConfirmation(
  lang: Language,
  backupDate: Date,
  recordCount: number
): string {
  let message = t(lang, "export.restore.title") + "\n\n"

  message +=
    t(lang, "export.restore.date", {
      date: backupDate.toLocaleDateString(getLocale(lang)),
    }) + "\n"
  message += t(lang, "export.restore.records", { count: recordCount }) + "\n\n"

  message += t(lang, "export.restore.warningTitle") + "\n"
  message += t(lang, "export.restore.warningReplace") + "\n"
  message += t(lang, "export.restore.warningIrreversible") + "\n\n"

  message += t(lang, "export.restore.confirmPrompt")

  return message
}

/**
 * Get format icon
 */
export function getFormatIcon(format: ExportFormat): string {
  const icons: Record<ExportFormat, string> = {
    csv: "📄",
    xlsx: "📊",
    json: "💾",
  }

  return icons[format] || "📄"
}

/**
 * Get format name
 */
export function getFormatName(format: ExportFormat): string {
  const names: Record<ExportFormat, string> = {
    csv: "CSV",
    xlsx: "Excel (XLSX)",
    json: "JSON",
  }

  return names[format] || format.toUpperCase()
}
