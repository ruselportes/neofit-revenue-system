import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Body, Button, Field, Notice, Screen, Title, colors } from '../../ui';
import { messageOf, useServices } from '../../state';
import type { AuthStackParams } from '../../navigation/types';

export default function LoginScreen({ navigation }: NativeStackScreenProps<AuthStackParams, 'Login'>) {
  const { auth } = useServices();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) return setError('Enter your email and password.');
    setBusy(true);
    setError(undefined);
    try {
      await auth.signIn(email, password);
    } catch (err) {
      setError(messageOf(err));
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={{ height: 40 }} />
      <Title sub="Revenue Collection and Monitoring System">NeoFit</Title>
      {error ? <Notice kind="error">{error}</Notice> : null}
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="username" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" textContentType="password" onSubmitEditing={submit} />
      <Button title="Sign In" onPress={submit} busy={busy} />
      <Pressable accessibilityRole="link" onPress={() => navigation.navigate('MemberLogin')} style={{ alignItems: 'center', padding: 12 }}>
        <Text style={{ color: colors.accent, fontWeight: '600' }}>Sign in with an email link</Text>
        <Body muted>For NeoFit members</Body>
      </Pressable>
    </Screen>
  );
}
