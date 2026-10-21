import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { describeError, isUnauthorized } from '@/api/errors';
import { useToken } from '@/auth/token';
import { useClaims } from '@/claims/claims-provider';
import { AppText } from '@/components/app-text';
import { BalanceCard } from '@/components/balance-card';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { fitFontSize } from '@/components/fit-text';
import { Logo } from '@/components/logo';
import { RefreshScrollView } from '@/components/refresh-scroll-view';
import { Screen } from '@/components/screen';
import { Banner, ErrorState, Skeleton } from '@/components/states';
import { colors, headerHeight, radius, spacing } from '@/constants/theme';
import { useDisplayBalances } from '@/hooks/use-display-balances';
import { useNow } from '@/hooks/use-now';
import { formatUsd, totalUsd } from '@/lib/money';

/** Older than this and the snapshot is flagged as stale (the server recomputes every 15s). */
const STALE_AFTER_S = 60;
/** Text width inside a padded card on a 390px phone: 390 − 2×16 (screen) − 2×16 (card) − 2 (border). */
const TEXT_WIDTH = 324;

const changeToken = () => router.push('/token');

export default function HomeRoute() {
  const { token } = useToken();
  if (!token) return null; // The root layout only renders routes once a token exists.
  // key: a new token starts from a clean state instead of showing the previous account's balances.
  return <Home key={token} token={token} />;
}

function Home({ token }: { token: string }) {
  const { data, error, refreshing, refresh } = useDisplayBalances(token);
  const { records } = useClaims();
  const now = useNow();
  // Attempts whose outcome we don't know yet (timeout / 5xx / network); resumed automatically.
  const unconfirmed = records.filter((r) => !r.claim);

  if (!data) {
    return (
      <Screen>
        {error ? (
          isUnauthorized(error) ? (
            <ErrorState
              title="Token invalid or expired"
              message="Paste a valid token from your task email."
              actions={[{ title: 'Change token', onPress: changeToken }, { title: 'Retry', onPress: refresh, loading: refreshing }]}
            />
          ) : (
            <ErrorState
              title="Couldn't load balances"
              message={describeError(error)}
              actions={[{ title: 'Retry', onPress: refresh, loading: refreshing }]}
            />
          )
        ) : (
          <HomeSkeleton />
        )}
      </Screen>
    );
  }

  // Total = what can be claimed right now. Pending can still be reversed; claiming is already leaving.
  const total = totalUsd(data.items.map((b) => ({ amount: b.available, decimals: b.decimals, usdPrice: b.usdPrice })));
  const totalText = total ? `$${formatUsd(total)}` : '—';
  const ageS = Math.max(0, Math.floor((now - data.asOfMs) / 1000));
  const stale = ageS > STALE_AFTER_S || error !== null;

  return (
    <Screen>
      <RefreshScrollView refreshing={refreshing} onRefresh={refresh} contentContainerStyle={styles.content}>
        <Header />

        <View style={styles.hero}>
          <AppText variant="label">Available to claim</AppText>
          <AppText style={[styles.total, { fontSize: fitFontSize(totalText, TEXT_WIDTH, 40) }]} selectable>
            {totalText}
          </AppText>
          {!total && <AppText variant="muted">USD price is unavailable for some assets.</AppText>}
          <View style={styles.freshness}>
            <AppText variant="muted">Updated {formatAge(ageS)}</AppText>
            {stale && (
              <View style={styles.stalePill}>
                <AppText style={styles.staleText}>Stale</AppText>
              </View>
            )}
            <View style={styles.spacer} />
            <Button title="Refresh" variant="secondary" compact loading={refreshing} onPress={refresh} />
          </View>
        </View>

        {unconfirmed.map((r) => (
          <Banner
            key={r.key}
            tone="warning"
            message={`Confirming your claim of ${r.body.amount} ${r.body.asset}. Don't submit it again.`}
            action={{ title: 'View', onPress: () => router.push({ pathname: '/claim-status', params: { key: r.key } }) }}
          />
        ))}

        {error &&
          (isUnauthorized(error) ? (
            <Banner tone="danger" message="Token invalid or expired." action={{ title: 'Change token', onPress: changeToken }} />
          ) : (
            <Banner tone="danger" message={`Refresh failed: ${describeError(error)} Showing last known balances.`} action={{ title: 'Retry', onPress: refresh }} />
          ))}

        {data.items.length === 0 ? (
          <Card>
            <AppText variant="heading">No payback yet</AppText>
            <AppText variant="muted">Balances appear here once you earn payback on a partner exchange.</AppText>
          </Card>
        ) : (
          data.items.map((balance) => (
            <BalanceCard key={balance.asset} balance={balance} claims={records.filter((r) => r.claim && !r.reflected && r.body.asset === balance.asset)} />
          ))
        )}
      </RefreshScrollView>
    </Screen>
  );
}

function Header() {
  return (
    <View style={styles.header}>
      <Logo />
      <View style={styles.headerLinks}>
        <Button title="Activity" variant="quiet" compact onPress={() => router.push('/activity')} />
        <Button title="Change token" variant="quiet" compact onPress={changeToken} />
      </View>
    </View>
  );
}

function HomeSkeleton() {
  return (
    <View style={styles.content} accessibilityLabel="Loading balances">
      <Header />
      <View style={styles.hero}>
        <Skeleton width={120} height={14} />
        <Skeleton width={220} height={44} />
        <Skeleton width={140} height={14} />
      </View>
      {[0, 1, 2].map((i) => (
        <Card key={i}>
          <Skeleton width="40%" height={20} />
          <Skeleton width="70%" height={26} />
          <Skeleton width="100%" height={48} />
        </Card>
      ))}
    </View>
  );
}

function formatAge(seconds: number): string {
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  header: { height: headerHeight, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  // Negative margin: the last link's own padding shouldn't indent it from the content's right edge.
  headerLinks: { flexDirection: 'row', marginRight: -14 },
  hero: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.highlightBorder,
    backgroundColor: colors.highlight,
  },
  total: { fontSize: 40, fontWeight: '800', letterSpacing: -1, color: colors.text, fontVariant: ['tabular-nums'] },
  freshness: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stalePill: { backgroundColor: colors.warningBackground, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  staleText: { color: colors.warning, fontSize: 12, fontWeight: '600' },
  spacer: { flex: 1 },
});
