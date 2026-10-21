import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';

import { createClaim, getClaim } from '@/api/client';
import { ApiError, describeError, toApiError } from '@/api/errors';

import { ClaimStore, toStoredClaim, type ClaimRecord, type ClaimsSnapshot } from './store';

const STATUS_POLL_MS = 2_000;
/** Delays before each re-send of an attempt whose outcome is unknown (after a failed submit). */
const CHECK_DELAYS_MS = [1_000, 3_000, 7_000];
/** "Check again" and resume after reload send immediately, then back off. */
const RECHECK_DELAYS_MS = [0, 3_000, 7_000];

export type SubmitOutcome =
  | { type: 'created' }
  /** The server definitely did not create the claim (4xx); safe to edit and retry with a new key. */
  | { type: 'rejected'; error: ApiError }
  /** We don't know if the claim exists (timeout, 5xx, network). Never treat as failed. */
  | { type: 'unknown' };

type ClaimsContextValue = ClaimsSnapshot & {
  submit: (record: ClaimRecord) => Promise<SubmitOutcome>;
  /** Re-sends an unresolved attempt with its SAME key and body. */
  checkAgain: (key: string) => void;
  /** Drops settled claims that balances now reflect. */
  remove: (keys: string[]) => void;
};

const ClaimsContext = createContext<ClaimsContextValue | null>(null);

/** 429 is "try again later", not a rejection; any other 4xx means the claim was definitely not created. */
const isDefinite = (error: ApiError) => error.status >= 400 && error.status < 500 && error.status !== 429;

export function ClaimsProvider({ token, children }: { token: string; children: ReactNode }) {
  const [store] = useState(() => new ClaimStore(`cashmine.claims.${hash(token)}`));
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);

  /** One POST with the record's own key and body. */
  async function send(record: ClaimRecord): Promise<SubmitOutcome> {
    try {
      const { claim } = await createClaim(token, record.body, record.decimals, record.key);
      // `replayed` needs no special handling: it is the same claim either way.
      store.upsert({ ...record, claim: toStoredClaim(claim, record.decimals) });
      return { type: 'created' };
    } catch (e) {
      const error = toApiError(e);
      if (!isDefinite(error)) return { type: 'unknown' };
      store.reject(record.key, describeError(error));
      return { type: 'rejected', error };
    }
  }

  /**
   * Resolves an unknown outcome by re-sending the same key + body: the server either replays the
   * original claim or creates it exactly once. Stops at the first definite answer.
   */
  async function check(key: string, delays: number[]) {
    if (store.getSnapshot().checking.has(key)) return; // one check loop per attempt
    store.setChecking(key, true);
    for (const delay of delays) {
      await sleep(delay);
      const record = store.get(key);
      if (!record || record.claim) break;
      if ((await send(record)).type !== 'unknown') break;
    }
    store.setChecking(key, false);
  }

  async function submit(record: ClaimRecord): Promise<SubmitOutcome> {
    store.upsert(record); // persisted before the request goes out
    const outcome = await send(record);
    if (outcome.type === 'unknown') void check(record.key, CHECK_DELAYS_MS);
    return outcome;
  }

  // After a reload: resume every attempt whose outcome we never learned.
  useEffect(() => {
    for (const record of store.getSnapshot().records) if (!record.claim) void check(record.key, RECHECK_DELAYS_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per store (token)
  }, [store]);

  // Track pending claims until they settle.
  useEffect(() => {
    const inFlight = new Set<string>();
    const id = setInterval(() => {
      for (const record of store.getSnapshot().records) {
        if (record.claim?.status !== 'pending' || inFlight.has(record.key)) continue;
        inFlight.add(record.key);
        getClaim(token, record.claim.id, record.decimals)
          .then((claim) => {
            const current = store.get(record.key);
            if (current) store.upsert({ ...current, claim: toStoredClaim(claim, record.decimals) });
          })
          .catch(() => {}) // GET already retried; the next tick tries again
          .finally(() => inFlight.delete(record.key));
      }
    }, STATUS_POLL_MS);
    return () => clearInterval(id);
  }, [store, token]);

  const value = { ...snapshot, submit, checkAgain: (key: string) => void check(key, RECHECK_DELAYS_MS), remove: store.remove };
  return <ClaimsContext.Provider value={value}>{children}</ClaimsContext.Provider>;
}

export function useClaims(): ClaimsContextValue {
  const value = useContext(ClaimsContext);
  if (!value) throw new Error('useClaims must be used inside ClaimsProvider');
  return value;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Short non-cryptographic hash so the storage key is per token without containing the token. */
function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36);
}
