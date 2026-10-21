import { Stack } from 'expo-router';

import { TokenProvider, useToken } from '@/auth/token';
import { TokenForm } from '@/components/token-form';
import { colors } from '@/constants/theme';

export default function RootLayout() {
  return (
    <TokenProvider>
      <TokenGate />
    </TokenProvider>
  );
}

/** No token yet: ask for it before any screen (and any request) can run. */
function TokenGate() {
  const { token, setToken } = useToken();
  if (!token) return <TokenForm onSave={setToken} />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />;
}
