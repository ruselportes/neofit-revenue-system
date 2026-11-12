import { Pressable, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { entriesText, longDate, pesoText } from '../../format';
import type { OwnerHistoryParams } from '../../navigation/types';
import { useAsync, useServices } from '../../state';
import { Badge, Body, Card, Loading, Notice, Row, Screen, Title, colors } from '../../ui';

/** Every page from every staff member, newest first. */
export function OwnerHistoryScreen({ navigation }: NativeStackScreenProps<OwnerHistoryParams, 'OwnerHistory'>) {
  const { uploads } = useServices();
  const list = useAsync(() => uploads.all(), []);

  return (
    <Screen onRefresh={list.reload} refreshing={list.loading}>
      <Title sub="All uploads from all staff">Revenue History</Title>
      {list.error ? <Notice kind="error">{list.error}</Notice> : null}
      {list.loading && !list.data ? <Loading /> : null}
      {list.data?.length === 0 ? <Body muted>No pages have been uploaded yet.</Body> : null}
      {list.data?.map((u) => (
        <Pressable
          key={u.id}
          accessibilityRole="button"
          onPress={() => navigation.navigate('UploadDetail', { uploadId: u.id, date: u.date, staffName: u.staffName, total: u.totalAmount })}
        >
          <Card>
            <Row>
              <Body strong>{longDate(u.date)}</Body>
              <Text style={{ color: colors.accent, fontWeight: '800', fontSize: 18 }}>{pesoText(u.totalAmount)}</Text>
            </Row>
            <Row>
              <Body muted>{u.staffName ?? 'Unknown staff'}</Body>
              <Body muted>{entriesText(u.totalEntries)}</Body>
            </Row>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}

export function UploadDetailScreen({ route }: NativeStackScreenProps<OwnerHistoryParams, 'UploadDetail'>) {
  const { uploads } = useServices();
  const { uploadId, date, staffName, total } = route.params;
  const entries = useAsync(() => uploads.entriesOf(uploadId), [uploadId]);

  return (
    <Screen onRefresh={entries.reload} refreshing={entries.loading}>
      <Title sub={`${staffName ?? 'Unknown staff'} · ${pesoText(total)}`}>{longDate(date)}</Title>
      {entries.error ? <Notice kind="error">{entries.error}</Notice> : null}
      {entries.loading && !entries.data ? <Loading /> : null}
      {entries.data?.map((e) => (
        <Card key={e.id}>
          <Row>
            <Body strong>{e.name}</Body>
            <Body>{e.amount === null ? '—' : pesoText(e.amount)}</Body>
          </Row>
          {e.isDuplicate ? <Badge tone="warn" text="DUP" /> : null}
        </Card>
      ))}
    </Screen>
  );
}
