import { router } from 'expo-router';

import { useToken } from '@/auth/token';
import { TokenForm } from '@/components/token-form';
import { goBack } from '@/lib/navigation';

export default function ChangeTokenScreen() {
  const { setToken } = useToken();
  return (
    <TokenForm
      onCancel={goBack}
      onSave={(token) => {
        setToken(token);
        router.replace('/');
      }}
    />
  );
}
