import { StyleSheet, View, type ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, maxContentWidth } from '@/constants/theme';

/** Cream full-height background with content centred and capped at phone width. */
export function Screen({ style, children, ...props }: ViewProps) {
  return (
    <SafeAreaView style={styles.background} edges={['top', 'bottom']}>
      <View {...props} style={[styles.content, style]}>
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: colors.background, alignItems: 'center' },
  content: { flex: 1, width: '100%', maxWidth: maxContentWidth },
});
