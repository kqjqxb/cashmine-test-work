import {
  add,
  compare,
  computeUsd,
  formatAmount,
  formatUsd,
  parseAmount,
  parseSignedAmount,
  parseUserAmount,
  sub,
  totalUsd,
  validateClaimAmount,
} from './money';

const ETH = 18;
const USDT = 6;
const BTC = 8;

/** Test shorthand: parse a known-valid amount or fail loudly. */
function units(str: string, decimals: number): bigint {
  const result = parseAmount(str, decimals);
  if (!result.ok) throw new Error(`bad test amount ${str}: ${result.error}`);
  return result.value;
}

describe('parseAmount (strict, API strings)', () => {
  it.each([
    ['0', 0n],
    ['12', 12_000_000n],
    ['0.5', 500_000n],
    ['820.413207', 820_413_207n],
    ['0.000001', 1n],
    ['1.50', 1_500_000n],
  ])('parses %s', (str, expected) => {
    expect(parseAmount(str, USDT)).toEqual({ ok: true, value: expected });
  });

  it.each(['.5', '1.', '05', '00', '1e-3', '1E3', '-1', '+1', ' 1', '1 ', '1,5', '1.2.3', 'abc', '0x10', '١', 'Infinity', 'NaN'])(
    'rejects %j as bad format',
    (str) => {
      expect(parseAmount(str, USDT)).toEqual({ ok: false, error: 'format' });
    },
  );

  it('rejects empty string', () => {
    expect(parseAmount('', USDT)).toEqual({ ok: false, error: 'empty' });
  });

  it('rejects more places than the asset allows', () => {
    expect(parseAmount('0.0000001', USDT)).toEqual({ ok: false, error: 'too_many_decimals' });
    expect(parseAmount('1.0', 0)).toEqual({ ok: false, error: 'too_many_decimals' });
    expect(parseAmount('0.000000000000000001', ETH)).toEqual({ ok: true, value: 1n });
    expect(parseAmount('0.0000000000000000001', ETH)).toEqual({ ok: false, error: 'too_many_decimals' });
  });

  it('keeps every digit of 18-decimal ETH values that floats cannot hold', () => {
    const str = '12.345678901234591676';
    expect(String(parseFloat(str))).not.toBe(str); // proves float would corrupt it
    expect(parseAmount(str, ETH)).toEqual({ ok: true, value: 12_345678901234591676n });
    expect(formatAmount(units(str, ETH), ETH)).toBe(str);
  });

  it('handles amounts far above Number.MAX_SAFE_INTEGER', () => {
    const str = '123456789012345678901234567890.123456789012345678';
    expect(formatAmount(units(str, ETH), ETH)).toBe(str);
  });
});

describe('parseSignedAmount (activity amounts)', () => {
  it('parses negative and positive values', () => {
    expect(parseSignedAmount('-0.5', USDT)).toEqual({ ok: true, value: -500_000n });
    expect(parseSignedAmount('9.81', USDT)).toEqual({ ok: true, value: 9_810_000n });
  });

  it.each(['-', '--1', '-.5', '- 1'])('rejects %j', (str) => {
    expect(parseSignedAmount(str, USDT)).toEqual({ ok: false, error: 'format' });
  });
});

describe('parseUserAmount (lenient on whitespace and comma only)', () => {
  it('trims whitespace and accepts a comma as decimal separator', () => {
    expect(parseUserAmount('  0,5 \n', USDT)).toEqual({ ok: true, value: 500_000n });
    expect(parseUserAmount('1.25', USDT)).toEqual({ ok: true, value: 1_250_000n });
  });

  it('treats whitespace-only as empty', () => {
    expect(parseUserAmount('   ', USDT)).toEqual({ ok: false, error: 'empty' });
  });

  it.each(['1,000.5', '1 000', ',5', '1,', '05', '1e3', '1,2,3'])('still rejects %j', (str) => {
    expect(parseUserAmount(str, USDT)).toEqual({ ok: false, error: 'format' });
  });
});

describe('formatAmount', () => {
  it.each([
    [0n, USDT, '0'],
    [1n, USDT, '0.000001'],
    [1_500_000n, USDT, '1.5'],
    [12_000_000n, USDT, '12'],
    [-500_000n, USDT, '-0.5'],
    [42n, 0, '42'],
    [1n, ETH, '0.000000000000000001'],
  ])('formats %p with %i decimals as %s', (value, decimals, expected) => {
    expect(formatAmount(value, decimals)).toBe(expected);
  });

  it('round-trips through the strict parser', () => {
    for (const str of ['0', '0.1', '820.413207', '100']) {
      expect(formatAmount(units(str, USDT), USDT)).toBe(str);
    }
  });
});

describe('add / sub / compare', () => {
  it('is exact where floats are not', () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(formatAmount(add(units('0.1', ETH), units('0.2', ETH)), ETH)).toBe('0.3');
    expect(formatAmount(sub(units('1', ETH), units('0.000000000000000001', ETH)), ETH)).toBe('0.999999999999999999');
  });

  it('compares', () => {
    expect(compare(1n, 2n)).toBe(-1);
    expect(compare(2n, 2n)).toBe(0);
    expect(compare(3n, 2n)).toBe(1);
  });
});

describe('validateClaimAmount', () => {
  // ETH claim options from the API: minAmount 0.01, fee 0.0012
  const limits = { decimals: ETH, minAmount: units('0.01', ETH), available: units('0.5', ETH), fee: units('0.0012', ETH) };

  it('accepts exactly minAmount and computes receive = amount - fee', () => {
    expect(validateClaimAmount('0.01', limits)).toEqual({
      ok: true,
      value: { amount: units('0.01', ETH), fee: units('0.0012', ETH), receive: units('0.0088', ETH) },
    });
  });

  it('accepts exactly available', () => {
    const result = validateClaimAmount('0.5', limits);
    expect(result.ok && formatAmount(result.value.receive, ETH)).toBe('0.4988');
  });

  it('rejects one smallest unit below min and above available', () => {
    expect(validateClaimAmount('0.009999999999999999', limits)).toEqual({ ok: false, error: 'below_min' });
    expect(validateClaimAmount('0.500000000000000001', limits)).toEqual({ ok: false, error: 'above_available' });
  });

  it('accepts the full 18-decimal available balance', () => {
    const available = units('12.345678901234591676', ETH);
    const result = validateClaimAmount('12.345678901234591676', { ...limits, available });
    expect(result.ok && formatAmount(result.value.receive, ETH)).toBe('12.344478901234591676');
  });

  it('rejects fee >= amount (receive must be positive)', () => {
    const lowMin = { ...limits, minAmount: 0n };
    expect(validateClaimAmount('0.0012', lowMin)).toEqual({ ok: false, error: 'receive_not_positive' });
    expect(validateClaimAmount('0.001', lowMin)).toEqual({ ok: false, error: 'receive_not_positive' });
    expect(validateClaimAmount('0.001200000000000001', lowMin)).toEqual({
      ok: true,
      value: { amount: units('0.001200000000000001', ETH), fee: lowMin.fee, receive: 1n },
    });
  });

  it('reports input errors before range errors', () => {
    expect(validateClaimAmount('', limits)).toEqual({ ok: false, error: 'empty' });
    expect(validateClaimAmount('.5', limits)).toEqual({ ok: false, error: 'format' });
    expect(validateClaimAmount('0.1000000000000000000', limits)).toEqual({ ok: false, error: 'too_many_decimals' });
  });

  it('accepts user-style input', () => {
    expect(validateClaimAmount(' 0,25 ', limits).ok).toBe(true);
  });

  it('rejects everything when available is below min', () => {
    const empty = { ...limits, available: units('0.005', ETH) };
    expect(validateClaimAmount('0.005', empty)).toEqual({ ok: false, error: 'below_min' });
    expect(validateClaimAmount('0.01', empty)).toEqual({ ok: false, error: 'above_available' });
  });
});

describe('USD', () => {
  it('computes an exact value and rounds only when formatting', () => {
    const usd = computeUsd(units('820.413207', USDT), USDT, '1.0002');
    expect(usd).toEqual({ units: 8205772896414n, scale: 10 }); // 820.5772896414 exactly
    expect(formatUsd(usd!)).toBe('820.58');
  });

  it('keeps 18-decimal precision', () => {
    const usd = computeUsd(units('12.345678901234591676', ETH), ETH, '2500');
    expect(formatUsd(usd!)).toBe('30864.20'); // 30864.19725308647919
  });

  it('rounds half up at the cent', () => {
    expect(formatUsd({ units: 1005n, scale: 3 })).toBe('1.01');
    expect(formatUsd({ units: 1004n, scale: 3 })).toBe('1.00');
    expect(formatUsd({ units: 5n, scale: 0 })).toBe('5.00');
    expect(formatUsd({ units: 0n, scale: 18 })).toBe('0.00');
  });

  it('returns null for a malformed price', () => {
    expect(computeUsd(1n, USDT, '1e3')).toBeNull();
  });

  it('sums across assets with different decimals before rounding', () => {
    // each is $0.004 -> rounding each first would give $0.00, the exact total is $0.012 -> $0.01
    const total = totalUsd([
      { amount: units('0.004', USDT), decimals: USDT, usdPrice: '1' },
      { amount: units('0.00000004', BTC), decimals: BTC, usdPrice: '100000' },
      { amount: units('0.000002', ETH), decimals: ETH, usdPrice: '2000' },
    ]);
    expect(total).toEqual({ units: 12n * 10n ** 15n, scale: 18 }); // 0.012 at scale max(6, 8, 18)
    expect(formatUsd(total!)).toBe('0.01');
  });

  it('totals real-looking balances exactly', () => {
    const total = totalUsd([
      { amount: units('820.413207', USDT), decimals: USDT, usdPrice: '1.0002' },
      { amount: units('0.0005', BTC), decimals: BTC, usdPrice: '67250.5' },
      { amount: units('0.5', ETH), decimals: ETH, usdPrice: '2412.37' },
    ]);
    // 820.5772896414 + 33.62525 + 1206.185 = 2060.3875396414
    expect(formatUsd(total!)).toBe('2060.39');
  });

  it('makes the total unknown if any price is malformed', () => {
    expect(totalUsd([{ amount: 1n, decimals: USDT, usdPrice: '1' }, { amount: 1n, decimals: BTC, usdPrice: '' }])).toBeNull();
  });

  it('is $0.00 for no assets', () => {
    expect(formatUsd(totalUsd([])!)).toBe('0.00');
  });
});
