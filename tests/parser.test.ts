import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseCSV } from '../src/parser.js';

describe('parseCSV', () => {
  it('should parse sample CSV file correctly', () => {
    const csv = readFileSync(join(__dirname, 'fixtures/sample.csv'), 'utf-8');
    const rates = parseCSV(csv);

    expect(rates).toHaveLength(5);

    // Check USD rate
    const usd = rates.find((r) => r.currency === 'USD');
    expect(usd).toBeDefined();
    expect(usd?.currencyCode).toBe(220);
    expect(usd?.currencyType).toBe('A');
    expect(usd?.buyRate).toBeCloseTo(5.3923, 4);
    expect(usd?.sellRate).toBeCloseTo(5.3929, 4);
    expect(usd?.buyParity).toBe(1);
    expect(usd?.sellParity).toBe(1);
  });

  it('should parse EUR with type B', () => {
    const csv = readFileSync(join(__dirname, 'fixtures/sample.csv'), 'utf-8');
    const rates = parseCSV(csv);

    const eur = rates.find((r) => r.currency === 'EUR');
    expect(eur).toBeDefined();
    expect(eur?.currencyType).toBe('B');
    expect(eur?.buyRate).toBeCloseTo(6.3424, 4);
    expect(eur?.sellRate).toBeCloseTo(6.3442, 4);
  });

  it('should parse dates correctly', () => {
    const csv = readFileSync(join(__dirname, 'fixtures/sample.csv'), 'utf-8');
    const rates = parseCSV(csv);

    const usd = rates.find((r) => r.currency === 'USD');
    expect(usd?.date.getFullYear()).toBe(2025);
    expect(usd?.date.getMonth()).toBe(11); // December
    expect(usd?.date.getDate()).toBe(15);
  });

  it('should handle empty lines', () => {
    const csv = `15/12/2025;220;A;USD;5,39230000;5,39290000;1,00000000;1,00000000

15/12/2025;978;B;EUR;6,34240000;6,34420000;1,17620000;1,17640000
`;
    const rates = parseCSV(csv);
    expect(rates).toHaveLength(2);
  });

  it('should handle empty input', () => {
    const rates = parseCSV('');
    expect(rates).toHaveLength(0);
  });

  it('should skip invalid lines', () => {
    const csv = `15/12/2025;220;A;USD;5,39230000;5,39290000;1,00000000;1,00000000
invalid line
15/12/2025;978;B;EUR;6,34240000;6,34420000;1,17620000;1,17640000`;
    const rates = parseCSV(csv);
    expect(rates).toHaveLength(2);
  });

  it('should parse JPY with small rate correctly', () => {
    const csv = readFileSync(join(__dirname, 'fixtures/sample.csv'), 'utf-8');
    const rates = parseCSV(csv);

    const jpy = rates.find((r) => r.currency === 'JPY');
    expect(jpy).toBeDefined();
    expect(jpy?.buyRate).toBeCloseTo(0.03521, 5);
    expect(jpy?.buyParity).toBeCloseTo(153.18, 2);
  });
});
