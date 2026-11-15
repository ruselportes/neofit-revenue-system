import { Text, View } from 'react-native';
import { OwnerStats } from '@neofit/core';
import { pesoText, todayText, weekdayShort } from '../../format';
import { useAsync, useAuthState, useServices } from '../../state';
import { Body, Card, Loading, Notice, Row, Screen, Title, colors } from '../../ui';

export default function DashboardScreen() {
  const { uploads } = useServices();
  const auth = useAuthState();
  const name = auth.kind === 'staff' ? auth.profile.fullName.split(' ')[0] : '';
  const today = todayText();

  const stats = useAsync(async () => OwnerStats.compute(await uploads.totalsSince(`${today.slice(0, 4)}-01-01`), today), [today]);
  const s = stats.data;

  return (
    <Screen brand onRefresh={stats.reload} refreshing={stats.loading}>
      <Title sub="Here is how the gym is doing.">{`Hello, ${name}`}</Title>
      {stats.error ? <Notice kind="error">{stats.error}</Notice> : null}
      {!s && !stats.error ? <Loading /> : null}
      {s ? (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            <Stat label="Today" value={s.today} />
            <Stat label="This week" value={s.week} />
            <Stat label="This month" value={s.month} />
            <Stat label="This year" value={s.year} />
          </View>

          <Card>
            <Text style={{ color: colors.muted, fontWeight: '700' }}>LAST 7 DAYS</Text>
            <Bars days={s.last7} />
          </Card>

          <Card>
            <Row><Body muted>Today's revenue</Body><Body strong>{pesoText(s.today)}</Body></Row>
            <Row><Body muted>Entries scanned today</Body><Body strong>{String(s.todayEntries)}</Body></Row>
          </Card>
          <Body muted>Only synced pages are counted. Pages waiting on a phone appear once they upload.</Body>
        </>
      ) : null}
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card style={{ flexGrow: 1, flexBasis: '45%', gap: 4 }}>
      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' }}>{label}</Text>
      <Text style={{ color: colors.accent, fontSize: 22, fontWeight: '800' }}>{pesoText(value)}</Text>
    </Card>
  );
}

function Bars({ days }: { days: Array<{ date: string; total: number }> }) {
  const max = Math.max(...days.map((d) => d.total), 1);
  return (
    <View accessibilityLabel={`Revenue of the last seven days: ${days.map((d) => `${weekdayShort(d.date)} ${pesoText(d.total)}`).join(', ')}`} style={{ flexDirection: 'row', gap: 8, height: 150 }}>
      {days.map((d) => (
        <View key={d.date} style={{ flex: 1, gap: 6 }}>
          {/* The bar area has its own height, so the bar can never reach the label below it. */}
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            <View style={{ width: '100%', height: `${Math.max((d.total / max) * 100, d.total > 0 ? 4 : 0)}%`, backgroundColor: colors.accent, borderRadius: 4 }} />
          </View>
          <Text style={{ color: colors.muted, fontSize: 11, textAlign: 'center' }}>{weekdayShort(d.date)}</Text>
        </View>
      ))}
    </View>
  );
}
