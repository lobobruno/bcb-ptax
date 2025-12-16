# bcb-ptax

[![npm version](https://img.shields.io/npm/v/bcb-ptax.svg)](https://www.npmjs.com/package/bcb-ptax)
[![npm downloads](https://img.shields.io/npm/dm/bcb-ptax.svg)](https://www.npmjs.com/package/bcb-ptax)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/bcb-ptax.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-support-yellow.svg?logo=buy-me-a-coffee)](https://buymeacoffee.com/brunowlf)

> Retrieve PTAX exchange rates from Banco Central do Brasil (BCB)

A zero-dependency TypeScript library to fetch official Brazilian Central Bank exchange rates with automatic retry logic, caching, and currency conversion utilities.

## Features

- **Zero dependencies** - Uses native `fetch` (Node.js 18+)
- **TypeScript first** - Full type support with `.d.ts` files
- **Automatic retry** - Handles weekends and holidays by looking back up to 5 days
- **Built-in caching** - 5-minute in-memory cache to reduce API calls
- **Currency conversion** - Convert between any currencies using BRL as base
- **Dual format** - Supports both ESM and CommonJS

## Installation

```bash
npm install bcb-ptax
```

```bash
pnpm add bcb-ptax
```

```bash
yarn add bcb-ptax
```

## Quick Start

```typescript
import { getRate, convert } from 'bcb-ptax';

// Get USD rate
const usd = await getRate('USD');
console.log(`USD Buy: R$ ${usd.buyRate}`);
console.log(`USD Sell: R$ ${usd.sellRate}`);

// Convert 100 USD to BRL
const result = await convert(100, 'USD', 'BRL');
console.log(`100 USD = R$ ${result.result.toFixed(2)}`);
```

## Usage

### Get a Specific Currency Rate

```typescript
import { getRate } from 'bcb-ptax';

const usd = await getRate('USD');
console.log(`USD Buy: R$ ${usd.buyRate}`);
console.log(`USD Sell: R$ ${usd.sellRate}`);
```

### Get All Rates

```typescript
import { getLatestRates } from 'bcb-ptax';

const rates = await getLatestRates();
for (const rate of rates) {
  console.log(`${rate.currency}: ${rate.sellRate}`);
}
```

### Get Rates for a Specific Date

```typescript
import { getRatesByDate } from 'bcb-ptax';

const rates = await getRatesByDate(new Date('2025-12-15'));
```

### Convert Between Currencies

```typescript
import { convert } from 'bcb-ptax';

// Convert USD to BRL
const result = await convert(100, 'USD', 'BRL');
console.log(`100 USD = R$ ${result.result.toFixed(2)}`);

// Convert BRL to EUR
const eurResult = await convert(1000, 'BRL', 'EUR');
console.log(`R$ 1000 = € ${eurResult.result.toFixed(2)}`);

// Cross-rate conversion (EUR to USD via BRL)
const crossResult = await convert(100, 'EUR', 'USD');
console.log(`100 EUR = ${crossResult.result.toFixed(2)} USD`);

// Use buy rate instead of sell rate
const buyResult = await convert(100, 'USD', 'BRL', { rateType: 'buy' });
```

### Get Supported Currencies

```typescript
import { getSupportedCurrencies } from 'bcb-ptax';

const currencies = await getSupportedCurrencies();
console.log(currencies); // ['AUD', 'CAD', 'EUR', 'GBP', 'JPY', 'USD', ...]
```

### Configuration Options

All functions accept an optional options object:

```typescript
import { getLatestRates } from 'bcb-ptax';

const rates = await getLatestRates({
  maxRetries: 10,   // Look back up to 10 days (default: 5)
  timeout: 15000,   // 15 second timeout (default: 10000)
});
```

### Clear Cache

```typescript
import { clearCache } from 'bcb-ptax';

clearCache();
```

## API Reference

### Functions

| Function | Description |
|----------|-------------|
| `getLatestRates(options?)` | Fetch all rates from the most recent available date |
| `getRatesByDate(date, options?)` | Fetch all rates for a specific date |
| `getRate(currency, options?)` | Get a single currency rate |
| `convert(amount, from, to, options?)` | Convert between currencies |
| `getSupportedCurrencies(options?)` | Get list of available currencies |
| `clearCache()` | Clear the in-memory cache |

### Types

```typescript
interface PTAXRate {
  date: Date;
  currencyCode: number;
  currencyType: 'A' | 'B';
  currency: string;
  buyRate: number;
  sellRate: number;
  buyParity: number;
  sellParity: number;
}

interface PTAXOptions {
  maxRetries?: number;  // Default: 5
  timeout?: number;     // Default: 10000
}

interface ConvertOptions extends PTAXOptions {
  rateType?: 'buy' | 'sell';  // Default: 'sell'
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

### Error Handling

```typescript
import { getRate, CurrencyNotFoundError, DataUnavailableError } from 'bcb-ptax';

try {
  await getRate('INVALID');
} catch (error) {
  if (error instanceof CurrencyNotFoundError) {
    console.log('Currency not found');
  } else if (error instanceof DataUnavailableError) {
    console.log('No data available');
  }
}
```

## Data Source

This package fetches data from the official BCB (Banco Central do Brasil) daily exchange rates:

- **URL**: `https://www4.bcb.gov.br/Download/fechamento/{YYYYMMDD}.csv`
- **Availability**: Business days only (no weekends or Brazilian holidays)
- **Retry Logic**: Automatically looks back up to 5 days if data is unavailable

## Requirements

- Node.js >= 18.0.0

## Contributing

Contributions are welcome! Please feel free to submit a [Pull Request](https://github.com/lobobruno/bcb-ptax/pulls).

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Development

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Run tests once
pnpm test:run

# Lint and format
pnpm lint:fix

# Build
pnpm build
```

## Support

If you find this project helpful, please give it a star on GitHub!

[![GitHub stars](https://img.shields.io/github/stars/lobobruno/bcb-ptax?style=social)](https://github.com/lobobruno/bcb-ptax)

If you find this package useful, consider buying me a beer!

<a href="https://buymeacoffee.com/brunowlf" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="50"></a>

## Author

**Bruno Lobo**

[![GitHub](https://img.shields.io/badge/GitHub-@lobobruno-181717?style=flat&logo=github&logoColor=white)](https://github.com/lobobruno)
[![X (Twitter)](https://img.shields.io/badge/X-@brunowlf-000000?style=flat&logo=x&logoColor=white)](https://x.com/brunowlf)

## License

MIT License - see the [LICENSE](LICENSE) file for details.

## Links

- [GitHub Repository](https://github.com/lobobruno/bcb-ptax)
- [npm Package](https://www.npmjs.com/package/bcb-ptax)
- [Issue Tracker](https://github.com/lobobruno/bcb-ptax/issues)
- [BCB Official Data Source](https://www4.bcb.gov.br/pec/taxas/port/ptaxnpesq.asp)

---

Made with :heart: in [Brazil](https://github.com/lobobruno)
