import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { useClaims } from '@/claims/claims-provider';
import type { ClaimRecord } from '@/claims/store';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Row } from '@/components/row';
import { Screen } from '@/components/screen';
import { colors, spacing } from '@/constants/theme';

const home = () => router.replace('/');

export default function ClaimStatusScreen() {
  const { key = '' } = useLocalSearchParams<{ key?: string }>();
  const { records, checking, rejected, checkAgain } = useClaims();
  const record = records.find((r) => r.key === key);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        {record ? (
          <>
            <StatusCard record={record} checking={checking.has(key)} />
            {!record.claim && !checking.has(key) && <Button title="Check again" onPress={() => checkAgain(key)} />}
          </>
        ) : (
          <Card>
            <AppText variant="heading">{rejected.has(key) ? 'Claim not created' : 'Claim not found'}</AppText>
            <AppText variant="muted">
              {rejected.get(key) ?? 'This claim is no longer tracked on this device. Check your balances.'}
            </AppText>
          </Card>
        )}
        <Button title="Back to balances" variant="secondary" onPress={home} />
      </ScrollView>
    </Screen>
  );
}

function StatusCard({ record, checking }: { record: ClaimRecord; checking: boolean }) {
  const { claim, body } = record;
  const asset = body.asset;

  let title: string;
  let message: string;
  let busy = false;
  if (!claim) {
    // Outcome unknown: never "failed". The same Idempotency-Key makes re-checking safe.
    busy = checking;
    title = checking ? 'Checking your claim…' : "We couldn't confirm your claim yet";
    message = checking
      ? 'The server did not answer in time. We are checking with the same request, so it cannot be created twice.'
      : "Don't submit it again. Your claim may already be processing.";
  } else if (claim.status === 'pending') {
    busy = true;
    title = 'Claim processing';
    message = 'This usually takes about 20 seconds.';
  } else if (claim.status === 'completed') {
    title = 'Claim completed';
    message = `${claim.receiveAmount} ${asset} was sent to ${record.destinationLabel}.`;
  } else {
    title = 'Claim failed';
    message = `${claim.failureReason ?? 'The claim could not be completed.'} The amount was returned to your available balance.`;
  }

  return (
    <Card>
      <View style={styles.titleRow}>
        {busy && <ActivityIndicator color={colors.accent} />}
        <AppText variant="heading" style={styles.title}>
          {title}
        </AppText>
      </View>
      <AppText variant="muted">{message}</AppText>
      <Row label="Amount" value={`${body.amount} ${asset}`} />
      {claim && <Row label="Fee" value={`− ${claim.fee} ${asset}`} />}
      {claim && <Row label="You receive" value={`${claim.receiveAmount} ${asset}`} strong />}
      <Row label="To" value={record.destinationLabel} />
      {claim && <Row label="Claim ID" value={claim.id} />}
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1 },
});
