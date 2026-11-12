import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState } from 'react';
import { shortDate, timeText } from '../../format';
import { confirmAsync, notify } from '../../platform/confirm';
import { LAST_SYNC_KEY } from '../../services/Services';
import { messageOf, useAsync, useAuthState, useServices } from '../../state';
import { Body, Button, Card, Field, Label, Notice, Row, Screen, Title } from '../../ui';

export default function OwnerSettingsScreen() {
  const { auth, profiles, uploads, queue, documents } = useServices();
  const state = useAuthState();
  const profile = state.kind === 'staff' ? state.profile : null;

  const [name, setName] = useState(profile?.fullName ?? '');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string }>();
  const [busy, setBusy] = useState<string>();

  const sync = useAsync(async () => ({ waiting: await queue.pendingCount(), last: await AsyncStorage.getItem(LAST_SYNC_KEY).catch(() => null) }), []);

  const run = async (key: string, work: () => Promise<string>) => {
    setBusy(key);
    setMessage(undefined);
    try {
      setMessage({ kind: 'ok', text: await work() });
    } catch (err) {
      setMessage({ kind: 'error', text: messageOf(err) });
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <Screen>
      <Title sub={profile?.email}>Settings</Title>
      {message ? <Notice kind={message.kind}>{message.text}</Notice> : null}

      <Card>
        <Label>Profile</Label>
        <Field label="Your name" value={name} onChangeText={setName} />
        <Button
          small
          kind="secondary"
          title="Save name"
          busy={busy === 'name'}
          disabled={!profile || name.trim() === '' || name.trim() === profile.fullName}
          onPress={() =>
            run('name', async () => {
              await profiles.rename(profile!.id, name.trim());
              await auth.refresh();
              return 'Your name was saved.';
            })
          }
        />
      </Card>

      <Card>
        <Label>Change password</Label>
        <Field label="New password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
        <Button
          small
          kind="secondary"
          title="Change password"
          busy={busy === 'password'}
          disabled={password.length === 0}
          onPress={() =>
            run('password', async () => {
              await auth.changePassword(password);
              setPassword('');
              return 'Your password was changed.';
            })
          }
        />
      </Card>

      <Card>
        <Label>Sync status</Label>
        <Row><Body muted>Pages waiting to upload</Body><Body strong>{String(sync.data?.waiting ?? '—')}</Body></Row>
        <Row><Body muted>Last upload</Body><Body strong>{sync.data?.last ? `${shortDate(sync.data.last.slice(0, 10))}, ${timeText(sync.data.last)}` : '—'}</Body></Row>
        <Button
          small
          kind="secondary"
          title="Upload waiting pages now"
          busy={busy === 'sync'}
          onPress={() =>
            run('sync', async () => {
              const result = await queue.syncQueue();
              await sync.reload();
              return result.failed > 0 ? `${result.synced} uploaded, ${result.failed} still waiting for a connection.` : `${result.synced} uploaded.`;
            })
          }
        />
      </Card>

      <Card>
        <Label>Reports</Label>
        <Body muted>Exports the latest 100 uploads as a CSV file.</Body>
        <Button
          small
          kind="secondary"
          title="Export Reports (CSV)"
          busy={busy === 'csv'}
          onPress={() =>
            run('csv', async () => {
              await documents.exportUploads(await uploads.all(100));
              return 'The report is ready to share.';
            })
          }
        />
      </Card>

      <Button
        title="Sign Out"
        kind="danger"
        onPress={async () => {
          if (await confirmAsync('Sign out?', 'Pages waiting to upload stay on this phone.', 'Sign out', true)) {
            try {
              await auth.signOut();
            } catch (err) {
              notify('Could not sign out', messageOf(err));
            }
          }
        }}
      />
    </Screen>
  );
}
