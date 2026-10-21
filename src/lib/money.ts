// Asset amounts are bigints in the asset's smallest unit: "1.5" ETH (18 decimals) = 1_500_000_000_000_000_000n.
// JS numbers lose precision past ~15-17 significant digits, so they are never used for amounts.

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

const ok = <T>(value: T): { ok: true; value: T } => ({ ok: true, value });
const err = <E>(error: E): { ok: false; error: E } => ({ ok: false, error });

/** An exact decimal: value = units / 10^scale. Used where the scale is not an asset's `decimals` (prices, USD). */
export type Decimal = { units: bigint; scale: number };

// API format: digits, optional dot + digits, no leading zeros. Rejects ".5", "1.", "05", "1e-3", "-1", " 1".
const DECIMAL_RE = /^(0|[1-9]\d*)(?:\.(\d+))?$/;

/** Strictly parses an API decimal string, keeping every digit. */
export function parseDecimal(str: string): Decimal | null {
  const match = DECIMAL_RE.exec(str);
  if (!match) return null;
  const fraction = match[2] ?? '';
  return { units: BigInt(match[1] + fraction), scale: fraction.length };
}

export type ParseError = 'empty' | 'format' | 'too_many_decimals';

/** Strictly parses an API amount string into smallest units. */
export function parseAmount(str: string, decimals: number): Result<bigint, ParseError> {
  if (str === '') return err('empty');
  const parsed = parseDecimal(str);
  if (!parsed) return err('format');
  if (parsed.scale > decimals) return err('too_many_decimals');
  return ok(parsed.units * 10n ** BigInt(decimals - parsed.scale));
}

/** Activity amounts are signed (negative for reversals and claims). */
export function parseSignedAmount(str: string, decimals: number): Result<bigint, ParseError> {
  const negative = str.startsWith('-');
  const result = parseAmount(negative ? str.slice(1) : str, decimals);
  if (!result.ok) return result.error === 'empty' && negative ? err('format') : result;
  return negative ? ok(-result.value) : result;
}

/** Parses what the user typed: surrounding whitespace is ignored and a comma works as the decimal separator. */
export function parseUserAmount(input: string, decimals: number): Result<bigint, ParseError> {
  return parseAmount(input.trim().replace(',', '.'), decimals);
}

/** Smallest units -> decimal string without trailing zeros. The output is valid API format. */
export function formatAmount(units: bigint, decimals: number): string {
  const sign = units < 0n ? '-' : '';
  const digits = (units < 0n ? -units : units).toString().padStart(decimals + 1, '0');
  const whole = digits.slice(0, digits.length - decimals);
  const fraction = digits.slice(digits.length - decimals).replace(/0+$/, '');
  return sign + whole + (fraction ? '.' + fraction : '');
}

// Both arguments must be in the same asset's units.
export const add = (a: bigint, b: bigint): bigint => a + b;
export const sub = (a: bigint, b: bigint): bigint => a - b;
export const compare = (a: bigint, b: bigint): -1 | 0 | 1 => (a < b ? -1 : a > b ? 1 : 0);

export type ClaimError = ParseError | 'below_min' | 'above_available' | 'receive_not_positive';
export type ClaimLimits = { decimals: number; minAmount: bigint; available: bigint; fee: bigint };
export type ClaimAmounts = { amount: bigint; fee: bigint; receive: bigint };

/** Checks user input against the claim rules; the fee is taken from the amount (receive = amount - fee). */
export function validateClaimAmount(input: string, limits: ClaimLimits): Result<ClaimAmounts, ClaimError> {
  const parsed = parseUserAmount(input, limits.decimals);
  if (!parsed.ok) return parsed;
  const amount = parsed.value;
  if (amount < limits.minAmount) return err('below_min');
  if (amount > limits.available) return err('above_available');
  const receive = sub(amount, limits.fee);
  if (receive <= 0n) return err('receive_not_positive');
  return ok({ amount, fee: limits.fee, receive });
}

/** Exact USD value of an amount: no rounding happens here. Returns null if the price string is malformed. */
export function computeUsd(amount: bigint, decimals: number, usdPrice: string): Decimal | null {
  const price = parseDecimal(usdPrice);
  if (!price) return null;
  return { units: amount * price.units, scale: decimals + price.scale };
}

/** Exact sum of USD values over assets. A single unknown price makes the whole total unknown (null). */
export function totalUsd(items: { amount: bigint; decimals: number; usdPrice: string }[]): Decimal | null {
  const values = items.map((item) => computeUsd(item.amount, item.decimals, item.usdPrice));
  if (values.some((value) => value === null)) return null;
  const exact = values as Decimal[];
  const scale = Math.max(0, ...exact.map((value) => value.scale));
  const units = exact.reduce((sum, value) => sum + value.units * 10n ** BigInt(scale - value.scale), 0n);
  return { units, scale };
}

/** Rounds to cents (half away from zero) and formats with thousands separators and 2 decimals, e.g. "1,234.50". */
export function formatUsd(value: Decimal): string {
  const negative = value.units < 0n;
  const abs = negative ? -value.units : value.units;
  let cents: bigint;
  if (value.scale >= 2) {
    const divisor = 10n ** BigInt(value.scale - 2);
    cents = (abs + divisor / 2n) / divisor;
  } else {
    cents = abs * 10n ** BigInt(2 - value.scale);
  }
  const sign = negative && cents > 0n ? '-' : '';
  const dollars = (cents / 100n).toString().replace(/\B(?=(\d{3})+$)/g, ',');
  return `${sign}${dollars}.${(cents % 100n).toString().padStart(2, '0')}`;
}
