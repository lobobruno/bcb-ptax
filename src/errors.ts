/**
 * Base error class for PTAX-related errors
 */
export class PTAXError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PTAXError';
  }
}

/**
 * Error thrown when a requested currency is not found
 */
export class CurrencyNotFoundError extends PTAXError {
  constructor(currency: string) {
    super(`Currency not found: ${currency}`);
    this.name = 'CurrencyNotFoundError';
  }
}

/**
 * Error thrown when no data is available after all retry attempts
 */
export class DataUnavailableError extends PTAXError {
  constructor(days: number) {
    super(`No PTAX data available in the last ${days} days`);
    this.name = 'DataUnavailableError';
  }
}
