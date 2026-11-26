import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { passwordProblem } from '../../passwordRules';
import { messageOf, useAuthState, useServices } from '../../state';
import { Button, Field, Logo, Notice, Screen, Title, colors } from '../../ui';

/**
 * Shown after a member signs in with an email code (the first time, or after forgetting the password). It cannot be
 * skipped: from then on the member signs in with email and password.
 */
export default function SetPasswordScreen() {
  const { auth } = useServices();
  const state = useAuthState();
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const problem = passwordProblem(password, again);
    if (problem) return setError(problem);
    setBusy(true);
    setError(undefined);
    try {
      await auth.setMemberPassword(password);
      // The app switches to the member screens by itself.
    } catch (err) {
      setError(messageOf(err));
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={{ alignItems: 'center', paddingTop: 36, paddingBottom: 12 }}>
        <Logo width={170} />
      </View>
      <Title sub={state.kind === 'member' ? state.account.name : undefined}>Create your password</Title>
      <Notice>You will use your email and this password to sign in next time. Use at least 8 characters.</Notice>
      {error ? <Notice kind="error">{error}</Notice> : null}
      <Field label="New password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" />
      <Field label="Type it again" value={again} onChangeText={setAgain} secureTextEntry autoComplete="new-password" textContentType="newPassword" onSubmitEditing={save} />
      <Button title="Save Password" onPress={save} busy={busy} />
      <Pressable accessibilityRole="link" onPress={() => auth.signOut()} style={{ alignItems: 'center', padding: 12 }}>
        <Text style={{ color: colors.muted, fontWeight: '600' }}>Sign out</Text>
      </Pressable>
    </Screen>
  );
}
