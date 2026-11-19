import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { entriesText, pesoText, timeText, todayText } from '../../format';
import { RANGES, dateTile, emptyText, filterPages, groupPages, historySub, latestSync, summarize, type PageItem, type Range } from '../../historyView';
import { LAST_SYNC_KEY } from '../../services/Services';
import { useAuthState, useAsync, useServices, messageOf } from '../../state';
import { EmptyState, FilterChips, GroupHeader, Loading, Notice, PageRow, Screen, SummaryTiles, Title } from '../../ui';

type Item = PageItem;

export default function StaffHistoryScreen() {
  const { uploads, queue } = useServices();
  const navigation = useNavigation();
  const auth = useAuthState();
  const staffId = auth.kind === 'staff' ? auth.profile.id : '';
  const [range, setRange] = useState<Range>('today');
  const [syncMessage, setSyncMessage] = useState<string>();
  // When a page last reached the cloud (kept by the app each time one does), for the line under the title.
  const [lastSynced, setLastSynced] = useState<string | null>(null);

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
    setLastSynced(await AsyncStorage.getItem(LAST_SYNC_KEY).catch(() => null));
    await list.reload();
  }, [queue, list]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [staffId]),
  );

  const today = todayText();
  const all = list.data ?? [];
  const shown = filterPages(all, range, today);
  const summary = summarize(shown);
  const groups = groupPages(shown, today);
  const empty = emptyText(range);

  return (
    <Screen brand onRefresh={refresh} refreshing={list.loading}>
      <Title sub={historySub(all.filter((i) => !i.synced).length, latestSync(lastSynced, all), today)}>History</Title>
      <FilterChips options={RANGES} value={range} onChange={setRange} />
      {syncMessage ? <Notice kind="warn">{syncMessage}</Notice> : null}
      {list.error ? <Notice kind="error">{list.error}</Notice> : null}
      {list.loading && !list.data ? <Loading /> : null}
      {list.data && shown.length === 0 ? (
        <EmptyState icon="camera-outline" title={empty.title} text={empty.text} action={{ title: 'Scan a page', onPress: () => navigation.navigate('Scan' as never) }} />
      ) : null}
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
          {range !== 'today' ? <GroupHeader title={g.title} detail={`${g.pages} ${g.pages === 1 ? 'page' : 'pages'}`} total={pesoText(g.total)} /> : null}
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
