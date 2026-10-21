import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, maxContentWidth } from '@/constants/theme';

/** Warm gradient full-height background with content centred and capped at phone width. */
export function Screen({ style, children, ...props }: ViewProps) {
  return (
    <LinearGradient colors={[colors.backgroundTop, colors.backgroundBottom]} style={styles.fill}>
      <SafeAreaView style={styles.background} edges={['top', 'bottom']}>
        <View {...props} style={[styles.content, style]}>
          {children}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  background: { flex: 1, alignItems: 'center' },
  content: { flex: 1, width: '100%', maxWidth: maxContentWidth },
});
