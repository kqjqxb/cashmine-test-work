import { StyleSheet, View } from 'react-native';

import { spacing } from '@/constants/theme';

import { AppText } from './app-text';

/** Label on the left, value on the right (review and status screens). */
export function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <AppText variant="muted">{label}</AppText>
      <AppText variant={strong ? 'accent' : 'body'} style={styles.value} selectable>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  value: { flexShrink: 1, textAlign: 'right' },
});
