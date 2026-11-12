import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { dateOfIso, entriesText, longDate, pesoText, timeText, todayText } from '../../format';
import { useAuthState, useAsync, useServices, messageOf } from '../../state';
import { Badge, Body, Card, Loading, Notice, Row, Screen, Title, colors } from '../../ui';

interface Item {
  id: string;
  date: string;
  entries: number;
  total: number;
  time: string;
  synced: boolean;
}

export default function StaffHistoryScreen() {
  const { uploads, queue } = useServices();
  const auth = useAuthState();
  const staffId = auth.kind === 'staff' ? auth.profile.id : '';
  const [tab, setTab] = useState<'today' | 'all'>('today');
  const [syncMessage, setSyncMessage] = useState<string>();

  const list = useAsync<Item[]>(async () => {
    const waiting = await queue.items();
    const items: Item[] = waiting.map((q) => ({
      id: q.upload.id,
      date: q.upload.date,
      entries: q.upload.totalEntries,
      total: q.upload.totalAmount.pesos,
      time: q.queuedAt,
      synced: false,
    }));
    let cloudError: string | undefined;
    try {
      const mine = await uploads.mine(staffId);
      const queued = new Set(items.map((i) => i.id));
      items.push(...mine.filter((m) => !queued.has(m.id)).map((m) => ({ id: m.id, date: m.date, entries: m.totalEntries, total: m.totalAmount, time: m.createdAt, synced: true })));
    } catch (err) {
      cloudError = messageOf(err);
      // Offline: the waiting pages are still shown.
    }
    if (cloudError && items.length === 0) throw new Error(cloudError);
    return items.sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));
  }, [staffId]);

  /** Uploads the waiting pages, then reloads the list. Runs on pull-down and when the tab opens. */
  const refresh = useCallback(async () => {
    setSyncMessage(undefined);
    const result = await queue.syncQueue();
    if (result.failed > 0) setSyncMessage(`${result.failed} ${result.failed === 1 ? 'page is' : 'pages are'} still waiting for a connection.`);
    await list.reload();
  }, [queue, list]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [staffId]),
  );

  const today = todayText();
  const shown = (list.data ?? []).filter((i) => tab === 'all' || i.date === today || dateOfIso(i.time) === today);

  return (
    <Screen onRefresh={refresh} refreshing={list.loading}>
      <Title sub="Pull down to upload waiting pages">History</Title>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['today', 'all'] as const).map((t) => (
          <Pressable
            key={t}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t }}
            onPress={() => setTab(t)}
            style={{ paddingVertical: 8, paddingHorizontal: 16, borderRadius: 999, backgroundColor: tab === t ? colors.accent : colors.surface2 }}
          >
            <Text style={{ color: tab === t ? colors.accentText : colors.text, fontWeight: '700' }}>{t === 'today' ? 'Today' : 'All time'}</Text>
          </Pressable>
        ))}
      </View>
      {syncMessage ? <Notice kind="warn">{syncMessage}</Notice> : null}
      {list.error ? <Notice kind="error">{list.error}</Notice> : null}
      {list.loading && !list.data ? <Loading /> : null}
      {list.data && shown.length === 0 ? <Body muted>No pages {tab === 'today' ? 'today' : 'yet'}.</Body> : null}
      {shown.map((i) => (
        <Card key={i.id}>
          <Row>
            <Body strong>{longDate(i.date)}</Body>
            <Badge tone={i.synced ? 'ok' : 'warn'} text={i.synced ? 'Synced' : 'Pending Sync'} />
          </Row>
          <Row>
            <Body muted>{entriesText(i.entries)} · {timeText(i.time)}</Body>
            <Text style={{ color: colors.accent, fontWeight: '800', fontSize: 18 }}>{pesoText(i.total)}</Text>
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
