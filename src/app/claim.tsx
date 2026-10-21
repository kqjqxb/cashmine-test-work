import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

import type { Balance, ClaimOptions } from '@/api/client';
import { describeError } from '@/api/errors';
import { useToken } from '@/auth/token';
import { useClaims } from '@/claims/claims-provider';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Row } from '@/components/row';
import { Screen } from '@/components/screen';
import { ErrorState, LoadingState } from '@/components/states';
import { colors, fontFamily, radius, spacing } from '@/constants/theme';
import { useClaimOptions } from '@/hooks/use-claim-options';
import { useDisplayBalances } from '@/hooks/use-display-balances';
import { formatAmount, validateClaimAmount, type ClaimAmounts, type ClaimError } from '@/lib/money';
import { goBack } from '@/lib/navigation';
import { uuid } from '@/lib/uuid';

export default function ClaimRoute() {
  const { asset = '' } = useLocalSearchParams<{ asset?: string }>();
  const { token } = useToken();
  if (!token) return null;
  return <ClaimScreen token={token} asset={asset} />;
}

function ClaimScreen({ token, asset }: { token: string; asset: string }) {
  const balances = useDisplayBalances(token);
  const balance = balances.data?.items.find((b) => b.asset === asset);
  const options = useClaimOptions(token, asset, balance?.decimals);

  let body;
  if (!balances.data) {
    body = balances.error ? (
      <ErrorState title="Couldn't load your balance" message={describeError(balances.error)} actions={[{ title: 'Retry', onPress: balances.refresh, loading: balances.refreshing }]} />
    ) : (
      <LoadingState />
    );
  } else if (!balance) {
    body = <ErrorState title={`No ${asset} balance`} actions={[{ title: 'Back to balances', onPress: () => router.replace('/') }]} />;
  } else if (!options.options) {
    body = options.error ? (
      <ErrorState title="Couldn't load claim options" message={describeError(options.error)} actions={[{ title: 'Retry', onPress: options.reload }]} />
    ) : (
      <LoadingState />
    );
  } else {
    body = <ClaimForm balance={balance} options={options.options} />;
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.back}>
          <Button title="‹ Back" variant="link" compact onPress={goBack} />
        </View>
        <AppText variant="title">Claim {asset}</AppText>
        {body}
      </ScrollView>
    </Screen>
  );
}

type Review = { amounts: ClaimAmounts; key: string };

function ClaimForm({ balance, options }: { balance: Balance; options: ClaimOptions }) {
  const { submit } = useClaims();
  const { asset, decimals, available } = balance;
  const [input, setInput] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [destinationId, setDestinationId] = useState(options.destinations[0]?.id);
  const [serverError, setServerError] = useState<{ field?: string; message: string } | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false); // state updates are async; the ref blocks a double tap in the same frame

  const fmt = (units: bigint) => `${formatAmount(units, decimals)} ${asset}`;

  if (available < options.minAmount) {
    return <Notice text={`The minimum claim is ${fmt(options.minAmount)}. You have ${fmt(available)} available.`} />;
  }
  if (available <= options.fee) {
    return <Notice text={`Your available ${fmt(available)} doesn't cover the ${fmt(options.fee)} fee.`} />;
  }
  const destination = options.destinations.find((d) => d.id === destinationId);
  if (!destination) return <Notice text="No payout destination is available for this asset." />;

  const result = validateClaimAmount(input, { decimals, minAmount: options.minAmount, available, fee: options.fee });
  // Errors that typing more can't fix are shown live; the rest wait for blur / Continue (e.g. "1." mid-typing).
  const visibleError = !result.ok && (showErrors || result.error === 'above_available' || result.error === 'too_many_decimals') ? result.error : null;
  const amountError = visibleError
    ? claimErrorText(visibleError, { min: fmt(options.minAmount), available: fmt(available), fee: fmt(options.fee), decimals })
    : serverError?.field === 'amount'
      ? serverError.message
      : null;

  const onChange = (text: string) => {
    setInput(text);
    setShowErrors(false);
    setServerError(null);
  };

  const onContinue = () => {
    setShowErrors(true);
    if (result.ok) setReview({ amounts: result.value, key: uuid() }); // one key per review
  };

  const onConfirm = async () => {
    if (!review || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    const key = review.key;
    const outcome = await submit({
      key,
      body: { asset, amount: formatAmount(review.amounts.amount, decimals), destinationId: destination.id },
      decimals,
      destinationLabel: destination.label,
      claim: null,
    });
    if (outcome.type === 'rejected') {
      // Definitely not created: back to the form; a new review gets a new key.
      const { error } = outcome;
      setServerError({ field: error.field, message: error.code === 'VALIDATION' ? error.message : describeError(error) });
      setReview(null);
      setSending(false);
      sendingRef.current = false;
    } else {
      router.replace({ pathname: '/claim-status', params: { key } });
    }
  };

  if (review) {
    return (
      <Card>
        <AppText variant="heading">Review your claim</AppText>
        <Row label="Amount" value={fmt(review.amounts.amount)} />
        <Row label="Fee" value={`− ${fmt(review.amounts.fee)}`} />
        <Row label="You receive" value={fmt(review.amounts.receive)} strong />
        <Row label="To" value={destination.label} />
        <Button title="Confirm claim" loading={sending} onPress={onConfirm} />
        <Button title="Edit" variant="link" disabled={sending} onPress={() => setReview(null)} />
      </Card>
    );
  }

  return (
    <Card>
      <View style={styles.labelRow}>
        <AppText variant="label">Amount</AppText>
        <AppText variant="muted">Available {fmt(available)}</AppText>
      </View>
      <View style={[styles.inputRow, amountError !== null && styles.inputError]}>
        <TextInput
          value={input}
          onChangeText={onChange}
          onBlur={() => setShowErrors(input.trim() !== '')}
          placeholder={`Min ${formatAmount(options.minAmount, decimals)}`}
          placeholderTextColor={colors.textMuted}
          inputMode="decimal"
          keyboardType="decimal-pad"
          autoCorrect={false}
          style={styles.input}
          accessibilityLabel={`Amount in ${asset}`}
        />
        <Button title="Max" variant="secondary" compact onPress={() => onChange(formatAmount(available, decimals))} />
      </View>
      {amountError && <AppText style={styles.errorText}>{amountError}</AppText>}
      {result.ok && (
        <AppText variant="muted">
          Fee {fmt(result.value.fee)} · You receive <AppText variant="accent">{fmt(result.value.receive)}</AppText>
        </AppText>
      )}

      <AppText variant="label">Send to</AppText>
      {options.destinations.map((d) => (
        <Button
          key={d.id}
          title={`${d.id === destinationId ? '● ' : '○ '}${d.label}`}
          variant={d.id === destinationId ? 'secondary' : 'link'}
          compact
          onPress={() => setDestinationId(d.id)}
        />
      ))}
      {serverError && serverError.field !== 'amount' && <AppText style={styles.errorText}>{serverError.message}</AppText>}

      <Button title="Continue" onPress={onContinue} />
    </Card>
  );
}

function claimErrorText(error: ClaimError, v: { min: string; available: string; fee: string; decimals: number }): string {
  switch (error) {
    case 'empty':
      return 'Enter an amount.';
    case 'format':
      return 'Enter a number like 0.5';
    case 'too_many_decimals':
      return `At most ${v.decimals} decimal places.`;
    case 'below_min':
      return `The minimum is ${v.min}.`;
    case 'above_available':
      return `You only have ${v.available} available.`;
    case 'receive_not_positive':
      return `The amount must be more than the ${v.fee} fee.`;
  }
}

function Notice({ text }: { text: string }) {
  return (
    <Card>
      <AppText variant="heading">{"You can't claim yet"}</AppText>
      <AppText variant="muted">{text}</AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  back: { alignItems: 'flex-start' },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card / 1.5,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
    backgroundColor: colors.background,
  },
  inputError: { borderColor: colors.danger },
  input: { flex: 1, minWidth: 0, fontFamily, fontSize: 20, fontWeight: '600', color: colors.text, paddingVertical: spacing.sm },
  errorText: { color: colors.danger, fontSize: 13 },
});
