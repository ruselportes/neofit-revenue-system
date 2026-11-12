import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParams } from '../../navigation/types';
import { messageOf, useServices } from '../../state';
import { Body, Button, Field, Notice, Screen, Title, colors } from '../../ui';

export default function MemberLoginScreen({ navigation }: NativeStackScreenProps<AuthStackParams, 'MemberLogin'>) {
  const { auth } = useServices();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError('Enter a valid email address.');
    setBusy(true);
    setError(undefined);
    try {
      await auth.requestMemberLink(email);
      setSent(true);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Title sub="No password needed.">Member sign in</Title>
      {error ? <Notice kind="error">{error}</Notice> : null}
      {sent ? (
        <Notice kind="ok">If {email.trim()} has been invited, a sign-in link is on its way. Open it on this phone.</Notice>
      ) : (
        <>
          <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" />
          <Button title="Email Me a Sign-In Link" onPress={submit} busy={busy} />
          <Body muted>Not a member yet, or no access? Ask the front desk to invite you.</Body>
        </>
      )}
      <Pressable accessibilityRole="link" onPress={() => navigation.navigate('Login')} style={{ alignItems: 'center', padding: 12 }}>
        <Text style={{ color: colors.accent, fontWeight: '600' }}>Staff sign in</Text>
      </Pressable>
    </Screen>
  );
}
