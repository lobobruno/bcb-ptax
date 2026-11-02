import type { PTAXRate } from './types.js';

const OLINDA_BASE_URL =
  'https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata';

/**
 * Currencies served by BCB's Olinda API, with their BCB code and type as
 * published in the daily closing CSV. Olinda only covers these ten.
 */
export const OLINDA_CURRENCIES: Record<
  string,
  { code: number; type: 'A' | 'B' }
> = {
  AUD: { code: 150, type: 'B' },
  CAD: { code: 165, type: 'A' },
  CHF: { code: 425, type: 'A' },
  DKK: { code: 55, type: 'A' },
  EUR: { code: 978, type: 'B' },
  GBP: { code: 540, type: 'B' },
  JPY: { code: 470, type: 'A' },
  NOK: { code: 65, type: 'A' },
  SEK: { code: 70, type: 'A' },
  USD: { code: 220, type: 'A' },
};

/**
 * One row of the Olinda CotacaoMoedaPeriodo response
 */
export interface OlindaQuote {
  cotacaoCompra: number;
  cotacaoVenda: number;
  paridadeCompra: number;
  paridadeVenda: number;
  /** "YYYY-MM-DD HH:mm:ss.SSS" in Brasília time */
  dataHoraCotacao: string;
  tipoBoletim: string;
}

/**
 * Formats a Date as MM-DD-YYYY, the format Olinda expects
 */
function formatDateForOlinda(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}-${day}-${date.getFullYear()}`;
}

/**
 * Builds the Olinda URL for one currency over a period (closing quotes only)
 */
export function buildOlindaUrl(currency: string, from: Date, to: Date): string {
  const params = new URLSearchParams({
    '@moeda': `'${currency}'`,
    '@dataInicial': `'${formatDateForOlinda(from)}'`,
    '@dataFinalCotacao': `'${formatDateForOlinda(to)}'`,
    $filter: "tipoBoletim eq 'Fechamento'",
    $format: 'json',
  });
  // URLSearchParams encodes spaces as '+'; use '%20' so the OData filter is
  // read as intended by the server.
  const query = params.toString().replace(/\+/g, '%20');
  return `${OLINDA_BASE_URL}/CotacaoMoedaPeriodo(moeda=@moeda,dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)?${query}`;
}

/**
 * Converts Olinda quotes into PTAXRate entries: closing quotes only, one per
 * day (the last one wins when BCB publishes a day twice), sorted by date.
 */
export function parseOlindaQuotes(
  quotes: OlindaQuote[],
  currency: string
): PTAXRate[] {
  const info = OLINDA_CURRENCIES[currency];
  const byDay = new Map<string, PTAXRate>();

  for (const quote of quotes) {
    if (quote.tipoBoletim !== 'Fechamento') continue;

    const dayKey = quote.dataHoraCotacao.slice(0, 10);
    const [year, month, day] = dayKey.split('-').map(Number);

    byDay.set(dayKey, {
      date: new Date(year, month - 1, day),
      currencyCode: info.code,
      currencyType: info.type,
      currency,
      buyRate: quote.cotacaoCompra,
      sellRate: quote.cotacaoVenda,
      buyParity: quote.paridadeCompra,
      sellParity: quote.paridadeVenda,
    });
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([, rate]) => rate);
}

/**
 * Fetches a currency's closing rates over a period from Olinda in a single
 * request. Throws on HTTP errors, timeouts or malformed responses.
 */
export async function fetchPeriodFromOlinda(
  currency: string,
  from: Date,
  to: Date,
  timeout: number
): Promise<PTAXRate[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(buildOlindaUrl(currency, from, to), {
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Olinda responded with HTTP ${response.status}`);
    }

    const body = (await response.json()) as { value?: OlindaQuote[] };
    if (!Array.isArray(body.value)) {
      throw new Error('Olinda returned an unexpected response');
    }

    return parseOlindaQuotes(body.value, currency);
  } finally {
    clearTimeout(timeoutId);
  }
}
