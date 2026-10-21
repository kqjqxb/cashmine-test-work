import { Pressable, StyleSheet, View } from 'react-native';

import { colors, headerHeight } from '@/constants/theme';
import { goBack } from '@/lib/navigation';

import { AppText } from './app-text';

/** "‹ Back" flush with the content's left edge, same height as Home's header row so headers line up. */
export function BackHeader() {
  return (
    <View style={styles.row}>
      <Pressable onPress={goBack} accessibilityRole="button" hitSlop={8} style={({ pressed }) => pressed && styles.pressed}>
        <AppText style={styles.label}>‹ Back</AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { height: headerHeight, flexDirection: 'row', alignItems: 'center' },
  label: { color: colors.accent, fontWeight: '600', fontSize: 14 },
  pressed: { opacity: 0.55 },
});
