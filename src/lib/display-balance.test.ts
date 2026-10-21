import type { Balances } from '@/api/client';

import { displayBalances, isReflected, type LocalClaim } from './display-balance';

const T = Date.parse('2026-10-21T12:00:00.000Z');
const s = (seconds: number) => T + seconds * 1000;

// ETH-like asset with 0 decimals to keep numbers readable; the logic is unit-agnostic.
function snapshot(asOfMs: number, available: bigint, claiming: bigint): Balances {
  return {
    asOf: new Date(asOfMs).toISOString(),
    asOfMs,
    items: [
      { asset: 'ETH', decimals: 0, available, pending: 0n, claiming, usdPrice: '1' },
      { asset: 'BTC', decimals: 0, available: 50n, pending: 0n, claiming: 0n, usdPrice: '1' },
    ],
  };
}

const claim = (status: LocalClaim['status'], settledAt: number | null = null): LocalClaim => ({
  asset: 'ETH',
  amount: 30n,
  status,
  createdAtMs: s(0),
  settledAtMs: settledAt,
});

const eth = (b: Balances) => ({ available: b.items[0].available, claiming: b.items[0].claiming });

describe('displayBalances', () => {
  it('snapshot taken before the claim: moves the amount from available to claiming', () => {
    expect(eth(displayBalances(snapshot(s(-5), 100n, 0n), [claim('pending')]))).toEqual({ available: 70n, claiming: 30n });
  });

  it('snapshot taken after the claim (it already knows it): no correction', () => {
    expect(eth(displayBalances(snapshot(s(5), 70n, 30n), [claim('pending')]))).toEqual({ available: 70n, claiming: 30n });
    expect(eth(displayBalances(snapshot(s(0), 70n, 30n), [claim('pending')]))).toEqual({ available: 70n, claiming: 30n });
  });

  it('a stale snapshot arriving after a fresh one gives the same displayed numbers (never jumps back)', () => {
    const fresh = displayBalances(snapshot(s(5), 70n, 30n), [claim('pending')]);
    const stale = displayBalances(snapshot(s(-5), 100n, 0n), [claim('pending')]);
    expect(eth(stale)).toEqual(eth(fresh));
  });

  it('failed claim, snapshot (asOf < updatedAt) still shows it claiming: returns it to available', () => {
    expect(eth(displayBalances(snapshot(s(10), 70n, 30n), [claim('failed', s(20))]))).toEqual({ available: 100n, claiming: 0n });
  });

  it('failed claim, snapshot older than the claim: nothing to correct', () => {
    expect(eth(displayBalances(snapshot(s(-5), 100n, 0n), [claim('failed', s(20))]))).toEqual({ available: 100n, claiming: 0n });
  });

  it('completed claim not yet reflected: removed from claiming (or from available if the snapshot predates it)', () => {
    expect(eth(displayBalances(snapshot(s(10), 70n, 30n), [claim('completed', s(20))]))).toEqual({ available: 70n, claiming: 0n });
    expect(eth(displayBalances(snapshot(s(-5), 100n, 0n), [claim('completed', s(20))]))).toEqual({ available: 70n, claiming: 0n });
  });

  it('settled claim with asOf >= updatedAt: snapshot is the truth, no correction', () => {
    expect(eth(displayBalances(snapshot(s(20), 100n, 0n), [claim('failed', s(20))]))).toEqual({ available: 100n, claiming: 0n });
    expect(eth(displayBalances(snapshot(s(25), 70n, 0n), [claim('completed', s(20))]))).toEqual({ available: 70n, claiming: 0n });
  });

  it('clamps at 0 instead of showing a negative balance', () => {
    expect(eth(displayBalances(snapshot(s(-5), 10n, 0n), [claim('pending')]))).toEqual({ available: 0n, claiming: 30n });
  });

  it('only touches the claimed asset and handles several claims', () => {
    const result = displayBalances(snapshot(s(-5), 100n, 0n), [claim('pending'), { ...claim('pending'), amount: 20n }]);
    expect(eth(result)).toEqual({ available: 50n, claiming: 50n });
    expect(result.items[1].available).toBe(50n);
  });
});

describe('isReflected (when to drop the local entry)', () => {
  it('pending claims are never dropped', () => {
    expect(isReflected(claim('pending'), s(100))).toBe(false);
  });

  it('settled claims are dropped once a snapshot at or after updatedAt arrives', () => {
    expect(isReflected(claim('completed', s(20)), s(19))).toBe(false);
    expect(isReflected(claim('completed', s(20)), s(20))).toBe(true);
    expect(isReflected(claim('failed', s(20)), s(35))).toBe(true);
  });
});
