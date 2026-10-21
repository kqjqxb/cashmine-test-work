import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import type { ActivityItem } from '@/api/client';
import { describeError } from '@/api/errors';
import { useToken } from '@/auth/token';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { Banner, ErrorState, LoadingState } from '@/components/states';
import { colors, radius, spacing } from '@/constants/theme';
import { useActivity } from '@/hooks/use-activity';
import { useBalances } from '@/hooks/use-balances';
import { formatAmount } from '@/lib/money';
import { goBack } from '@/lib/navigation';

export default function ActivityRoute() {
  const { token } = useToken();
  if (!token) return null;
  return <ActivityScreen token={token} />;
}

function ActivityScreen({ token }: { token: string }) {
  // Activity amounts can only be parsed with their asset's decimals, which come from balances.
  const balances = useBalances(token);
  const decimalsByAsset = useMemo(
    () => (balances.data ? Object.fromEntries(balances.data.items.map((b) => [b.asset, b.decimals])) : null),
    [balances.data],
  );
  const activity = useActivity(token, decimalsByAsset);

  let body;
  if (!balances.data && balances.error) {
    body = <ErrorState title="Couldn't load activity" message={describeError(balances.error)} actions={[{ title: 'Retry', onPress: balances.refresh }]} />;
  } else if (activity.loading) {
    body = <LoadingState />;
  } else if (activity.error) {
    body = <ErrorState title="Couldn't load activity" message={describeError(activity.error)} actions={[{ title: 'Retry', onPress: activity.retry }]} />;
  } else if (activity.items.length === 0) {
    body = (
      <Card>
        <AppText variant="heading">No activity yet</AppText>
        <AppText variant="muted">Payback accruals and claims will appear here.</AppText>
      </Card>
    );
  } else {
    body = (
      <>
        <Card style={styles.list}>
          {activity.items.map((item, i) => (
            <ActivityRow key={item.id} item={item} first={i === 0} />
          ))}
        </Card>
        {activity.moreError && (
          <Banner tone="danger" message={`Couldn't load more: ${describeError(activity.moreError)}`} action={{ title: 'Retry', onPress: activity.loadMore }} />
        )}
        {activity.nextCursor && !activity.moreError && (
          <Button title="Load more" variant="secondary" loading={activity.loadingMore} onPress={activity.loadMore} />
        )}
      </>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.back}>
          <Button title="‹ Back" variant="link" compact onPress={goBack} />
        </View>
        <AppText variant="title">Activity</AppText>
        {body}
      </ScrollView>
    </Screen>
  );
}

const TYPE_LABEL = { accrual: 'Accrual', reversal: 'Reversal', claim: 'Claim' } as const;

function ActivityRow({ item, first }: { item: ActivityItem; first: boolean }) {
  const amount =
    item.amount !== null && item.decimals !== null
      ? `${item.amount > 0n ? '+' : ''}${formatAmount(item.amount, item.decimals)}`
      : item.rawAmount; // unknown asset: shown exactly as the API sent it
  const tone = item.amount === null ? colors.text : item.amount > 0n ? colors.positive : item.amount < 0n ? colors.danger : colors.text;

  return (
    <View style={[styles.row, !first && styles.divider]}>
      <View style={styles.rowMain}>
        <AppText style={styles.type}>
          {TYPE_LABEL[item.type]}
          {item.exchange ? <AppText variant="muted"> · {item.exchange}</AppText> : null}
        </AppText>
        <AppText variant="muted">{new Date(item.createdAt).toLocaleString()}</AppText>
      </View>
      <View style={styles.rowSide}>
        <AppText style={[styles.amount, { color: tone }]} selectable>
          {amount} {item.asset}
        </AppText>
        <StatusBadge status={item.status} />
      </View>
    </View>
  );
}

function StatusBadge({ status }: { status: string }) {
  const [fg, bg] =
    status === 'pending'
      ? [colors.warning, colors.warningBackground]
      : status === 'failed'
        ? [colors.danger, colors.dangerBackground]
        : [colors.positive, colors.positiveBackground];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <AppText style={[styles.badgeText, { color: fg }]}>{status}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  back: { alignItems: 'flex-start' },
  list: { paddingVertical: spacing.xs, gap: 0 },
  row: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.md },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  rowMain: { flex: 1, gap: 2 },
  rowSide: { alignItems: 'flex-end', gap: 4, flexShrink: 1 },
  type: { fontWeight: '600' },
  amount: { fontWeight: '600', fontVariant: ['tabular-nums'], textAlign: 'right' },
  badge: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 12, fontWeight: '600' },
});
