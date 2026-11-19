import { useState } from 'react';
import { Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { entriesText, longDate, pesoText, timeText, todayText } from '../../format';
import { RANGES, dateTile, emptyText, filterPages, groupPages, summarize, type PageItem, type Range } from '../../historyView';
import type { OwnerHistoryParams } from '../../navigation/types';
import { useAsync, useServices } from '../../state';
import { Badge, Body, Card, EmptyState, FilterChips, GroupHeader, Label, Loading, Notice, PageRow, Row, Screen, SummaryTiles, Title, colors } from '../../ui';

/** Every page from every staff member, newest first, in groups with their totals. */
export function OwnerHistoryScreen({ navigation }: NativeStackScreenProps<OwnerHistoryParams, 'OwnerHistory'>) {
  const { uploads } = useServices();
  const list = useAsync(() => uploads.all(), []);
  const [range, setRange] = useState<Range>('all'); // everything first, as before; the chips narrow it

  const items: PageItem[] = (list.data ?? []).map((u) => ({
    id: u.id,
    date: u.date,
    entries: u.totalEntries,
    total: u.totalAmount,
    time: u.createdAt,
    synced: u.isSynced,
    who: u.staffName,
  }));
  const today = todayText();
  const shown = filterPages(items, range, today);
  const summary = summarize(shown);
  const groups = groupPages(shown, today);
  const empty = emptyText(range);

  return (
    <Screen brand onRefresh={list.reload} refreshing={list.loading}>
      <Title sub="All uploads from all staff">Revenue History</Title>
      <FilterChips options={RANGES} value={range} onChange={setRange} />
      {list.error ? <Notice kind="error">{list.error}</Notice> : null}
      {list.loading && !list.data ? <Loading /> : null}
      {list.data && shown.length === 0 ? <EmptyState icon="documents-outline" title={empty.title} text={empty.text} /> : null}
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
          <GroupHeader title={g.title} detail={`${g.pages} ${g.pages === 1 ? 'page' : 'pages'}`} total={pesoText(g.total)} />
          {g.items.map((i) => (
            <PageRow
              key={i.id}
              date={dateTile(i.date)}
              amount={pesoText(i.total)}
              detail={`${i.who ?? 'Unknown staff'} · ${entriesText(i.entries)}`}
              waiting={!i.synced}
              onPress={() =>
                navigation.navigate('UploadDetail', {
                  uploadId: i.id,
                  date: i.date,
                  staffName: i.who ?? null,
                  total: i.total,
                  entries: i.entries,
                  savedAt: i.time,
                  synced: i.synced,
                })
              }
            />
          ))}
        </View>
      ))}
    </Screen>
  );
}

/** One page: a header with its figures, then its entries in a single card with thin dividers. */
export function UploadDetailScreen({ route }: NativeStackScreenProps<OwnerHistoryParams, 'UploadDetail'>) {
  const { uploads } = useServices();
  const { uploadId, date, staffName, total, entries: entryCount, savedAt, synced } = route.params;
  const entries = useAsync(() => uploads.entriesOf(uploadId), [uploadId]);

  return (
    <Screen onRefresh={entries.reload} refreshing={entries.loading}>
      <Title>{longDate(date)}</Title>
      <Card style={{ gap: 12 }}>
        <Label>Page total</Label>
        <Text style={{ color: colors.accent, fontSize: 34, fontWeight: '900', letterSpacing: -0.5 }}>{pesoText(total)}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <Badge tone="info" text={entriesText(entryCount)} />
          <Badge tone="info" text={staffName ?? 'Unknown staff'} />
          <Badge tone="info" text={`Saved ${timeText(savedAt)}`} />
          {synced ? null : <Badge tone="warn" text="Waiting to upload" />}
        </View>
      </Card>

      {entries.error ? <Notice kind="error">{entries.error}</Notice> : null}
      {entries.loading && !entries.data ? <Loading /> : null}
      {entries.data && entries.data.length > 0 ? (
        <Card style={{ gap: 0, padding: 0, overflow: 'hidden' }}>
          {entries.data.map((e, i) => (
            <View key={e.id}>
              {i > 0 ? <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 16 }} /> : null}
              <View style={{ paddingVertical: 14, paddingHorizontal: 16 }}>
                <Row>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Body strong>{e.name}</Body>
                    {e.isDuplicate ? <Badge tone="warn" text="Possible duplicate" /> : null}
                  </View>
                  <Body muted={e.amount === null}>{e.amount === null ? '—' : pesoText(e.amount)}</Body>
                </Row>
              </View>
            </View>
          ))}
        </Card>
      ) : null}
      {entries.data?.length === 0 ? <Body muted>This page has no entries.</Body> : null}
    </Screen>
  );
}
