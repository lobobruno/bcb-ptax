import type { PTAXRate } from './types.js';
import { parseDate } from './utils/date.js';

const HTML_DATE_REGEX = /(\d{2}\/\d{2}\/\d{4})\s+[àa]s/;
const HTML_ROW_REGEX =
  /<tr[^>]*>\s*<td[^>]*>(.*?)<\/td>\s*<td[^>]*>(.*?)<\/td>\s*<td[^>]*>(.*?)<\/td>\s*<td[^>]*>(.*?)<\/td>\s*<td[^>]*>(.*?)<\/td>\s*<td[^>]*>(.*?)<\/td>\s*<td[^>]*>(.*?)<\/td>\s*<\/tr>/gi;

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
 * Parses the HTML page from BCB PTAX into an array of PTAXRate objects
 */
export function parseHTML(html: string): PTAXRate[] {
  const dateMatch = html.match(HTML_DATE_REGEX);
  if (!dateMatch) {
    return [];
  }

  const date = parseDate(dateMatch[1]);
  const rates: PTAXRate[] = [];

  for (
    let match = HTML_ROW_REGEX.exec(html);
    match !== null;
    match = HTML_ROW_REGEX.exec(html)
  ) {
    const [
      ,
      codeStr,
      type,
      currency,
      buyRate,
      sellRate,
      buyParity,
      sellParity,
    ] = match;

    const currencyCode = parseInt(codeStr.trim(), 10);
    if (Number.isNaN(currencyCode)) continue;

    const trimmedType = type.trim();
    if (trimmedType !== 'A' && trimmedType !== 'B') continue;

    rates.push({
      date,
      currencyCode,
      currencyType: trimmedType,
      currency: currency.trim(),
      buyRate: parseNumber(buyRate.trim()),
      sellRate: parseNumber(sellRate.trim()),
      buyParity: parseNumber(buyParity.trim()),
      sellParity: parseNumber(sellParity.trim()),
    });
  }

  return rates;
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
