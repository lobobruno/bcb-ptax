import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as client from '../src/client.js';
import { convert, getRate, getSupportedCurrencies } from '../src/converter.js';
import { CurrencyNotFoundError } from '../src/errors.js';
import type { PTAXRate } from '../src/types.js';

// Mock rates for testing
const mockRates: PTAXRate[] = [
  {
    date: new Date(2025, 11, 15),
    currencyCode: 220,
    currencyType: 'A',
    currency: 'USD',
    buyRate: 5.0,
    sellRate: 5.1,
    buyParity: 1,
    sellParity: 1,
  },
  {
    date: new Date(2025, 11, 15),
    currencyCode: 978,
    currencyType: 'B',
    currency: 'EUR',
    buyRate: 6.0,
    sellRate: 6.12,
    buyParity: 1.2,
    sellParity: 1.2,
  },
];

describe('getRate', () => {
  beforeEach(() => {
    vi.spyOn(client, 'getLatestRates').mockResolvedValue(mockRates);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return rate for valid currency', async () => {
    const rate = await getRate('USD');
    expect(rate.currency).toBe('USD');
    expect(rate.buyRate).toBe(5.0);
    expect(rate.sellRate).toBe(5.1);
  });

  it('should be case insensitive', async () => {
    const rate = await getRate('usd');
    expect(rate.currency).toBe('USD');
  });

  it('should throw CurrencyNotFoundError for invalid currency', async () => {
    await expect(getRate('INVALID')).rejects.toThrow(CurrencyNotFoundError);
  });
});

describe('getSupportedCurrencies', () => {
  beforeEach(() => {
    vi.spyOn(client, 'getLatestRates').mockResolvedValue(mockRates);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return sorted list of currencies', async () => {
    const currencies = await getSupportedCurrencies();
    expect(currencies).toEqual(['EUR', 'USD']);
  });
});

describe('convert', () => {
  beforeEach(() => {
    vi.spyOn(client, 'getLatestRates').mockResolvedValue(mockRates);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return same amount for same currency', async () => {
    const result = await convert(100, 'USD', 'USD');
    expect(result.result).toBe(100);
    expect(result.rate).toBe(1);
  });

  it('should convert BRL to foreign currency', async () => {
    // 100 BRL / 5.1 (sell rate) = ~19.61 USD
    const result = await convert(100, 'BRL', 'USD');
    expect(result.result).toBeCloseTo(19.61, 2);
    expect(result.rate).toBe(5.1);
    expect(result.rateType).toBe('sell');
  });

  it('should convert foreign currency to BRL', async () => {
    // 100 USD * 5.1 (sell rate) = 510 BRL
    const result = await convert(100, 'USD', 'BRL');
    expect(result.result).toBeCloseTo(510, 2);
    expect(result.rate).toBe(5.1);
  });

  it('should use buy rate when specified', async () => {
    // 100 USD * 5.0 (buy rate) = 500 BRL
    const result = await convert(100, 'USD', 'BRL', { rateType: 'buy' });
    expect(result.result).toBe(500);
    expect(result.rate).toBe(5.0);
    expect(result.rateType).toBe('buy');
  });

  it('should perform cross-rate conversion', async () => {
    // 100 EUR -> BRL -> USD
    // 100 * 6.12 / 5.1 = 120 USD
    const result = await convert(100, 'EUR', 'USD');
    expect(result.result).toBeCloseTo(120, 2);
    expect(result.rate).toBeCloseTo(1.2, 2);
  });

  it('should include date in result', async () => {
    const result = await convert(100, 'USD', 'BRL');
    expect(result.date.getFullYear()).toBe(2025);
    expect(result.date.getMonth()).toBe(11);
    expect(result.date.getDate()).toBe(15);
  });

  it('should throw for invalid currency', async () => {
    await expect(convert(100, 'INVALID', 'BRL')).rejects.toThrow(
      CurrencyNotFoundError
    );
  });

  it('should be case insensitive', async () => {
    const result = await convert(100, 'usd', 'brl');
    expect(result.from).toBe('USD');
    expect(result.to).toBe('BRL');
    expect(result.result).toBeCloseTo(510, 2);
  });
});
