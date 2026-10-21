import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { colors, fontFamily, spacing } from '@/constants/theme';

import { AppText } from './app-text';
import { Button } from './button';
import { Card } from './card';
import { Logo } from './logo';
import { Screen } from './screen';

/** Asks for the API token. The token is only kept in memory and browser storage, never logged. */
export function TokenForm({ onSave, onCancel }: { onSave: (token: string) => void; onCancel?: () => void }) {
  const [value, setValue] = useState('');
  const token = value.trim();

  return (
    <Screen style={styles.screen}>
      <Logo />
      <AppText variant="title">Connect your account</AppText>
      <AppText variant="muted">Paste the API token from your task email. It is stored only in this browser.</AppText>
      <Card>
        <AppText variant="label">API token</AppText>
        <TextInput
          value={value}
          onChangeText={setValue}
          placeholder="Paste token"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          onSubmitEditing={() => token && onSave(token)}
          style={styles.input}
        />
        <Button title="Continue" disabled={!token} onPress={() => onSave(token)} />
        {onCancel && (
          <View style={styles.cancel}>
            <Button title="Cancel" variant="link" onPress={onCancel} />
          </View>
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { padding: spacing.lg, gap: spacing.md, justifyContent: 'center' },
  input: {
    fontFamily,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
  },
  cancel: { alignItems: 'center' },
});
