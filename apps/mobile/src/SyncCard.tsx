import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState } from 'react';
import { Text } from 'react-native';
import { todayText } from './format';
import { latestSync, syncedAtText } from './historyView';
import { LAST_SYNC_KEY } from './services/Services';
import { messageOf, useAsync, useAuthState, useServices } from './state';
import { Body, Button, Card, Label, Notice, Row, colors } from './ui';

/**
 * Pages waiting to upload, when a page last reached the cloud, and a button to upload now. It lives on the staff
 * Account screen and in the owner's Settings: staff phones are where pages queue when there is no signal.
 */
export function SyncCard() {
  const { queue, uploads } = useServices();
  const state = useAuthState();
  const profile = state.kind === 'staff' ? state.profile : null;
  const [message, setMessage] = useState<{ kind: 'ok' | 'warn' | 'error'; text: string }>();
  const [busy, setBusy] = useState(false);

  // "Last upload" is the later of the saved time and this account's newest synced page: a page saved while online goes
  // straight to the cloud and leaves no saved time.
  const sync = useAsync(async () => {
    const stored = await AsyncStorage.getItem(LAST_SYNC_KEY).catch(() => null);
    const newest = profile ? await uploads.mine(profile.id, 1).catch(() => []) : [];
    return {
      waiting: await queue.pendingCount(),
      last: latestSync(stored, newest.map((u) => ({ time: u.createdAt, synced: u.isSynced }))),
    };
  }, [profile?.id]);

  const upload = async () => {
    setBusy(true);
    setMessage(undefined);
    try {
      const result = await queue.syncQueue();
      await sync.reload();
      setMessage(
        result.failed > 0
          ? { kind: 'warn', text: `${result.synced} uploaded, ${result.failed} still waiting for a connection.` }
          : { kind: 'ok', text: result.synced === 0 ? 'Nothing was waiting to upload.' : `${result.synced} uploaded.` },
      );
    } catch (err) {
      setMessage({ kind: 'error', text: messageOf(err) });
    } finally {
      setBusy(false);
    }
  };

  const waiting = sync.data?.waiting;
  return (
    <Card>
      <Label>Sync status</Label>
      {message ? <Notice kind={message.kind}>{message.text}</Notice> : null}
      <Row>
        <Body muted>Pages waiting to upload</Body>
        <Text style={{ color: waiting ? colors.warn : colors.text, fontSize: 16, fontWeight: '700' }}>{waiting === undefined ? '—' : String(waiting)}</Text>
      </Row>
      <Row>
        <Body muted>Last upload</Body>
        <Body strong>{sync.data?.last ? syncedAtText(sync.data.last, todayText()) : '—'}</Body>
      </Row>
      <Button small kind="secondary" title="Upload waiting pages now" busy={busy} onPress={upload} />
    </Card>
  );
}
