import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearCache,
  fetchRates,
  getRatesByDate,
  getRatesByPeriod,
} from '../src/client.js';
import {
  CurrencyNotFoundError,
  DataUnavailableError,
  PTAXError,
} from '../src/errors.js';

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
      fetchRates(new Date(2025, 11, 15), { maxRetries: 3, useFallback: false })
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

describe('HTML fallback', () => {
  beforeEach(() => {
    clearCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const todayStr = (() => {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  })();

  const mockHtml = `<strong>${todayStr} as 13:00</strong>
    <table>
      <tr><td>220</td><td>A</td><td>USD</td><td>5,3923</td><td>5,3929</td><td>1,0000</td><td>1,0000</td></tr>
      <tr><td>978</td><td>B</td><td>EUR</td><td>6,3424</td><td>6,3442</td><td>1,1762</td><td>1,1764</td></tr>
    </table>`;

  function mockFetchByUrl(
    csvResponse: Partial<Response> | Error,
    htmlResponse: Partial<Response> | Error
  ) {
    return vi.spyOn(global, 'fetch').mockImplementation((input) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      if (url.includes('ptax.bcb.gov.br')) {
        if (htmlResponse instanceof Error) return Promise.reject(htmlResponse);
        return Promise.resolve(htmlResponse as Response);
      }
      if (csvResponse instanceof Error) return Promise.reject(csvResponse);
      return Promise.resolve(csvResponse as Response);
    });
  }

  it('should fall back to HTML when CSV fails for today', async () => {
    mockFetchByUrl(
      { ok: false, status: 404 } as Response,
      {
        ok: true,
        text: () => Promise.resolve(mockHtml),
        arrayBuffer: () =>
          Promise.resolve(new TextEncoder().encode(mockHtml).buffer),
      } as unknown as Response
    );

    const { rates } = await fetchRates(new Date(), { maxRetries: 1 });

    expect(rates).toHaveLength(2);
    expect(rates[0].currency).toBe('USD');
    expect(rates[1].currency).toBe('EUR');
  });

  it('should NOT fall back for historical dates', async () => {
    const fetchMock = mockFetchByUrl(
      { ok: false, status: 404 } as Response,
      {
        ok: true,
        text: () => Promise.resolve(mockHtml),
        arrayBuffer: () =>
          Promise.resolve(new TextEncoder().encode(mockHtml).buffer),
      } as unknown as Response
    );

    await expect(
      fetchRates(new Date(2025, 0, 1), { maxRetries: 1 })
    ).rejects.toThrow(DataUnavailableError);

    // Should only have called CSV endpoint, not HTML
    for (const call of fetchMock.mock.calls) {
      const url =
        typeof call[0] === 'string' ? call[0] : (call[0] as Request).url;
      expect(url).not.toContain('ptax.bcb.gov.br');
    }
  });

  it('should throw DataUnavailableError when both CSV and HTML fail', async () => {
    mockFetchByUrl(
      { ok: false, status: 404 } as Response,
      { ok: false, status: 500 } as Response
    );

    await expect(fetchRates(new Date(), { maxRetries: 1 })).rejects.toThrow(
      DataUnavailableError
    );
  });

  it('should skip fallback when useFallback is false', async () => {
    const fetchMock = mockFetchByUrl(
      { ok: false, status: 404 } as Response,
      {
        ok: true,
        text: () => Promise.resolve(mockHtml),
        arrayBuffer: () =>
          Promise.resolve(new TextEncoder().encode(mockHtml).buffer),
      } as unknown as Response
    );

    await expect(
      fetchRates(new Date(), { maxRetries: 1, useFallback: false })
    ).rejects.toThrow(DataUnavailableError);

    for (const call of fetchMock.mock.calls) {
      const url =
        typeof call[0] === 'string' ? call[0] : (call[0] as Request).url;
      expect(url).not.toContain('ptax.bcb.gov.br');
    }
  });

  it('should prefer CSV over HTML fallback', async () => {
    const mockCsv = `15/12/2025;220;A;USD;5,39230000;5,39290000;1,00000000;1,00000000`;

    const fetchMock = mockFetchByUrl(
      { ok: true, text: () => Promise.resolve(mockCsv) } as unknown as Response,
      {
        ok: true,
        text: () => Promise.resolve(mockHtml),
        arrayBuffer: () =>
          Promise.resolve(new TextEncoder().encode(mockHtml).buffer),
      } as unknown as Response
    );

    const { rates } = await fetchRates(new Date());

    expect(rates).toHaveLength(1);
    expect(rates[0].currency).toBe('USD');

    for (const call of fetchMock.mock.calls) {
      const url =
        typeof call[0] === 'string' ? call[0] : (call[0] as Request).url;
      expect(url).not.toContain('ptax.bcb.gov.br');
    }
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

describe('getRatesByPeriod', () => {
  // 2025-12-12 is a Friday, 2025-12-15 a Monday
  const files: Record<string, string> = {
    '20251212': `12/12/2025;220;A;USD;5,40000000;5,40060000;1,00000000;1,00000000
12/12/2025;978;B;EUR;6,33000000;6,33180000;1,17200000;1,17220000`,
    '20251215': `15/12/2025;220;A;USD;5,39230000;5,39290000;1,00000000;1,00000000
15/12/2025;978;B;EUR;6,34240000;6,34420000;1,17620000;1,17640000`,
    '20251217': `17/12/2025;220;A;USD;5,41000000;5,41060000;1,00000000;1,00000000
17/12/2025;978;B;EUR;6,35000000;6,35180000;1,17400000;1,17420000`,
  };

  function mockBcb() {
    return vi.spyOn(global, 'fetch').mockImplementation((input) => {
      const day = String(input).match(/(\d{8})\.csv$/)?.[1] ?? '';
      const csv = files[day];
      return Promise.resolve(
        (csv
          ? { ok: true, text: () => Promise.resolve(csv) }
          : { ok: false, status: 404 }) as Response
      );
    });
  }

  beforeEach(() => {
    clearCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return one rate per business day, sorted, skipping holidays', async () => {
    mockBcb();

    const rates = await getRatesByPeriod(
      'usd',
      new Date(2025, 11, 12),
      new Date(2025, 11, 17)
    );

    expect(rates.map((r) => r.date.getDate())).toEqual([12, 15, 17]);
    expect(rates.every((r) => r.currency === 'USD')).toBe(true);
    expect(rates[1].sellRate).toBe(5.3929);
  });

  it('should not request weekend days', async () => {
    const fetchMock = mockBcb();

    await getRatesByPeriod(
      'EUR',
      new Date(2025, 11, 12),
      new Date(2025, 11, 15)
    );

    const requested = fetchMock.mock.calls.map(
      (c) => String(c[0]).match(/(\d{8})\.csv$/)?.[1]
    );
    expect(requested.sort()).toEqual(['20251212', '20251215']);
  });

  it('should include both ends of the period, ignoring time of day', async () => {
    mockBcb();

    const rates = await getRatesByPeriod(
      'EUR',
      new Date(2025, 11, 15, 18, 30),
      new Date(2025, 11, 15, 9, 0)
    );

    expect(rates).toHaveLength(1);
    expect(rates[0].buyRate).toBe(6.3424);
  });

  it('should return an empty array when the period has no data', async () => {
    const fetchMock = mockBcb();

    const rates = await getRatesByPeriod(
      'USD',
      new Date(2025, 11, 13),
      new Date(2025, 11, 14)
    );

    expect(rates).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('should throw CurrencyNotFoundError for an unknown currency', async () => {
    mockBcb();

    await expect(
      getRatesByPeriod('XYZ', new Date(2025, 11, 12), new Date(2025, 11, 15))
    ).rejects.toThrow(CurrencyNotFoundError);
  });

  it('should throw PTAXError when from is after to', async () => {
    await expect(
      getRatesByPeriod('USD', new Date(2025, 11, 15), new Date(2025, 11, 12))
    ).rejects.toThrow(PTAXError);
  });

  it('should propagate network errors instead of returning partial data', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));

    await expect(
      getRatesByPeriod('USD', new Date(2025, 11, 12), new Date(2025, 11, 15))
    ).rejects.toThrow('Network error');
  });

  it('should reuse cached days', async () => {
    const fetchMock = mockBcb();

    await getRatesByDate(new Date(2025, 11, 15));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await getRatesByPeriod(
      'USD',
      new Date(2025, 11, 15),
      new Date(2025, 11, 15)
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
