import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import type { Balance } from '@/api/client';
import type { ClaimRecord } from '@/claims/store';
import { assetColors, colors, spacing } from '@/constants/theme';
import { computeUsd, formatAmount, formatUsd } from '@/lib/money';

import { AppText } from './app-text';
import { Button } from './button';
import { Card } from './card';
import { fitFontSize } from './fit-text';

/** Text width inside a card on a 390px phone: 390 − 2×16 (screen) − 2×16 (card) − 2 (border). */
const CARD_TEXT_WIDTH = 324;
/** Value column of a detail row: card width minus the label column. */
const DETAIL_VALUE_WIDTH = CARD_TEXT_WIDTH - 90;

/** `claims`: this asset's claims tracked on this device; shown as a note until balances reflect them. */
export function BalanceCard({ balance, claims }: { balance: Balance; claims: ClaimRecord[] }) {
  const { asset, decimals, available, pending, claiming } = balance;
  const usd = computeUsd(available, decimals, balance.usdPrice);
  const availableText = `${formatAmount(available, decimals)} ${asset}`;

  return (
    <Card>
      <View style={styles.header}>
        <View style={[styles.badge, { backgroundColor: assetColors[asset] ?? colors.text }]}>
          <AppText style={styles.badgeText}>{asset.slice(0, 1)}</AppText>
        </View>
        <AppText variant="heading" style={styles.asset}>
          {asset}
        </AppText>
        <AppText variant="accent">{usd ? `≈ $${formatUsd(usd)}` : 'USD n/a'}</AppText>
      </View>

      <View>
        <AppText variant="label">Available</AppText>
        {/* Money is never truncated: long values get a smaller font (and wrap as a last resort). */}
        <AppText variant="amount" style={{ fontSize: fitFontSize(availableText, CARD_TEXT_WIDTH, 22) }} selectable>
          {availableText}
        </AppText>
      </View>

      <View style={styles.details}>
        <Detail label="Pending" value={`${formatAmount(pending, decimals)} ${asset}`} />
        <Detail label="Claiming" value={`${formatAmount(claiming, decimals)} ${asset}`} highlight={claiming > 0n} />
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

function Detail({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.detail}>
      <AppText variant="muted" style={styles.detailLabel}>
        {label}
      </AppText>
      <AppText
        style={[styles.detailValue, { fontSize: fitFontSize(value, DETAIL_VALUE_WIDTH, 14, 11) }, highlight && styles.highlight]}
        selectable
      >
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badge: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: colors.card, fontWeight: '700' },
  asset: { flex: 1 },
  details: { gap: 2 },
  detail: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  detailLabel: { fontSize: 12, width: 82 },
  detailValue: { flex: 1, textAlign: 'right', color: colors.textMuted, fontVariant: ['tabular-nums'] },
  highlight: { color: colors.brand, fontWeight: '600' },
  failedNote: { color: colors.danger },
});
