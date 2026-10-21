import { useEffect, useMemo } from 'react';

import { useClaims } from '@/claims/claims-provider';
import type { ClaimRecord } from '@/claims/store';
import { displayBalances, isReflected, type LocalClaim } from '@/lib/display-balance';
import { parseAmount } from '@/lib/money';

import { useBalances } from './use-balances';

/** Balances as shown to the user: the latest snapshot corrected for this device's claims (see displayBalances). */
export function useDisplayBalances(token: string) {
  const balances = useBalances(token);
  const { records, remove } = useClaims();

  const local = useMemo(() => records.flatMap(toLocalClaim), [records]);
  const data = useMemo(() => balances.data && displayBalances(balances.data, local), [balances.data, local]);

  // Once a snapshot shows a settled claim's final state, the local entry has done its job.
  const asOfMs = balances.data?.asOfMs;
  useEffect(() => {
    if (asOfMs === undefined) return;
    remove(local.filter((c) => isReflected(c, asOfMs)).map((c) => c.key));
  }, [asOfMs, local, remove]);

  return { ...balances, data };
}

/** Only claims the server confirmed creating count; unknown outcomes don't move balances. */
function toLocalClaim(record: ClaimRecord): (LocalClaim & { key: string })[] {
  const { claim } = record;
  if (!claim) return [];
  const amount = parseAmount(record.body.amount, record.decimals);
  const createdAtMs = Date.parse(claim.createdAt);
  const settledAtMs = claim.status === 'pending' ? null : Date.parse(claim.updatedAt);
  if (!amount.ok || Number.isNaN(createdAtMs) || Number.isNaN(settledAtMs)) return [];
  return [{ key: record.key, asset: record.body.asset, amount: amount.value, status: claim.status, createdAtMs, settledAtMs }];
}
