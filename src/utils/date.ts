/**
 * Formats a Date object to YYYYMMDD string for BCB URL
 */
export function formatDateForUrl(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Parses a date string in DD/MM/YYYY format to a Date object
 */
export function parseDate(dateStr: string): Date {
  const [day, month, year] = dateStr.split('/');
  return new Date(
    parseInt(year, 10),
    parseInt(month, 10) - 1,
    parseInt(day, 10)
  );
}

/**
 * Subtracts days from a date and returns a new Date
 */
export function subDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
}

/**
 * Adds days to a date and returns a new Date
 */
export function addDays(date: Date, days: number): Date {
  return subDays(date, -days);
}

/**
 * Returns a new Date set to midnight (local time) of the same day
 */
export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Checks if a date falls on Saturday or Sunday
 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * Formats a Date to YYYY-MM-DD string (for cache keys)
 */
export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
