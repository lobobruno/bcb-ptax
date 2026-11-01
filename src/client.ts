import {
  CurrencyNotFoundError,
  DataUnavailableError,
  PTAXError,
} from './errors.js';
import { parseCSV, parseHTML } from './parser.js';
import type {
  CacheEntry,
  PeriodOptions,
  PTAXOptions,
  PTAXRate,
} from './types.js';
import {
  addDays,
  formatDateForUrl,
  formatDateKey,
  isWeekend,
  startOfDay,
  subDays,
} from './utils/date.js';

const BCB_BASE_URL = 'https://www4.bcb.gov.br/Download/fechamento';
const BCB_HTML_URL =
  'https://ptax.bcb.gov.br/ptax_internet/consultarTodasAsMoedas.do?method=consultaTodasMoedas';
const DEFAULT_MAX_RETRIES = 5;
const DEFAULT_TIMEOUT = 10000;
const DEFAULT_CONCURRENCY = 5;
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
 * Fetches the CSV for exactly one day (no retry). Returns null when BCB has
 * no data for that day (weekend, holiday or not yet published) and throws on
 * network errors or timeouts.
 */
async function fetchDay(
  date: Date,
  timeout: number
): Promise<PTAXRate[] | null> {
  const dateKey = formatDateKey(date);

  // Check cache first
  const cachedData = getCached(dateKey);
  if (cachedData) {
    return cachedData;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(buildUrl(date), {
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    const rates = parseCSV(await response.text());
    if (rates.length === 0) {
      return null;
    }

    setCache(dateKey, rates);
    return rates;
  } finally {
    clearTimeout(timeoutId);
  }
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
    try {
      const rates = await fetchDay(currentDate, timeout);
      if (rates) {
        return { rates, actualDate: new Date(currentDate) };
      }
    } catch {
      // Network error or timeout - continue to next day
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

/**
 * Fetches all rates of one currency between two dates (inclusive), one entry
 * per business day, sorted by date. Weekends are skipped without a request;
 * holidays are skipped when BCB has no file for them.
 *
 * @param currency - ISO currency code (e.g., 'USD')
 * @param from - First day of the period
 * @param to - Last day of the period
 * @param options - Request options
 * @returns Rates for the period, or an empty array if BCB has no data in it
 */
export async function getRatesByPeriod(
  currency: string,
  from: Date,
  to: Date,
  options: PeriodOptions = {}
): Promise<PTAXRate[]> {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;
  const concurrency = Math.max(1, options.concurrency ?? DEFAULT_CONCURRENCY);
  const currencyUpper = currency.toUpperCase();

  const start = startOfDay(from);
  const end = startOfDay(to);
  if (start > end) {
    throw new PTAXError('`from` must be on or before `to`');
  }

  const days: Date[] = [];
  for (let day = start; day <= end; day = addDays(day, 1)) {
    if (!isWeekend(day)) {
      days.push(day);
    }
  }

  const results: (PTAXRate[] | null)[] = new Array(days.length).fill(null);
  let next = 0;
  const worker = async () => {
    while (next < days.length) {
      const index = next++;
      results[index] = await fetchDay(days[index], timeout);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, days.length) }, worker)
  );

  const available = results.filter((r): r is PTAXRate[] => r !== null);
  const rates = available
    .map((dayRates) =>
      dayRates.find((r) => r.currency.toUpperCase() === currencyUpper)
    )
    .filter((r): r is PTAXRate => r !== undefined);

  if (available.length > 0 && rates.length === 0) {
    throw new CurrencyNotFoundError(currency);
  }

  return rates;
}
