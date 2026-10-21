import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import type { Balance } from '@/api/client';
import type { ClaimRecord } from '@/claims/store';
import { colors, spacing } from '@/constants/theme';
import { computeUsd, formatAmount, formatUsd } from '@/lib/money';

import { AppText } from './app-text';
import { Button } from './button';
import { Card } from './card';

/** `claims`: this asset's claims tracked on this device; shown as a note until balances reflect them. */
export function BalanceCard({ balance, claims }: { balance: Balance; claims: ClaimRecord[] }) {
  const { asset, decimals, available, pending, claiming } = balance;
  const usd = computeUsd(available, decimals, balance.usdPrice);

  return (
    <Card>
      <View style={styles.header}>
        <View style={styles.badge}>
          <AppText style={styles.badgeText}>{asset.slice(0, 1)}</AppText>
        </View>
        <AppText variant="heading" style={styles.asset}>
          {asset}
        </AppText>
        <AppText variant="accent">{usd ? `≈ $${formatUsd(usd)}` : 'USD n/a'}</AppText>
      </View>

      <View>
        <AppText variant="label">Available</AppText>
        <AppText variant="amount" selectable>
          {formatAmount(available, decimals)} {asset}
        </AppText>
      </View>

      <View style={styles.row}>
        <Detail label="Pending" value={`${formatAmount(pending, decimals)} ${asset}`} />
        <Detail label="Claiming" value={`${formatAmount(claiming, decimals)} ${asset}`} />
      </View>

      {claims.map((record) => (
        <ClaimNote key={record.key} record={record} />
      ))}

      <Button
        title={available > 0n ? `Claim ${asset}` : 'Nothing to claim'}
        disabled={available === 0n}
        onPress={() => router.push({ pathname: '/claim', params: { asset } })}
      />
    </Card>
  );
}

const NOTE_TEXT = { pending: 'in progress', completed: 'completed', failed: 'failed' } as const;

function ClaimNote({ record }: { record: ClaimRecord }) {
  const status = record.claim?.status ?? 'pending';
  const failed = status === 'failed';
  return (
    <AppText
      variant="muted"
      style={failed && styles.failedNote}
      onPress={() => router.push({ pathname: '/claim-status', params: { key: record.key } })}
    >
      Claim of {record.body.amount} {record.body.asset} {NOTE_TEXT[status]}
      {failed && record.claim?.failureReason ? `: ${record.claim.failureReason}` : ''} ›
    </AppText>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <AppText variant="label">{label}</AppText>
      <AppText selectable>{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.card, fontWeight: '700' },
  asset: { flex: 1 },
  row: { flexDirection: 'row', gap: spacing.md },
  detail: { flex: 1, gap: 2 },
  failedNote: { color: colors.danger },
});
