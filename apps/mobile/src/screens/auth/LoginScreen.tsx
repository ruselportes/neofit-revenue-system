import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Body, Button, Field, Logo, Notice, Screen, Title, colors } from '../../ui';
import { messageOf, useServices } from '../../state';
import type { AuthStackParams } from '../../navigation/types';
import { VersionLabel } from '../../UpdateModal';

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
      <View style={{ alignItems: 'center', paddingTop: 36, paddingBottom: 12, gap: 14 }}>
        <Logo width={210} />
        <Text style={{ color: colors.muted, fontSize: 13, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase', textAlign: 'center' }}>
          Revenue Collection and Monitoring
        </Text>
      </View>
      <Title sub="Staff and owner accounts">Sign in</Title>
      {error ? <Notice kind="error">{error}</Notice> : null}
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="username" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" textContentType="password" onSubmitEditing={submit} />
      <Button title="Sign In" onPress={submit} busy={busy} />
      <Pressable accessibilityRole="link" onPress={() => navigation.navigate('MemberLogin')} style={{ alignItems: 'center', padding: 12 }}>
        <Text style={{ color: colors.accent, fontWeight: '600' }}>Sign in with an email link</Text>
        <Body muted>For NeoFit members</Body>
      </Pressable>
      <VersionLabel />
    </Screen>
  );
}
