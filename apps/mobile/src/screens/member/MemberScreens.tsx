import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { MembershipSummary, type ReceiptData } from '@neofit/core';
import { dateOfIso, longDate, pesoText, shortDate, todayText } from '../../format';
import { dateTile } from '../../historyView';
import { currentPaymentId, groupByYear, periodRemaining, planRate, renewalPrice, splitPlan, type RatePeriod } from '../../memberView';
import type { MemberStackParams } from '../../navigation/types';
import { notify } from '../../platform/confirm';
import { messageOf, useAsync, useAuthState, useServices } from '../../state';
import { Badge, Body, Button, Card, GroupHeader, Loading, Notice, Row, Screen, StatusTone, Title, colors, statusColor } from '../../ui';
import { NewsCard, PaymentRow, PeriodSwitch, RateCard, Ticket, TicketLine } from './parts';

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
    // The rates are only for the renewal price; if they cannot be loaded, Home simply leaves the price out.
    const [account, payments, news, rates] = await Promise.all([
      members.accountById(accountId),
      members.payments(accountId),
      members.announcements(),
      members.rates().catch(() => []),
    ]);
    return { account: account ?? initial, last: payments[0] ?? null, news: news[0] ?? null, rates };
  }, [accountId]);

  // Turn on reminders once, quietly: a refusal or an emulator only means the Home notice has to do.
  useEffect(() => {
    notifications.enable(accountId).catch(() => false);
  }, [notifications, accountId]);

  const account = data.data?.account ?? initial;
  if (!account) return <Screen><Loading variant="page" /></Screen>;
  const today = todayText();
  const summary = new MembershipSummary(account.joinedDate, account.expiryDate, today);
  const status = summary.status;
  // One colour for the whole countdown, so it never disagrees with the badge: green, amber or red.
  const tone = statusColor(status);
  const plan = splitPlan(account.plan);
  const remaining = periodRemaining(account, data.data?.last ?? null, today);
  const start = data.data?.last?.periodStart ?? account.joinedDate;
  const price = summary.needsRenewalNotice ? renewalPrice(account.plan, data.data?.rates ?? []) : null;

  return (
    <Screen brand onRefresh={data.reload} refreshing={data.loading}>
      <Title sub="Welcome to NeoFit">{`Hi, ${account.name.split(' ')[0]}`}</Title>
      {data.error ? <Notice kind="error">{data.error}</Notice> : null}

      <Card>
        <Row>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>{plan.title}</Text>
            {plan.detail ? <Body muted>{plan.detail}</Body> : null}
            <Text style={{ color: colors.muted, fontSize: 13 }}>{account.memberId}</Text>
          </View>
          <Badge tone={StatusTone(status)} text={status} />
        </Row>
        <View style={{ alignItems: 'center', paddingVertical: 8 }}>
          <Text accessibilityLabel={`${summary.daysLeft} days left`} style={{ color: tone, fontSize: 64, fontWeight: '800' }}>{summary.daysLeft}</Text>
          <Body muted>{summary.daysLeft === 1 ? 'day left' : 'days left'}</Body>
        </View>
        {/* The bar is the time left in the current period, so it shrinks as the plan runs out. */}
        <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(remaining * 100) }} style={{ height: 8, backgroundColor: colors.surface2, borderRadius: 999, overflow: 'hidden' }}>
          <View style={{ width: `${remaining * 100}%`, height: '100%', backgroundColor: tone }} />
        </View>
        <View style={{ flexDirection: 'row', backgroundColor: colors.surface2, borderRadius: 12, paddingVertical: 12 }}>
          <View style={{ flex: 1, paddingHorizontal: 14, gap: 2 }}>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700' }}>{start && start > today ? 'Starts' : 'Started'}</Text>
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: '800' }}>{shortDate(start)}</Text>
          </View>
          <View style={{ width: 1, backgroundColor: colors.border }} />
          <View style={{ flex: 1, paddingHorizontal: 14, gap: 2, alignItems: 'flex-end' }}>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700' }}>{status === 'Expired' ? 'Plan ended' : 'Plan ends'}</Text>
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: '800' }}>{shortDate(account.expiryDate)}</Text>
          </View>
        </View>
      </Card>

      {summary.needsRenewalNotice ? (
        <Notice kind={status === 'Expired' ? 'error' : 'warn'}>
          {status === 'Expired' ? 'Your plan has ended.' : 'Your plan ends soon.'} Please renew at the NeoFit front desk on your next visit
          {price === null ? '.' : `: ${pesoText(price)}.`} Payments are not made in this app.
        </Notice>
      ) : null}

      {data.data?.last ? (
        <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Receipt', { paymentId: data.data!.last!.id })}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '800' }}>Last payment · {shortDate(dateOfIso(data.data.last.paidAt))}</Text>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900' }}>{pesoText(data.data.last.amount)}</Text>
            </View>
            <Text style={{ color: colors.accent, fontWeight: '800' }}>Receipt ›</Text>
          </Card>
        </Pressable>
      ) : null}

      {data.data?.news ? <NewsCard label="Latest news" title={data.data.news.title} body={data.data.news.body} date={shortDate(dateOfIso(data.data.news.postedAt))} /> : null}
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
  const groups = groupByYear(payments.data ?? []);
  const currentId = currentPaymentId(payments.data ?? [], todayText());

  return (
    <Screen brand onRefresh={payments.reload} refreshing={payments.loading}>
      <Title sub={`${thisYear.length} ${thisYear.length === 1 ? 'payment' : 'payments'} in ${year}`}>My Payments</Title>
      {payments.error ? <Notice kind="error">{payments.error}</Notice> : null}
      {payments.loading && !payments.data ? <Loading /> : null}
      {payments.data ? (
        <Card style={{ backgroundColor: colors.accentSoft, borderColor: 'transparent' }}>
          <Row><Body strong>Paid this year</Body><Text style={{ color: colors.accent, fontSize: 24, fontWeight: '900' }}>{pesoText(thisYear.reduce((s, p) => s + p.amount, 0))}</Text></Row>
        </Card>
      ) : null}
      {payments.data?.length === 0 ? <Body muted>No payments yet.</Body> : null}
      {groups.map((g) => (
        <View key={g.year} style={{ gap: 10 }}>
          {/* A year heading only helps once there is more than one year. */}
          {groups.length > 1 ? <GroupHeader title={g.year} detail={`${g.items.length} ${g.items.length === 1 ? 'payment' : 'payments'}`} total={pesoText(g.total)} /> : null}
          {g.items.map((p) => (
            <PaymentRow
              key={p.id}
              date={dateTile(dateOfIso(p.paidAt))}
              amount={pesoText(p.amount)}
              period={`${shortDate(p.periodStart)} – ${shortDate(p.periodEnd)}`}
              receiptNo={p.receiptNo}
              current={p.id === currentId}
              onPress={() => navigation.navigate('Receipt', { paymentId: p.id })}
            />
          ))}
        </View>
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

  const plan = splitPlan(receipt.plan);

  return (
    <Screen>
      {/* The title is the top bar's; the ticket starts with the gym's name. */}
      <Ticket amount={pesoText(receipt.amount)} receiptNo={receipt.receiptNo}>
        <TicketLine label="Date paid" value={longDate(receipt.paidOn)} first />
        <TicketLine label="Member" value={receipt.memberName} />
        <TicketLine label="Plan" value={plan.title} detail={plan.detail} />
        <TicketLine label="Period" value={`${shortDate(receipt.periodStart)} – ${shortDate(receipt.periodEnd)}`} />
        <TicketLine label="Paid at" value="NeoFit front desk" />
      </Ticket>
      <Body muted>This is a payment acknowledgment, not an official receipt of the Bureau of Internal Revenue.</Body>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><Button pill title="Save as PDF" onPress={() => run('pdf')} busy={busy === 'pdf'} /></View>
        <View style={{ flex: 1 }}><Button pill title="Share" kind="secondary" onPress={() => run('share')} busy={busy === 'share'} /></View>
      </View>
    </Screen>
  );
}

const PERIOD_NOUN: Record<RatePeriod, string> = { monthly: 'month', semi: 'half month', daily: 'day' };

/** One price per plan for the chosen period, with the member's own plan marked, then the announcements. */
export function MemberRatesScreen() {
  const { members } = useServices();
  const state = useAuthState();
  const mine = state.kind === 'member' ? planRate(state.account.plan) : null;
  const [chosen, setChosen] = useState<RatePeriod>();
  const period = chosen ?? mine?.period ?? 'monthly';
  const data = useAsync(async () => {
    const [rates, news] = await Promise.all([members.rates(), members.announcements()]);
    return { rates, news };
  }, []);

  return (
    <Screen brand onRefresh={data.reload} refreshing={data.loading}>
      <Title sub="Official prices and announcements">Rates & News</Title>
      {data.error ? <Notice kind="error">{data.error}</Notice> : null}
      {data.loading && !data.data ? <Loading /> : null}
      {data.data ? <PeriodSwitch value={period} onChange={setChosen} /> : null}
      {data.data?.rates.map((r) => (
        <RateCard
          key={`${r.category}|${r.type}`}
          name={r.category}
          detail={r.type}
          price={pesoText(r[period])}
          mine={mine?.category === r.category && mine.type === r.type}
        />
      ))}
      {data.data ? <Body muted>Prices per {PERIOD_NOUN[period]}. Pay at the front desk.</Body> : null}
      {data.data?.news.length ? <Text style={{ color: colors.accent, fontWeight: '900', marginTop: 6 }}>News</Text> : null}
      {data.data?.news.map((n) => (
        <NewsCard key={n.id} title={n.title} body={n.body} date={shortDate(dateOfIso(n.postedAt))} />
      ))}
    </Screen>
  );
}
