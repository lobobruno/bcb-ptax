/**
 * Represents a single PTAX exchange rate entry from BCB
 */
export interface PTAXRate {
  /** Date of the rate */
  date: Date;
  /** Numeric currency code from BCB */
  currencyCode: number;
  /** Currency type: 'A' (standard) or 'B' (special) */
  currencyType: 'A' | 'B';
  /** ISO currency code (e.g., USD, EUR) */
  currency: string;
  /** Buy rate (Taxa Compra) - BRL per unit of foreign currency */
  buyRate: number;
  /** Sell rate (Taxa Venda) - BRL per unit of foreign currency */
  sellRate: number;
  /** Buy parity (Paridade Compra) */
  buyParity: number;
  /** Sell parity (Paridade Venda) */
  sellParity: number;
}

/**
 * Options for PTAX API requests
 */
export interface PTAXOptions {
  /** Maximum number of days to look back for data (default: 5) */
  maxRetries?: number;
  /** Request timeout in milliseconds (default: 10000) */
  timeout?: number;
}

/**
 * Options for currency conversion
 */
export interface ConvertOptions extends PTAXOptions {
  /** Which rate to use for conversion (default: 'sell') */
  rateType?: 'buy' | 'sell';
}

/**
 * Result of a currency conversion
 */
export interface ConversionResult {
  /** Source currency code */
  from: string;
  /** Target currency code */
  to: string;
  /** Original amount */
  amount: number;
  /** Converted amount */
  result: number;
  /** Exchange rate used */
  rate: number;
  /** Type of rate used */
  rateType: 'buy' | 'sell';
  /** Date of the rate used */
  date: Date;
}

/**
 * Internal cache entry structure
 */
export interface CacheEntry {
  data: PTAXRate[];
  timestamp: number;
}
