/**
 * Date formatting utilities for reports
 */

/**
 * Formats a date to DD.MM format
 * @param date - Date to format
 * @returns Formatted date string (e.g., "17.01")
 */
export function formatDate(date: Date): string {
  const day = date.getDate().toString().padStart(2, "0")
  const month = (date.getMonth() + 1).toString().padStart(2, "0")
  return `${day}.${month}`
}

/**
 * Formats a date to DD.MM.YYYY format
 * @param date - Date to format
 * @returns Formatted date string (e.g., "17.01.2026")
 */
export function formatFullDate(date: Date): string {
  const day = date.getDate().toString().padStart(2, "0")
  const month = (date.getMonth() + 1).toString().padStart(2, "0")
  const year = date.getFullYear()
  return `${day}.${month}.${year}`
}

/**
 * Gets the number of days in a month
 * @param year - Year
 * @param month - Month (0-11)
 * @returns Number of days in the month
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

/**
 * Gets the first day of a month
 * @param year - Year
 * @param month - Month (0-11)
 * @returns First day of the month as Date
 */
export function getFirstDayOfMonth(year: number, month: number): Date {
  return new Date(year, month, 1)
}

/**
 * Gets the last day of a month
 * @param year - Year
 * @param month - Month (0-11)
 * @returns Last day of the month as Date
 */
export function getLastDayOfMonth(year: number, month: number): Date {
  return new Date(year, month + 1, 0)
}
