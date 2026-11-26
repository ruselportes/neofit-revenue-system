import { useState } from 'react';
import { Text, View } from 'react-native';
import { passwordProblem } from '../../passwordRules';
import { confirmAsync, notify } from '../../platform/confirm';
import { messageOf, useAuthState, useServices } from '../../state';
import { VersionLabel } from '../../UpdateModal';
import { Body, Button, Card, Field, InitialsTile, Label, Notice, Screen, colors } from '../../ui';

/** A member's own page: who they are (view only), Change password, the app version and Sign Out. */
export default function MemberAccountScreen() {
  const { auth } = useServices();
  const state = useAuthState();
  const account = state.kind === 'member' ? state.account : null;
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string }>();
  const [busy, setBusy] = useState(false);

  const change = async () => {
    const problem = passwordProblem(password, again);
    if (problem) return setMessage({ kind: 'error', text: problem });
    setBusy(true);
    setMessage(undefined);
    try {
      await auth.changeMemberPassword(current, password);
      setCurrent('');
      setPassword('');
      setAgain('');
      setMessage({ kind: 'ok', text: 'Your password was changed.' });
    } catch (err) {
      setMessage({ kind: 'error', text: messageOf(err) });
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    if (!(await confirmAsync('Sign out?', 'You can sign in again with your email and password.', 'Sign out', true))) return;
    try {
      await auth.signOut();
    } catch (err) {
      notify('Could not sign out', messageOf(err));
    }
  };

  return (
    <Screen brand>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 }}>
        <InitialsTile name={account?.name ?? ''} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={1} style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>{account?.name ?? ''}</Text>
          <Body muted>{account?.email ?? ''}</Body>
          <Body muted>{account?.memberId ?? ''}</Body>
        </View>
      </Card>
      <Body muted>To change your name or email, ask at the front desk.</Body>

      <Card>
        <Label>Change password</Label>
        {message ? <Notice kind={message.kind}>{message.text}</Notice> : null}
        <Field label="Current password" value={current} onChangeText={setCurrent} secureTextEntry autoComplete="password" />
        <Field label="New password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
        <Field label="Type the new one again" value={again} onChangeText={setAgain} secureTextEntry autoComplete="new-password" />
        <Button small kind="secondary" title="Change password" onPress={change} busy={busy} disabled={!current || !password || !again} />
      </Card>

      <Button title="Sign Out" kind="danger" onPress={signOut} />
      <VersionLabel />
    </Screen>
  );
}
