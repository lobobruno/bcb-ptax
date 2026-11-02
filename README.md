# bcb-ptax

[![npm version](https://img.shields.io/npm/v/bcb-ptax.svg)](https://www.npmjs.com/package/bcb-ptax)
[![npm downloads](https://img.shields.io/npm/dm/bcb-ptax.svg)](https://www.npmjs.com/package/bcb-ptax)
[![CI](https://github.com/lobobruno/bcb-ptax/actions/workflows/ci.yml/badge.svg)](https://github.com/lobobruno/bcb-ptax/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/bcb-ptax.svg)](https://nodejs.org)
[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-support-yellow.svg?logo=buy-me-a-coffee)](https://buymeacoffee.com/brunowlf)

> Official PTAX exchange rates from Banco Central do Brasil, in one function call.

PTAX is the official BRL exchange rate published by the Brazilian Central Bank. It is the rate used for taxes, accounting, customs and most contracts in Brazil. `bcb-ptax` fetches it straight from bcb.gov.br: no API key, no rate limits, no third-party service in between.

```typescript
import { getRate, convert, getRatesByPeriod } from 'bcb-ptax';

const usd = await getRate('USD');
// → { currency: 'USD', buyRate: 5.3923, sellRate: 5.3929, date: 2025-12-15, ... }

const brl = await convert(100, 'USD', 'BRL');
// → { result: 539.29, rate: 5.3929, rateType: 'sell', date: 2025-12-15, ... }

const december = await getRatesByPeriod('USD', new Date(2025, 11, 1), new Date(2025, 11, 31));
// → one PTAXRate per business day, sorted by date
```

## Features

- **Official data** - Read directly from BCB. Nothing is cached, proxied or resold by a third party
- **Zero dependencies** - Uses native `fetch` (Node.js 18+)
- **TypeScript first** - Full type definitions, ESM and CommonJS builds
- **Period queries** - A whole year of USD, EUR, GBP, JPY and others in a single request
- **Weekends and holidays handled** - Looks back to the last business day automatically
- **Resilient** - Falls back to BCB's HTML page when today's CSV is not published yet, and to daily files when the period API is down
- **Built-in caching** - 5-minute in-memory cache to avoid repeated downloads
- **Currency conversion** - Any pair, with BRL as the base, using buy or sell rates
- **156 currencies** - Everything BCB publishes, not just the majors

## Installation

```bash
npm install bcb-ptax
# or
pnpm add bcb-ptax
# or
yarn add bcb-ptax
```

## Usage

### Get a specific currency rate

```typescript
import { getRate } from 'bcb-ptax';

const usd = await getRate('USD');
console.log(`USD buy: R$ ${usd.buyRate}, sell: R$ ${usd.sellRate}`);
```

### Get all rates

```typescript
import { getLatestRates } from 'bcb-ptax';

const rates = await getLatestRates();
for (const rate of rates) {
  console.log(`${rate.currency}: ${rate.sellRate}`);
}
```

### Get rates for a specific date

```typescript
import { getRatesByDate } from 'bcb-ptax';

const rates = await getRatesByDate(new Date(2025, 11, 15));
```

If the date is a weekend or holiday, the last business day before it is returned. Use `new Date(year, monthIndex, day)` rather than an ISO string: `new Date('2025-12-15')` is midnight UTC, which is still December 14th in Brazil.

### Get a currency's rates over a period

```typescript
import { getRatesByPeriod } from 'bcb-ptax';

const rates = await getRatesByPeriod('USD', new Date(2025, 0, 1), new Date(2025, 11, 31));

for (const rate of rates) {
  console.log(`${rate.date.toLocaleDateString('pt-BR')}: ${rate.sellRate}`);
}
```

Returns one entry per business day, sorted by date. Weekends and holidays have no entry. USD, EUR, GBP, JPY, CHF, CAD, AUD, DKK, NOK and SEK come from BCB's Olinda API in a single request, so a full year takes under a second. Other currencies are fetched one business day at a time from the daily closing files (5 in parallel by default; set `concurrency` to change it).

### Convert between currencies

```typescript
import { convert } from 'bcb-ptax';

// Foreign → BRL
const brl = await convert(100, 'USD', 'BRL');

// BRL → foreign
const eur = await convert(1000, 'BRL', 'EUR');

// Cross rate (EUR → BRL → USD)
const usd = await convert(100, 'EUR', 'USD');

// Use the buy rate instead of the default sell rate
const buy = await convert(100, 'USD', 'BRL', { rateType: 'buy' });
```

### List supported currencies

```typescript
import { getSupportedCurrencies } from 'bcb-ptax';

const currencies = await getSupportedCurrencies();
// → ['AED', 'AFN', 'ALL', ..., 'YER', 'ZAR', 'ZMW'] (156 currencies)
```

### Options

```typescript
const rates = await getLatestRates({
  maxRetries: 10,     // Look back up to 10 days (default: 5)
  timeout: 15000,     // Per-request timeout in ms (default: 10000)
  useFallback: false, // Skip the HTML fallback for today (default: true)
});

const period = await getRatesByPeriod('ARS', from, to, {
  timeout: 15000,     // Per-request timeout in ms (default: 10000)
  concurrency: 10,    // Daily files fetched in parallel (default: 5)
});
```

### Error handling

```typescript
import { getRate, CurrencyNotFoundError, DataUnavailableError, PTAXError } from 'bcb-ptax';

try {
  await getRate('INVALID');
} catch (error) {
  if (error instanceof CurrencyNotFoundError) {
    // BCB does not publish this currency
  } else if (error instanceof DataUnavailableError) {
    // No data in the last `maxRetries` days (BCB down, or network issue)
  } else if (error instanceof PTAXError) {
    // Any other library error, e.g. `from` after `to` in getRatesByPeriod
  }
}
```

### Clear the cache

```typescript
import { clearCache } from 'bcb-ptax';

clearCache();
```

## API

| Function | Returns | Description |
|----------|---------|-------------|
| `getRate(currency, options?)` | `PTAXRate` | Latest rate for one currency |
| `getLatestRates(options?)` | `PTAXRate[]` | All rates from the most recent business day |
| `getRatesByDate(date, options?)` | `PTAXRate[]` | All rates for a date (or the last business day before it) |
| `getRatesByPeriod(currency, from, to, options?)` | `PTAXRate[]` | One currency, one entry per business day in the period |
| `convert(amount, from, to, options?)` | `ConversionResult` | Convert between any two currencies |
| `getSupportedCurrencies(options?)` | `string[]` | ISO codes of every published currency |
| `clearCache()` | `void` | Drop the in-memory cache |

### Types

```typescript
interface PTAXRate {
  date: Date;
  currencyCode: number;         // BCB numeric code (e.g. 220 for USD)
  currencyType: 'A' | 'B';      // BCB quotation type
  currency: string;             // ISO code (e.g. 'USD')
  buyRate: number;              // BRL per unit of foreign currency
  sellRate: number;
  buyParity: number;            // Units of foreign currency per USD
  sellParity: number;
}

interface PTAXOptions {
  maxRetries?: number;          // Default: 5
  timeout?: number;             // Default: 10000
  useFallback?: boolean;        // Default: true
}

interface PeriodOptions {
  timeout?: number;             // Default: 10000
  concurrency?: number;         // Default: 5
}

interface ConvertOptions extends PTAXOptions {
  rateType?: 'buy' | 'sell';    // Default: 'sell'
}

interface ConversionResult {
  from: string;
  to: string;
  amount: number;
  result: number;
  rate: number;
  rateType: 'buy' | 'sell';
  date: Date;
}
```

## Data sources

All data comes from Banco Central do Brasil. Three endpoints are used, depending on the call:

| Source | Used for | Notes |
|--------|----------|-------|
| [Daily closing CSV](https://www4.bcb.gov.br/Download/fechamento/20251215.csv) | `getRate`, `getLatestRates`, `getRatesByDate`, `convert`, and `getRatesByPeriod` for currencies not on Olinda | One file per business day, all 156 currencies |
| [Olinda PTAX API](https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/aplicacao) | `getRatesByPeriod` for USD, EUR, GBP, JPY, CHF, CAD, AUD, DKK, NOK, SEK | Whole period in one request; closing quotes only |
| [PTAX HTML page](https://ptax.bcb.gov.br/ptax_internet/consultarTodasAsMoedas.do?method=consultaTodasMoedas) | Fallback for today's rates when the CSV is not published yet | Can be disabled with `useFallback: false` |

PTAX is published once per business day, after 13:00 (Brasília time). There is no data for weekends or Brazilian holidays.

## Development

```bash
pnpm install
pnpm test          # Watch mode
pnpm test:unit     # Run once
pnpm lint:fix      # Biome lint + format
pnpm typecheck
pnpm build
```

Contributions are welcome. Open an [issue](https://github.com/lobobruno/bcb-ptax/issues) or a [pull request](https://github.com/lobobruno/bcb-ptax/pulls). Release notes are on the [releases page](https://github.com/lobobruno/bcb-ptax/releases).

## Support

If this saved you a trip to bcb.gov.br, a star helps others find it.

[![GitHub stars](https://img.shields.io/github/stars/lobobruno/bcb-ptax?style=social)](https://github.com/lobobruno/bcb-ptax)

<a href="https://buymeacoffee.com/brunowlf" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="50"></a>

## Author

**Bruno Lobo**

[![GitHub](https://img.shields.io/badge/GitHub-@lobobruno-181717?style=flat&logo=github&logoColor=white)](https://github.com/lobobruno)
[![X (Twitter)](https://img.shields.io/badge/X-@brunowlf-000000?style=flat&logo=x&logoColor=white)](https://x.com/brunowlf)

## License

[MIT](LICENSE)

## Links

- [GitHub Repository](https://github.com/lobobruno/bcb-ptax)
- [npm Package](https://www.npmjs.com/package/bcb-ptax)
- [Issue Tracker](https://github.com/lobobruno/bcb-ptax/issues)
- [BCB Official Data Source](https://www4.bcb.gov.br/pec/taxas/port/ptaxnpesq.asp)

---

Made with :heart: in [Brasilia](https://github.com/lobobruno)
