import { View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { longDate, pesoText, timeText } from '../../format';
import type { ScanStackParams } from '../../navigation/types';
import { Body, Button, Card, Notice, Row, Screen, Title } from '../../ui';

export default function SuccessScreen({ route, navigation }: NativeStackScreenProps<ScanStackParams, 'Success'>) {
  const { date, count, total, outcome, savedAt } = route.params;
  return (
    <Screen>
      <View style={{ height: 24 }} />
      <Title sub={outcome === 'synced' ? 'The page is saved to the cloud.' : 'No connection. The page is saved on this phone.'}>
        {outcome === 'synced' ? 'Saved' : 'Saved offline'}
      </Title>
      {outcome === 'queued' ? <Notice kind="warn">It will upload by itself when the phone is online. You can also pull down on History to try now.</Notice> : null}
      <Card>
        <Row><Body muted>Log date</Body><Body strong>{longDate(date)}</Body></Row>
        <Row><Body muted>Entries</Body><Body strong>{String(count)}</Body></Row>
        <Row><Body muted>Total</Body><Body strong>{pesoText(total)}</Body></Row>
        <Row><Body muted>Saved at</Body><Body strong>{timeText(savedAt)}</Body></Row>
      </Card>
      <Button title="Scan next page" onPress={() => navigation.popToTop()} />
      <Button title="View history" kind="secondary" onPress={() => navigation.getParent()?.navigate('History' as never)} />
    </Screen>
  );
}
