import { Stack } from 'expo-router';

import { TokenProvider, useToken } from '@/auth/token';
import { ClaimsProvider } from '@/claims/claims-provider';
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
  // key: claims are stored per token, so a new token gets its own store.
  return (
    <ClaimsProvider key={token} token={token}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
    </ClaimsProvider>
  );
}
