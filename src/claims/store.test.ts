import { ClaimStore, type ClaimRecord } from './store';

const record = (key: string, status: 'pending' | 'completed' = 'completed'): ClaimRecord => ({
  key,
  body: { asset: 'ETH', amount: '0.5', destinationId: 'dest_wallet' },
  decimals: 18,
  destinationLabel: 'Wallet',
  claim: { id: `clm_${key}`, status, fee: '0.0012', receiveAmount: '0.4988', failureReason: null, createdAt: 'x', updatedAt: 'x' },
});

describe('ClaimStore.markReflected', () => {
  it('keeps the record for the status screen and flags it', () => {
    const store = new ClaimStore('test');
    store.upsert(record('a'));
    store.markReflected(['a']);
    expect(store.get('a')).toMatchObject({ key: 'a', reflected: true, claim: { status: 'completed' } });
  });

  it('keeps only the newest 20 reflected records', () => {
    const store = new ClaimStore('test');
    const keys = Array.from({ length: 25 }, (_, i) => `k${i}`);
    keys.forEach((k) => store.upsert(record(k)));
    store.upsert(record('live', 'pending'));
    store.markReflected(keys);
    expect(store.get('k0')).toBeUndefined();
    expect(store.get('k5')?.reflected).toBe(true);
    expect(store.get('live')?.reflected).toBeUndefined();
    expect(store.getSnapshot().records).toHaveLength(21);
  });
});
