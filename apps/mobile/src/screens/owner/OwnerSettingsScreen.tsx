import { useState } from 'react';
import { confirmAsync, notify } from '../../platform/confirm';
import { SyncCard } from '../../SyncCard';
import { messageOf, useAuthState, useServices } from '../../state';
import { VersionLabel } from '../../UpdateModal';
import { Body, Button, Card, Field, Label, Notice, Screen, Title } from '../../ui';

export default function OwnerSettingsScreen() {
  const { auth, profiles, uploads, documents } = useServices();
  const state = useAuthState();
  const profile = state.kind === 'staff' ? state.profile : null;

  const [name, setName] = useState(profile?.fullName ?? '');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string }>();
  const [busy, setBusy] = useState<string>();

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
    <Screen brand>
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

      <SyncCard />

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
      <VersionLabel />
    </Screen>
  );
}
