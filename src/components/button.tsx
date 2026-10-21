import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { colors, radius } from '@/constants/theme';

import { AppText } from './app-text';

type Props = {
  title: string;
  onPress: () => void;
  /** primary = orange gradient pill, secondary = outlined pill, link = text only. */
  variant?: 'primary' | 'secondary' | 'link';
  disabled?: boolean;
  loading?: boolean;
  compact?: boolean;
};

export function Button({ title, onPress, variant = 'primary', disabled = false, loading = false, compact = false }: Props) {
  const inactive = disabled || loading;
  const label = (
    <View style={[styles.content, compact && styles.compact]}>
      {loading && <ActivityIndicator size="small" color={colors.buttonText} />}
      <AppText style={[styles.label, variant === 'link' && styles.linkLabel, compact && styles.compactLabel]}>{title}</AppText>
    </View>
  );

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [styles.base, variant === 'secondary' && styles.secondary, (pressed || inactive) && styles.dimmed]}
    >
      {variant === 'primary' ? (
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradient}
        >
          {label}
        </LinearGradient>
      ) : (
        label
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.pill, overflow: 'hidden' },
  gradient: { borderRadius: radius.pill },
  secondary: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  dimmed: { opacity: 0.55 },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 20 },
  compact: { paddingVertical: 8, paddingHorizontal: 14 },
  label: { fontSize: 16, fontWeight: '700', color: colors.buttonText },
  compactLabel: { fontSize: 14 },
  linkLabel: { color: colors.accent, fontWeight: '600' },
});
