import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/constants/theme';

import { AppText } from './app-text';
import { Button } from './button';

type Action = { title: string; onPress: () => void; loading?: boolean };

/** Full-screen error, used when there is no data to show at all. */
export function ErrorState({ title, message, actions }: { title: string; message?: string; actions: Action[] }) {
  return (
    <View style={styles.center}>
      <AppText variant="heading" style={styles.centerText}>
        {title}
      </AppText>
      {message && (
        <AppText variant="muted" style={styles.centerText}>
          {message}
        </AppText>
      )}
      <View style={styles.actions}>
        {actions.map((action, i) => (
          <Button key={action.title} {...action} variant={i === 0 ? 'primary' : 'secondary'} />
        ))}
      </View>
    </View>
  );
}

/** Inline banner shown above data that is still displayed. */
export function Banner({ tone, message, action }: { tone: 'danger' | 'warning'; message: string; action?: Action }) {
  const danger = tone === 'danger';
  return (
    <View style={[styles.banner, danger ? styles.dangerBanner : styles.warningBanner]} accessibilityRole="alert">
      <AppText style={[styles.bannerText, { color: danger ? colors.danger : colors.warning }]}>{message}</AppText>
      {action && <Button {...action} variant="link" compact />}
    </View>
  );
}

/** Centered spinner for a screen section that is loading. */
export function LoadingState() {
  return (
    <View style={styles.center} accessibilityLabel="Loading">
      <ActivityIndicator color={colors.accent} size="large" />
    </View>
  );
}

/** Grey placeholder block for loading skeletons. */
export function Skeleton({ width, height }: { width: number | `${number}%`; height: number }) {
  return <View style={[styles.skeleton, { width, height }]} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  centerText: { textAlign: 'center' },
  actions: { gap: spacing.sm, marginTop: spacing.md },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 12,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
  },
  dangerBanner: { backgroundColor: colors.dangerBackground },
  warningBanner: { backgroundColor: colors.warningBackground },
  bannerText: { flex: 1, fontSize: 13 },
  skeleton: { backgroundColor: colors.skeleton, borderRadius: radius.card / 2 },
});
