import type { Balances, ClaimStatus } from '@/api/client';

/** A claim the server confirmed creating, as tracked on this device. Times are server times (ms). */
export type LocalClaim = {
  asset: string;
  amount: bigint;
  status: ClaimStatus;
  createdAtMs: number;
  /** updatedAt of a settled (completed/failed) claim; null while pending. */
  settledAtMs: number | null;
};

/**
 * Balances to show: the snapshot, corrected for local claims it doesn't reflect yet.
 * Only server timestamps are compared (snapshot asOf vs claim createdAt/updatedAt), so the device clock doesn't matter.
 *
 * - snapshot older than the claim: it still counts the amount as available
 *     pending   → move amount from available to claiming
 *     completed → remove amount from available
 *     failed    → nothing (the money never left)
 * - snapshot taken while the claim was pending, claim settled since:
 *     completed → remove amount from claiming
 *     failed    → move amount from claiming back to available
 * - snapshot taken after settlement: it is the truth, no correction (see `isReflected`).
 */
export function displayBalances(snapshot: Balances, claims: LocalClaim[]): Balances {
  const items = snapshot.items.map((balance) => {
    let { available, claiming } = balance;
    for (const claim of claims) {
      if (claim.asset !== balance.asset || isReflected(claim, snapshot.asOfMs)) continue;
      const knowsClaim = snapshot.asOfMs >= claim.createdAtMs;
      if (!knowsClaim) {
        if (claim.status === 'pending') claiming += claim.amount;
        if (claim.status !== 'failed') available -= claim.amount;
      } else if (claim.status !== 'pending') {
        claiming -= claim.amount; // settled after the snapshot, which still shows it as claiming
        if (claim.status === 'failed') available += claim.amount;
      }
    }
    return { ...balance, available: clamp(available), claiming: clamp(claiming) };
  });
  return { ...snapshot, items };
}

/** The snapshot already shows the final state of this claim, so the local entry can be dropped. */
export function isReflected(claim: LocalClaim, asOfMs: number): boolean {
  return claim.settledAtMs !== null && asOfMs >= claim.settledAtMs;
}

// A correction must never show a negative balance (e.g. if a snapshot already partly reflects a claim).
const clamp = (value: bigint) => (value < 0n ? 0n : value);
