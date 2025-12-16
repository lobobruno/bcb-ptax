import { describe, expect, it } from 'vitest';
import {
  formatDateForUrl,
  formatDateKey,
  parseDate,
  subDays,
} from '../src/utils/date.js';

describe('formatDateForUrl', () => {
  it('should format date as YYYYMMDD', () => {
    const date = new Date(2025, 11, 15); // December 15, 2025
    expect(formatDateForUrl(date)).toBe('20251215');
  });

  it('should pad single digit month and day', () => {
    const date = new Date(2025, 0, 5); // January 5, 2025
    expect(formatDateForUrl(date)).toBe('20250105');
  });
});

describe('parseDate', () => {
  it('should parse DD/MM/YYYY format', () => {
    const date = parseDate('15/12/2025');
    expect(date.getFullYear()).toBe(2025);
    expect(date.getMonth()).toBe(11); // December (0-indexed)
    expect(date.getDate()).toBe(15);
  });

  it('should parse single digit day and month', () => {
    const date = parseDate('05/01/2025');
    expect(date.getFullYear()).toBe(2025);
    expect(date.getMonth()).toBe(0); // January
    expect(date.getDate()).toBe(5);
  });
});

describe('subDays', () => {
  it('should subtract days from a date', () => {
    const date = new Date(2025, 11, 15);
    const result = subDays(date, 3);
    expect(result.getDate()).toBe(12);
  });

  it('should handle month boundaries', () => {
    const date = new Date(2025, 11, 1); // December 1
    const result = subDays(date, 1);
    expect(result.getMonth()).toBe(10); // November
    expect(result.getDate()).toBe(30);
  });

  it('should not mutate the original date', () => {
    const date = new Date(2025, 11, 15);
    subDays(date, 3);
    expect(date.getDate()).toBe(15);
  });
});

describe('formatDateKey', () => {
  it('should format date as YYYY-MM-DD', () => {
    const date = new Date(2025, 11, 15);
    expect(formatDateKey(date)).toBe('2025-12-15');
  });

  it('should pad single digit month and day', () => {
    const date = new Date(2025, 0, 5);
    expect(formatDateKey(date)).toBe('2025-01-05');
  });
});
