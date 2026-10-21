import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { colors, radius } from '@/constants/theme';

import { AppText } from './app-text';

type Props = {
  title: string;
  onPress: () => void;
  /** primary = orange gradient pill, secondary = outlined pill, link = orange text, quiet = dark text. */
  variant?: 'primary' | 'secondary' | 'link' | 'quiet';
  disabled?: boolean;
  loading?: boolean;
  compact?: boolean;
};

export function Button({ title, onPress, variant = 'primary', disabled = false, loading = false, compact = false }: Props) {
  const inactive = disabled || loading;
  const label = (
    <View style={[styles.content, compact && styles.compact]}>
      {loading && <ActivityIndicator size="small" color={colors.buttonText} />}
      <AppText
        style={[styles.label, variant === 'link' && styles.linkLabel, variant === 'quiet' && styles.quietLabel, compact && styles.compactLabel]}
      >
        {title}
      </AppText>
    </View>
  );

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && !inactive && styles.shadow,
        variant === 'secondary' && styles.secondary,
        (pressed || inactive) && styles.dimmed,
      ]}
    >
      {variant === 'primary' ? (
        <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.gradient}>
          {label}
        </LinearGradient>
      ) : (
        label
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // No overflow: hidden here, so the primary shadow isn't clipped; the gradient rounds itself.
  base: { borderRadius: radius.pill },
  shadow: { boxShadow: `0 4px 12px ${colors.buttonShadow}` },
  gradient: { borderRadius: radius.pill, overflow: 'hidden' },
  secondary: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  dimmed: { opacity: 0.55 },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 20 },
  compact: { paddingVertical: 8, paddingHorizontal: 14 },
  label: { fontSize: 16, fontWeight: '700', color: colors.buttonText },
  compactLabel: { fontSize: 14 },
  linkLabel: { color: colors.accent, fontWeight: '600' },
  quietLabel: { color: colors.text, fontWeight: '500' },
});
