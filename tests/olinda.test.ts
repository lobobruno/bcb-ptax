import { describe, expect, it } from 'vitest';
import {
  buildOlindaUrl,
  OLINDA_CURRENCIES,
  type OlindaQuote,
  parseOlindaQuotes,
} from '../src/olinda.js';

function quote(
  dataHoraCotacao: string,
  sellRate: number,
  tipoBoletim = 'Fechamento'
): OlindaQuote {
  return {
    cotacaoCompra: sellRate - 0.0006,
    cotacaoVenda: sellRate,
    paridadeCompra: 1,
    paridadeVenda: 1,
    dataHoraCotacao,
    tipoBoletim,
  };
}

describe('buildOlindaUrl', () => {
  it('should format dates as MM-DD-YYYY and request closing quotes only', () => {
    const url = buildOlindaUrl(
      'USD',
      new Date(2025, 0, 2),
      new Date(2025, 11, 31)
    );

    expect(url).toContain('olinda.bcb.gov.br');
    expect(url).toContain('CotacaoMoedaPeriodo');
    expect(url).not.toContain('+');

    const params = new URL(url).searchParams;
    expect(params.get('@moeda')).toBe("'USD'");
    expect(params.get('@dataInicial')).toBe("'01-02-2025'");
    expect(params.get('@dataFinalCotacao')).toBe("'12-31-2025'");
    expect(params.get('$filter')).toBe("tipoBoletim eq 'Fechamento'");
    expect(params.get('$format')).toBe('json');
  });
});

describe('parseOlindaQuotes', () => {
  it('should map quotes to PTAXRate with the BCB code and type', () => {
    const rates = parseOlindaQuotes(
      [quote('2025-04-22 13:06:30.416', 5.6886)],
      'USD'
    );

    expect(rates).toHaveLength(1);
    expect(rates[0]).toEqual({
      date: new Date(2025, 3, 22),
      currencyCode: 220,
      currencyType: 'A',
      currency: 'USD',
      buyRate: 5.688,
      sellRate: 5.6886,
      buyParity: 1,
      sellParity: 1,
    });
  });

  it('should use local midnight for the date, ignoring the quote time', () => {
    const [rate] = parseOlindaQuotes(
      [quote('2025-04-22 23:59:59.999', 5.6886)],
      'USD'
    );

    expect(rate.date.getFullYear()).toBe(2025);
    expect(rate.date.getMonth()).toBe(3);
    expect(rate.date.getDate()).toBe(22);
    expect(rate.date.getHours()).toBe(0);
  });

  it('should keep the last quote when a day is published twice', () => {
    const rates = parseOlindaQuotes(
      [
        quote('2025-04-23 13:06:30.416', 5.688),
        quote('2025-04-23 13:06:30.443', 5.6881),
      ],
      'USD'
    );

    expect(rates).toHaveLength(1);
    expect(rates[0].sellRate).toBe(5.6881);
  });

  it('should drop non-closing quotes even if the server returns them', () => {
    const rates = parseOlindaQuotes(
      [
        quote('2025-04-22 10:04:11.337', 5.59, 'Abertura'),
        quote('2025-04-22 11:05:46.248', 5.57, 'Intermediário'),
        quote('2025-04-22 13:06:30.416', 5.6886),
      ],
      'USD'
    );

    expect(rates).toHaveLength(1);
    expect(rates[0].sellRate).toBe(5.6886);
  });

  it('should sort by date ascending', () => {
    const rates = parseOlindaQuotes(
      [
        quote('2025-04-24 13:06:30.416', 5.7),
        quote('2025-04-22 13:06:30.416', 5.6),
        quote('2025-04-23 13:06:30.416', 5.65),
      ],
      'USD'
    );

    expect(rates.map((r) => r.date.getDate())).toEqual([22, 23, 24]);
  });

  it('should return an empty array for no quotes', () => {
    expect(parseOlindaQuotes([], 'EUR')).toEqual([]);
  });

  it('should use each currency type as published by BCB', () => {
    expect(OLINDA_CURRENCIES.EUR).toEqual({ code: 978, type: 'B' });
    expect(
      parseOlindaQuotes([quote('2025-04-22 13:06:30', 6.3)], 'EUR')[0]
    ).toMatchObject({ currencyCode: 978, currencyType: 'B', currency: 'EUR' });
  });
});
