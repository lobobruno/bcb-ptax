import type { PTAXRate } from './types.js';
import { parseDate } from './utils/date.js';

/**
 * Parses a Brazilian number format (comma as decimal separator) to a JavaScript number
 */
function parseNumber(value: string): number {
  return parseFloat(value.replace(',', '.'));
}

/**
 * Parses a single CSV line into a PTAXRate object
 */
function parseLine(line: string): PTAXRate | null {
  const parts = line.split(';');

  if (parts.length < 8) {
    return null;
  }

  const [
    dateStr,
    code,
    type,
    currency,
    buyRate,
    sellRate,
    buyParity,
    sellParity,
  ] = parts;

  // Validate type
  if (type !== 'A' && type !== 'B') {
    return null;
  }

  return {
    date: parseDate(dateStr),
    currencyCode: parseInt(code, 10),
    currencyType: type,
    currency: currency.trim(),
    buyRate: parseNumber(buyRate),
    sellRate: parseNumber(sellRate),
    buyParity: parseNumber(buyParity),
    sellParity: parseNumber(sellParity),
  };
}

/**
 * Parses the CSV content from BCB into an array of PTAXRate objects
 */
export function parseCSV(csv: string): PTAXRate[] {
  const lines = csv.trim().split('\n');
  const rates: PTAXRate[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    const rate = parseLine(trimmedLine);
    if (rate) {
      rates.push(rate);
    }
  }

  return rates;
}
