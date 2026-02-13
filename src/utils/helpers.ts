/**
 * General helper functions
 */

/**
 * Truncate a string to a maximum length and append ellipsis
 */
export function truncateString(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text
  }
  return `${text.slice(0, maxLength)}...`
}

/**
 * Check if a number is positive (greater than zero)
 */
export function isPositiveNumber(value: number): boolean {
  return (
    typeof value === "number" &&
    !Number.isNaN(value) &&
    Number.isFinite(value) &&
    value > 0
  )
}

/**
 * Round a number to 2 decimal places
 */
export function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100
}
