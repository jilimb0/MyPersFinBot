/**
 * Export formatters for Telegram messages
 */

import { ExportResult, ExportFormat } from "./types"

/**
 * Format export result message
 */
export function formatExportResult(result: ExportResult): string {
  let message = "✅ *Экспорт завершён*\n\n"

  message += `📄 Файл: \`${result.filename}\`\n`
  message += `📊 Записей: ${result.recordCount}\n`
  message += `📦 Размер: ${formatFileSize(result.data)}\n`

  return message
}

/**
 * Format export menu
 */
export function formatExportMenu(): string {
  let message = "📤 *Экспорт данных*\n\n"

  message += "Выберите формат:\n\n"

  message += "📄 *CSV* - Таблица (Excel, Google Sheets)\n"
  message += "  • Все транзакции\n"
  message += "  • Только расходы\n"
  message += "  • Только доходы\n\n"

  message += "📊 *XLSX* - Excel с формулами\n"
  message += "  • Разбивка по категориям\n"
  message += "  • Автосуммы\n\n"

  message += "💾 *JSON* - Полный backup\n"
  message += "  • Все данные\n"
  message += "  • Для восстановления\n\n"

  message += "Команды:\n"
  message += "`/export csv` - CSV экспорт\n"
  message += "`/export xlsx` - Excel экспорт\n"
  message += "`/export json` - JSON backup\n"

  return message
}

/**
 * Format export presets
 */
export function formatPresets(): string {
  let message = "📋 *Быстрый экспорт*\n\n"

  message += "1️⃣ `/export_all` - Все транзакции\n"
  message += "2️⃣ `/export_expenses` - Только расходы\n"
  message += "3️⃣ `/export_income` - Только доходы\n"
  message += "4️⃣ `/export_month` - Текущий месяц\n"
  message += "5️⃣ `/export_last_month` - Прошлый месяц\n"
  message += "6️⃣ `/backup` - Полный backup\n"

  return message
}

/**
 * Format file size
 */
function formatFileSize(data: Buffer | string): string {
  const bytes =
    typeof data === "string" ? Buffer.byteLength(data, "utf8") : data.length

  if (bytes < 1024) {
    return `${bytes} B`
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }
}

/**
 * Format export error
 */
export function formatExportError(error: Error): string {
  let message = "❌ *Ошибка экспорта*\n\n"

  if (error.message.includes("No transactions")) {
    message += "Нет транзакций для экспорта.\n"
    message += "Добавьте транзакции и попробуйте снова."
  } else {
    message += `Произошла ошибка: ${error.message}`
  }

  return message
}

/**
 * Format backup info
 */
export function formatBackupInfo(recordCount: number): string {
  let message = "💾 *Создание backup*\n\n"

  message += `📊 Транзакций: ${recordCount}\n`
  message += "✅ Балансы\n"
  message += "✅ Долги\n"
  message += "✅ Цели\n"
  message += "✅ Бюджеты\n"
  message += "✅ Источники дохода\n\n"

  message += "⚠️ Сохраните файл в надёжном месте!"

  return message
}

/**
 * Format restore confirmation
 */
export function formatRestoreConfirmation(
  backupDate: Date,
  recordCount: number
): string {
  let message = "⚠️ *Восстановление из backup*\n\n"

  message += `📅 Дата backup: ${backupDate.toLocaleDateString("ru-RU")}\n`
  message += `📊 Транзакций: ${recordCount}\n\n`

  message += "⚠️ *ВНИМАНИЕ!*\n"
  message += "Текущие данные будут заменены.\n"
  message += "Это действие необратимо.\n\n"

  message += "Подтвердите восстановление:"

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
