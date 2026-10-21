import { useLocalSearchParams } from 'expo-router';
import { StyleSheet } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { spacing } from '@/constants/theme';
import { goBack } from '@/lib/navigation';

// Placeholder: the claim flow is step 5 in PLAN.md.
export default function ClaimScreen() {
  const { asset } = useLocalSearchParams<{ asset?: string }>();
  return (
    <Screen style={styles.screen}>
      <Button title="‹ Back" variant="link" compact onPress={goBack} />
      <AppText variant="title">Claim {asset ?? ''}</AppText>
      <Card>
        <AppText variant="muted">The claim flow is coming next.</AppText>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { padding: spacing.lg, gap: spacing.md, alignItems: 'stretch' },
});
