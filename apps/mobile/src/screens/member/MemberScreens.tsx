import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { MembershipSummary, type ReceiptData } from '@neofit/core';
import { dateOfIso, longDate, pesoText, shortDate, todayText } from '../../format';
import type { MemberStackParams } from '../../navigation/types';
import { confirmAsync, notify } from '../../platform/confirm';
import { messageOf, useAsync, useAuthState, useServices } from '../../state';
import { Badge, Body, Button, Card, Loading, Notice, Row, Screen, StatusTone, Title, colors } from '../../ui';

function useMemberAccountId(): string {
  const state = useAuthState();
  if (state.kind !== 'member') throw new Error('The member screens need a member to be signed in.');
  return state.account.id;
}

/** Plan, days left, the last payment and the latest announcement. */
export function MemberHomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MemberStackParams>>();
  const { members, notifications } = useServices();
  const state = useAuthState();
  const accountId = useMemberAccountId();
  const initial = state.kind === 'member' ? state.account : null;
  const data = useAsync(async () => {
    const [account, payments, news] = await Promise.all([members.accountById(accountId), members.payments(accountId), members.announcements()]);
    return { account: account ?? initial, last: payments[0] ?? null, news: news[0] ?? null };
  }, [accountId]);

  // Turn on reminders once, quietly: a refusal or an emulator only means the Home notice has to do.
  useEffect(() => {
    notifications.enable(accountId).catch(() => false);
  }, [notifications, accountId]);

  const account = data.data?.account ?? initial;
  if (!account) return <Screen><Loading variant="page" /></Screen>;
  const summary = new MembershipSummary(account.joinedDate, account.expiryDate, todayText());
  const status = summary.status;

  return (
    <Screen brand onRefresh={data.reload} refreshing={data.loading}>
      <Title sub="Welcome to NeoFit">{`Hi, ${account.name.split(' ')[0]}`}</Title>
      {data.error ? <Notice kind="error">{data.error}</Notice> : null}

      <Card>
        <Row>
          <View style={{ flex: 1 }}>
            <Body strong>{account.plan}</Body>
            <Body muted>{account.memberId}</Body>
          </View>
          <Badge tone={StatusTone(status)} text={status} />
        </Row>
        <View style={{ alignItems: 'center', paddingVertical: 8 }}>
          <Text accessibilityLabel={`${summary.daysLeft} days left`} style={{ color: colors.accent, fontSize: 64, fontWeight: '800' }}>{summary.daysLeft}</Text>
          <Body muted>{summary.daysLeft === 1 ? 'day left' : 'days left'}</Body>
        </View>
        <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(summary.progress * 100) }} style={{ height: 8, backgroundColor: colors.surface2, borderRadius: 999, overflow: 'hidden' }}>
          <View style={{ width: `${summary.progress * 100}%`, height: '100%', backgroundColor: status === 'Expired' ? colors.danger : colors.accent }} />
        </View>
        <Row><Body muted>Plan ends</Body><Body strong>{longDate(account.expiryDate)}</Body></Row>
      </Card>

      {summary.needsRenewalNotice ? (
        <Notice kind="warn">
          {status === 'Expired' ? 'Your plan has ended.' : 'Your plan ends soon.'} Please renew at the NeoFit front desk on your next visit. Payments are not made in this app.
        </Notice>
      ) : null}

      {data.data?.last ? (
        <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Receipt', { paymentId: data.data!.last!.id })}>
          <Card>
            <Text style={{ color: colors.muted, fontWeight: '700' }}>LAST PAYMENT</Text>
            <Row><Body strong>{pesoText(data.data.last.amount)}</Body><Body muted>{shortDate(dateOfIso(data.data.last.paidAt))}</Body></Row>
            <Text style={{ color: colors.accent }}>View receipt ›</Text>
          </Card>
        </Pressable>
      ) : null}

      {data.data?.news ? (
        <Card>
          <Text style={{ color: colors.muted, fontWeight: '700' }}>LATEST NEWS</Text>
          <Body strong>{data.data.news.title}</Body>
          <Body muted>{data.data.news.body}</Body>
        </Card>
      ) : null}
    </Screen>
  );
}

export function MemberPaymentsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MemberStackParams>>();
  const { members } = useServices();
  const accountId = useMemberAccountId();
  const payments = useAsync(() => members.payments(accountId), [accountId]);
  const year = todayText().slice(0, 4);
  const thisYear = (payments.data ?? []).filter((p) => dateOfIso(p.paidAt).startsWith(year));

  return (
    <Screen brand onRefresh={payments.reload} refreshing={payments.loading}>
      <Title sub={`${thisYear.length} ${thisYear.length === 1 ? 'payment' : 'payments'} in ${year}`}>My Payments</Title>
      {payments.error ? <Notice kind="error">{payments.error}</Notice> : null}
      {payments.loading && !payments.data ? <Loading /> : null}
      {payments.data ? (
        <Card>
          <Row><Body muted>Paid this year</Body><Text style={{ color: colors.accent, fontSize: 22, fontWeight: '800' }}>{pesoText(thisYear.reduce((s, p) => s + p.amount, 0))}</Text></Row>
        </Card>
      ) : null}
      {payments.data?.length === 0 ? <Body muted>No payments yet.</Body> : null}
      {payments.data?.map((p) => (
        <Pressable key={p.id} accessibilityRole="button" onPress={() => navigation.navigate('Receipt', { paymentId: p.id })}>
          <Card>
            <Row><Body strong>{shortDate(dateOfIso(p.paidAt))}</Body><Body strong>{pesoText(p.amount)}</Body></Row>
            <Body muted>{shortDate(p.periodStart)} – {shortDate(p.periodEnd)}</Body>
            <Body muted>Receipt {p.receiptNo}</Body>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}

export function ReceiptScreen({ route }: NativeStackScreenProps<MemberStackParams, 'Receipt'>) {
  const { members, documents } = useServices();
  const state = useAuthState();
  const accountId = useMemberAccountId();
  const payments = useAsync(() => members.payments(accountId), [accountId]);
  const [busy, setBusy] = useState<'pdf' | 'share'>();

  const payment = payments.data?.find((p) => p.id === route.params.paymentId);
  if (payments.error) return <Screen><Notice kind="error">{payments.error}</Notice></Screen>;
  if (!payment || state.kind !== 'member') return <Screen><Loading variant="page" /></Screen>;

  const receipt: ReceiptData = {
    receiptNo: payment.receiptNo,
    amount: payment.amount,
    memberName: state.account.name,
    memberId: state.account.memberId,
    plan: payment.plan,
    paidOn: dateOfIso(payment.paidAt),
    periodStart: payment.periodStart,
    periodEnd: payment.periodEnd,
  };

  const run = async (kind: 'pdf' | 'share') => {
    setBusy(kind);
    try {
      if (kind === 'pdf') await documents.saveReceiptAsPdf(receipt);
      else await documents.shareReceipt(receipt);
    } catch (err) {
      notify('Could not make the receipt', messageOf(err));
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <Screen>
      <Title sub="NeoFit Fitness Gym">Receipt</Title>
      <Card>
        <Text style={{ color: colors.accent, fontSize: 34, fontWeight: '800' }}>{pesoText(receipt.amount)}</Text>
        <Body muted>Receipt no. {receipt.receiptNo}</Body>
        <Row><Body muted>Date paid</Body><Body strong>{longDate(receipt.paidOn)}</Body></Row>
        <Row><Body muted>Member</Body><Body strong>{receipt.memberName}</Body></Row>
        <Row><Body muted>Plan</Body><View style={{ flex: 1, alignItems: 'flex-end' }}><Body strong>{receipt.plan}</Body></View></Row>
        <Row><Body muted>Period</Body><Body strong>{shortDate(receipt.periodStart)} – {shortDate(receipt.periodEnd)}</Body></Row>
        <Row><Body muted>Paid at</Body><Body strong>NeoFit front desk</Body></Row>
      </Card>
      <Body muted>This is a payment acknowledgment, not an official receipt of the Bureau of Internal Revenue.</Body>
      <Button title="Save as PDF" onPress={() => run('pdf')} busy={busy === 'pdf'} />
      <Button title="Share" kind="secondary" onPress={() => run('share')} busy={busy === 'share'} />
    </Screen>
  );
}

export function MemberRatesScreen() {
  const { members, auth } = useServices();
  const data = useAsync(async () => {
    const [rates, news] = await Promise.all([members.rates(), members.announcements()]);
    return { rates, news };
  }, []);

  return (
    <Screen brand onRefresh={data.reload} refreshing={data.loading}>
      <Title sub="Official prices and announcements">Rates & News</Title>
      {data.error ? <Notice kind="error">{data.error}</Notice> : null}
      {data.loading && !data.data ? <Loading /> : null}
      {data.data?.rates.map((r) => (
        <Card key={`${r.category}|${r.type}`}>
          <Body strong>{r.category}</Body>
          <Body muted>{r.type}</Body>
          <Row><Body muted>Monthly</Body><Body strong>{pesoText(r.monthly)}</Body></Row>
          <Row><Body muted>Semi-monthly</Body><Body strong>{pesoText(r.semi)}</Body></Row>
          <Row><Body muted>Daily</Body><Body strong>{pesoText(r.daily)}</Body></Row>
        </Card>
      ))}
      {data.data?.news.map((n) => (
        <Card key={n.id}>
          <Row><Body strong>{n.title}</Body></Row>
          <Body muted>{shortDate(dateOfIso(n.postedAt))}</Body>
          <Body>{n.body}</Body>
        </Card>
      ))}
      <Button
        title="Sign Out"
        kind="danger"
        onPress={async () => {
          if (await confirmAsync('Sign out?', 'You can sign in again with an email link.', 'Sign out', true)) await auth.signOut();
        }}
      />
    </Screen>
  );
}
