import { DataUnavailableError } from './errors.js';
import { parseCSV, parseHTML } from './parser.js';
import type { CacheEntry, PTAXOptions, PTAXRate } from './types.js';
import { formatDateForUrl, formatDateKey, subDays } from './utils/date.js';

const BCB_BASE_URL = 'https://www4.bcb.gov.br/Download/fechamento';
const BCB_HTML_URL =
  'https://ptax.bcb.gov.br/ptax_internet/consultarTodasAsMoedas.do?method=consultaTodasMoedas';
const DEFAULT_MAX_RETRIES = 5;
const DEFAULT_TIMEOUT = 10000;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// In-memory cache
const cache = new Map<string, CacheEntry>();

/**
 * Builds the BCB URL for a specific date
 */
function buildUrl(date: Date): string {
  return `${BCB_BASE_URL}/${formatDateForUrl(date)}.csv`;
}

/**
 * Gets cached data if available and not expired
 */
function getCached(dateKey: string): PTAXRate[] | null {
  const entry = cache.get(dateKey);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data;
  }
  if (entry) {
    cache.delete(dateKey);
  }
  return null;
}

/**
 * Stores data in the cache
 */
function setCache(dateKey: string, data: PTAXRate[]): void {
  cache.set(dateKey, { data, timestamp: Date.now() });
}

/**
 * Clears the entire cache
 */
export function clearCache(): void {
  cache.clear();
}

/**
 * Fetches PTAX rates from the HTML fallback page
 */
async function fetchFromHtmlFallback(timeout: number): Promise<PTAXRate[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  const response = await fetch(BCB_HTML_URL, { signal: controller.signal });
  clearTimeout(timeoutId);

  if (!response.ok) {
    return [];
  }

  const buffer = await response.arrayBuffer();
  const html = new TextDecoder('iso-8859-1').decode(buffer);
  return parseHTML(html);
}

/**
 * Checks if two dates are the same calendar day
 */
function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Fetches PTAX data from BCB with retry logic for weekends/holidays
 */
export async function fetchRates(
  startDate: Date = new Date(),
  options: PTAXOptions = {}
): Promise<{ rates: PTAXRate[]; actualDate: Date }> {
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;

  let currentDate = new Date(startDate);

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const dateKey = formatDateKey(currentDate);

    // Check cache first
    const cachedData = getCached(dateKey);
    if (cachedData) {
      return { rates: cachedData, actualDate: new Date(currentDate) };
    }

    const url = buildUrl(currentDate);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const text = await response.text();
        const rates = parseCSV(text);

        if (rates.length > 0) {
          setCache(dateKey, rates);
          return { rates, actualDate: new Date(currentDate) };
        }
      }
    } catch (error) {
      // Network error or timeout - continue to next day
      if (error instanceof Error && error.name === 'AbortError') {
        // Timeout - continue to next day
      }
      // Other errors - continue to next day
    }

    // Go back one day
    currentDate = subDays(currentDate, 1);
  }

  // Try HTML fallback for today's date when CSV is unavailable
  if (options.useFallback !== false && isSameDay(startDate, new Date())) {
    try {
      const fallbackRates = await fetchFromHtmlFallback(timeout);
      if (fallbackRates.length > 0) {
        const today = new Date();
        const dateKey = formatDateKey(today);
        setCache(dateKey, fallbackRates);
        return { rates: fallbackRates, actualDate: today };
      }
    } catch {
      // Fallback also failed, fall through to throw
    }
  }

  throw new DataUnavailableError(maxRetries);
}

/**
 * Fetches all exchange rates from the most recent available date
 */
export async function getLatestRates(
  options?: PTAXOptions
): Promise<PTAXRate[]> {
  const { rates } = await fetchRates(new Date(), options);
  return rates;
}

/**
 * Fetches all exchange rates for a specific date (with retry fallback)
 */
export async function getRatesByDate(
  date: Date,
  options?: PTAXOptions
): Promise<PTAXRate[]> {
  const { rates } = await fetchRates(date, options);
  return rates;
}
