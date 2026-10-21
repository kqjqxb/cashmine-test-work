import { StyleSheet, Text, type TextProps } from 'react-native';

import { colors, fontFamily } from '@/constants/theme';

const variants = StyleSheet.create({
  body: { fontSize: 15, color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
  label: { fontSize: 12, color: colors.textMuted, fontWeight: '500', letterSpacing: 0.3, textTransform: 'uppercase' },
  title: { fontSize: 28, fontWeight: '700', color: colors.text, letterSpacing: -0.5 },
  heading: { fontSize: 18, fontWeight: '700', color: colors.text },
  amount: { fontSize: 22, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  accent: { fontSize: 15, fontWeight: '600', color: colors.accent },
});

export type TextVariant = keyof typeof variants;

/** Text with the app font. RN text does not inherit fonts from parent Views, so every Text goes through this. */
export function AppText({ variant = 'body', style, ...props }: TextProps & { variant?: TextVariant }) {
  return <Text {...props} style={[{ fontFamily }, variants[variant], style]} />;
}
