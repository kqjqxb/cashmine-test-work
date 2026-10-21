import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/constants/theme';

import { AppText } from './app-text';

/** CashMine mark: two skewed orange parallelograms + wordmark. */
export function Logo() {
  return (
    <View style={styles.row} accessibilityLabel="CashMine">
      <View style={styles.mark}>
        <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={[styles.bar, styles.back]} />
        <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={styles.bar} />
      </View>
      <AppText style={styles.word}>CASHMINE</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mark: { flexDirection: 'row', width: 24, height: 18 },
  bar: { width: 11, height: 18, borderRadius: 2, transform: [{ skewX: '-20deg' }] },
  back: { opacity: 0.6, marginRight: -2, marginTop: -3 },
  word: { color: colors.brand, fontWeight: '800', letterSpacing: 1, fontSize: 16 },
});
