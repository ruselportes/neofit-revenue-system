import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { entriesText, pesoText, timeText, todayText } from '../../format';
import { dateTile, groupPages, isToday, summarize, type PageItem } from '../../historyView';
import { useAuthState, useAsync, useServices, messageOf } from '../../state';
import { Body, GroupHeader, Loading, Notice, PageRow, Screen, SummaryTiles, Title, colors } from '../../ui';

type Item = PageItem;

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
  const shown = (list.data ?? []).filter((i) => tab === 'all' || isToday(i, today));
  const summary = summarize(shown);
  const groups = groupPages(shown, today);

  return (
    <Screen brand onRefresh={refresh} refreshing={list.loading}>
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
      {shown.length > 0 ? (
        <SummaryTiles
          tiles={[
            { label: 'Total', value: pesoText(summary.total), accent: true },
            { label: summary.pages === 1 ? 'Page' : 'Pages', value: String(summary.pages) },
            { label: summary.entries === 1 ? 'Entry' : 'Entries', value: String(summary.entries) },
          ]}
        />
      ) : null}
      {groups.map((g) => (
        <View key={g.key} style={{ gap: 10 }}>
          {/* Today's list is a single group, so its header would only repeat the tiles above. */}
          {tab === 'all' ? <GroupHeader title={g.title} detail={`${g.pages} ${g.pages === 1 ? 'page' : 'pages'}`} total={pesoText(g.total)} /> : null}
          {g.items.map((i) => (
            <PageRow
              key={i.id}
              date={dateTile(i.date)}
              amount={pesoText(i.total)}
              detail={`${entriesText(i.entries)} · ${timeText(i.time)}`}
              waiting={!i.synced}
            />
          ))}
        </View>
      ))}
    </Screen>
  );
}
