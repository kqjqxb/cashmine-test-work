import type { Claim, ClaimBody, ClaimStatus } from '@/api/client';
import { formatAmount } from '@/lib/money';
import { readStorage, writeStorage } from '@/lib/storage';

/** What we know about a claim attempt. Persisted (JSON-safe: amounts are API decimal strings). */
export type ClaimRecord = {
  /** Idempotency-Key: one per attempt, never regenerated for the same attempt. */
  key: string;
  body: ClaimBody;
  decimals: number;
  destinationLabel: string;
  /** null = we don't know yet whether the server created the claim. */
  claim: {
    id: string;
    status: ClaimStatus;
    fee: string;
    receiveAmount: string;
    failureReason: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
};

export type ClaimsSnapshot = {
  records: ClaimRecord[];
  /** Keys whose outcome is being checked right now (POST re-sent with the same key). */
  checking: ReadonlySet<string>;
  /** Attempts the server definitely rejected (4xx), with the message; their records are removed. */
  rejected: ReadonlyMap<string, string>;
};

export function toStoredClaim(claim: Claim, decimals: number): NonNullable<ClaimRecord['claim']> {
  return {
    id: claim.id,
    status: claim.status,
    fee: formatAmount(claim.fee, decimals),
    receiveAmount: formatAmount(claim.receiveAmount, decimals),
    failureReason: claim.failureReason,
    createdAt: claim.createdAt,
    updatedAt: claim.updatedAt,
  };
}

/**
 * Claim attempts for one token. Every change is written to storage synchronously,
 * so an attempt is persisted before its request is sent and survives a reload.
 */
export class ClaimStore {
  private snapshot: ClaimsSnapshot;
  private listeners = new Set<() => void>();

  constructor(private storageKey: string) {
    this.snapshot = { records: loadRecords(storageKey), checking: new Set(), rejected: new Map() };
  }

  getSnapshot = () => this.snapshot;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  get(key: string): ClaimRecord | undefined {
    return this.snapshot.records.find((r) => r.key === key);
  }

  upsert(record: ClaimRecord) {
    this.update({ records: [...this.snapshot.records.filter((r) => r.key !== record.key), record] });
  }

  reject(key: string, message: string) {
    const rejected = new Map(this.snapshot.rejected).set(key, message);
    this.update({ records: this.snapshot.records.filter((r) => r.key !== key), rejected });
  }

  remove = (keys: string[]) => {
    if (keys.length === 0) return;
    this.update({ records: this.snapshot.records.filter((r) => !keys.includes(r.key)) });
  };

  setChecking(key: string, checking: boolean) {
    const next = new Set(this.snapshot.checking);
    if (checking) next.add(key);
    else next.delete(key);
    this.update({ checking: next });
  }

  private update(change: Partial<ClaimsSnapshot>) {
    this.snapshot = { ...this.snapshot, ...change };
    if (change.records) writeStorage(this.storageKey, JSON.stringify(change.records));
    this.listeners.forEach((listener) => listener());
  }
}

function loadRecords(storageKey: string): ClaimRecord[] {
  try {
    const parsed: unknown = JSON.parse(readStorage(storageKey) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(isRecord) : [];
  } catch {
    return [];
  }
}

function isRecord(value: unknown): value is ClaimRecord {
  const r = value as ClaimRecord;
  return (
    typeof r?.key === 'string' &&
    typeof r.body?.asset === 'string' &&
    typeof r.body.amount === 'string' &&
    typeof r.body.destinationId === 'string' &&
    typeof r.decimals === 'number' &&
    (r.claim === null || (typeof r.claim?.id === 'string' && typeof r.claim.status === 'string'))
  );
}
