import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearCache, fetchRates } from '../src/client.js';
import { DataUnavailableError } from '../src/errors.js';

describe('fetchRates', () => {
  beforeEach(() => {
    clearCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should fetch and parse rates from BCB', async () => {
    const mockCsv = `15/12/2025;220;A;USD;5,39230000;5,39290000;1,00000000;1,00000000
15/12/2025;978;B;EUR;6,34240000;6,34420000;1,17620000;1,17640000`;

    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(mockCsv),
    } as Response);

    const { rates } = await fetchRates(new Date(2025, 11, 15));

    expect(rates).toHaveLength(2);
    expect(rates[0].currency).toBe('USD');
    expect(rates[1].currency).toBe('EUR');
  });

  it('should retry on 404 and go back days', async () => {
    const mockCsv = `14/12/2025;220;A;USD;5,39230000;5,39290000;1,00000000;1,00000000`;

    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({ ok: false, status: 404 } as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockCsv),
      } as Response);

    const { rates, actualDate } = await fetchRates(new Date(2025, 11, 15));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(rates).toHaveLength(1);
    expect(actualDate.getDate()).toBe(14);
  });

  it('should throw DataUnavailableError after max retries', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);

    await expect(
      fetchRates(new Date(2025, 11, 15), { maxRetries: 3 })
    ).rejects.toThrow(DataUnavailableError);
  });

  it('should use cached data on subsequent calls', async () => {
    const mockCsv = `15/12/2025;220;A;USD;5,39230000;5,39290000;1,00000000;1,00000000`;

    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(mockCsv),
    } as Response);

    // First call
    await fetchRates(new Date(2025, 11, 15));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Second call - should use cache
    await fetchRates(new Date(2025, 11, 15));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('should handle network errors gracefully', async () => {
    const mockCsv = `14/12/2025;220;A;USD;5,39230000;5,39290000;1,00000000;1,00000000`;

    vi.spyOn(global, 'fetch')
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockCsv),
      } as Response);

    const { rates } = await fetchRates(new Date(2025, 11, 15));
    expect(rates).toHaveLength(1);
  });
});

describe('clearCache', () => {
  it('should clear the cache', async () => {
    const mockCsv = `15/12/2025;220;A;USD;5,39230000;5,39290000;1,00000000;1,00000000`;

    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(mockCsv),
    } as Response);

    // First call
    await fetchRates(new Date(2025, 11, 15));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Clear cache
    clearCache();

    // Second call - should fetch again
    await fetchRates(new Date(2025, 11, 15));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
