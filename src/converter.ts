import { getLatestRates } from './client.js';
import { CurrencyNotFoundError } from './errors.js';
import type {
  ConversionResult,
  ConvertOptions,
  PTAXOptions,
  PTAXRate,
} from './types.js';

/**
 * Finds a rate by currency code
 */
function findRate(rates: PTAXRate[], currency: string): PTAXRate {
  const rate = rates.find(
    (r) => r.currency.toUpperCase() === currency.toUpperCase()
  );
  if (!rate) {
    throw new CurrencyNotFoundError(currency);
  }
  return rate;
}

/**
 * Gets the exchange rate for a specific currency
 */
export async function getRate(
  currency: string,
  options?: PTAXOptions
): Promise<PTAXRate> {
  const rates = await getLatestRates(options);
  return findRate(rates, currency);
}

/**
 * Gets the list of supported currency codes
 */
export async function getSupportedCurrencies(
  options?: PTAXOptions
): Promise<string[]> {
  const rates = await getLatestRates(options);
  return rates.map((r) => r.currency).sort();
}

/**
 * Converts an amount between currencies using BRL as the base
 *
 * @param amount - The amount to convert
 * @param from - Source currency code (e.g., 'USD', 'BRL')
 * @param to - Target currency code (e.g., 'BRL', 'EUR')
 * @param options - Conversion options
 * @returns Conversion result with rate details
 */
export async function convert(
  amount: number,
  from: string,
  to: string,
  options?: ConvertOptions
): Promise<ConversionResult> {
  const rateType = options?.rateType ?? 'sell';
  const rates = await getLatestRates(options);

  const fromUpper = from.toUpperCase();
  const toUpper = to.toUpperCase();

  // Same currency - no conversion needed
  if (fromUpper === toUpper) {
    return {
      from: fromUpper,
      to: toUpper,
      amount,
      result: amount,
      rate: 1,
      rateType,
      date: rates[0]?.date ?? new Date(),
    };
  }

  // BRL -> Foreign: divide by rate
  if (fromUpper === 'BRL') {
    const toRate = findRate(rates, toUpper);
    const rate = rateType === 'buy' ? toRate.buyRate : toRate.sellRate;
    return {
      from: fromUpper,
      to: toUpper,
      amount,
      result: amount / rate,
      rate,
      rateType,
      date: toRate.date,
    };
  }

  // Foreign -> BRL: multiply by rate
  if (toUpper === 'BRL') {
    const fromRate = findRate(rates, fromUpper);
    const rate = rateType === 'buy' ? fromRate.buyRate : fromRate.sellRate;
    return {
      from: fromUpper,
      to: toUpper,
      amount,
      result: amount * rate,
      rate,
      rateType,
      date: fromRate.date,
    };
  }

  // Cross-rate: Foreign -> BRL -> Foreign
  const fromRate = findRate(rates, fromUpper);
  const toRate = findRate(rates, toUpper);

  const fromRateValue =
    rateType === 'buy' ? fromRate.buyRate : fromRate.sellRate;
  const toRateValue = rateType === 'buy' ? toRate.buyRate : toRate.sellRate;

  const brlAmount = amount * fromRateValue;
  const result = brlAmount / toRateValue;
  const crossRate = fromRateValue / toRateValue;

  return {
    from: fromUpper,
    to: toUpper,
    amount,
    result,
    rate: crossRate,
    rateType,
    date: fromRate.date,
  };
}
