import { useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Platform, RefreshControl, ScrollView, StyleSheet, View, type GestureResponderEvent, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '@/constants/theme';

import { AppText } from './app-text';

const PULL_THRESHOLD = 70;

type Props = {
  refreshing: boolean;
  onRefresh: () => void;
  contentContainerStyle?: StyleProp<ViewStyle>;
  children: ReactNode;
};

const touchY = (e: GestureResponderEvent) => e.nativeEvent.touches[0]?.pageY ?? null;

/**
 * ScrollView with pull-to-refresh. Native uses RefreshControl; react-native-web renders RefreshControl
 * as a plain View, so on web we track the touch drag ourselves while the list is scrolled to the top.
 */
export function RefreshScrollView({ refreshing, onRefresh, contentContainerStyle, children }: Props) {
  const scrollY = useRef(0);
  const startY = useRef<number | null>(null);
  const [pull, setPull] = useState(0);
  const web = Platform.OS === 'web';

  const webTouch = web && {
    onTouchStart: (e: GestureResponderEvent) => {
      startY.current = scrollY.current <= 0 ? touchY(e) : null;
    },
    onTouchMove: (e: GestureResponderEvent) => {
      const y = touchY(e);
      if (startY.current !== null && y !== null) setPull(Math.max(0, y - startY.current));
    },
    onTouchEnd: () => {
      if (pull >= PULL_THRESHOLD && !refreshing) onRefresh();
      startY.current = null;
      setPull(0);
    },
  };

  return (
    <ScrollView
      contentContainerStyle={contentContainerStyle}
      onScroll={(e) => (scrollY.current = e.nativeEvent.contentOffset.y)}
      scrollEventThrottle={16}
      refreshControl={web ? undefined : <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      {...webTouch}
    >
      {web && (pull > 0 || refreshing) && (
        <View style={[styles.indicator, { height: refreshing ? 36 : Math.min(pull, PULL_THRESHOLD) }]}>
          {refreshing ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <AppText variant="muted">{pull >= PULL_THRESHOLD ? 'Release to refresh' : 'Pull to refresh'}</AppText>
          )}
        </View>
      )}
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  indicator: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
