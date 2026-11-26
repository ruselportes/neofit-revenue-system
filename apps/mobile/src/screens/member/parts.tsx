import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { RatePeriod } from '../../memberView';
import { Card, colors } from '../../ui';

/** A payment in the member's list. The one that covers today has a solid date tile and a "Current" tag. */
export function PaymentRow({
  date,
  amount,
  period,
  receiptNo,
  current,
  onPress,
}: {
  date: { day: string; month: string };
  amount: string;
  period: string;
  receiptNo: string;
  current: boolean;
  onPress: () => void;
}) {
  const ink = current ? colors.accentText : colors.accent;
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}>
        <View style={{ width: 52, height: 56, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: current ? colors.accent : colors.surface2 }}>
          <Text style={{ color: ink, fontSize: 20, fontWeight: '900' }}>{date.day}</Text>
          <Text style={{ color: ink, fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>{date.month}</Text>
        </View>
        <View style={{ flex: 1, gap: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900' }}>{amount}</Text>
            {current ? (
              <View style={{ backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                <Text style={{ color: colors.accentText, fontSize: 11, fontWeight: '900' }}>Current</Text>
              </View>
            ) : null}
          </View>
          <Text numberOfLines={1} style={{ color: colors.text, fontSize: 13 }}>{period}</Text>
          <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12 }}>Receipt {receiptNo}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </Card>
    </Pressable>
  );
}

/** The receipt as a ticket: gym name, amount and PAID stamp, a tear line, then the details. */
export function Ticket({ amount, receiptNo, children }: { amount: string; receiptNo: string; children: ReactNode }) {
  const notch = { position: 'absolute' as const, top: 0, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.bg };
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: 14, overflow: 'hidden' }}>
      <View style={{ alignItems: 'center', gap: 4, padding: 20, paddingTop: 44 }}>
        <Text style={{ color: colors.muted, fontSize: 13, fontWeight: '800' }}>NeoFit Fitness Gym</Text>
        <Text style={{ color: colors.accent, fontSize: 40, fontWeight: '900' }}>{amount}</Text>
        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700' }}>Receipt no. {receiptNo}</Text>
        <View style={{ position: 'absolute', right: 14, top: 14, borderWidth: 2, borderColor: colors.accent, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3, transform: [{ rotate: '8deg' }] }}>
          <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '900', letterSpacing: 2 }}>PAID</Text>
        </View>
      </View>
      <View style={{ height: 20, justifyContent: 'center' }}>
        <View style={{ marginHorizontal: 18, borderTopWidth: 2, borderStyle: 'dashed', borderColor: colors.border }} />
        <View style={[notch, { left: -10 }]} />
        <View style={[notch, { right: -10 }]} />
      </View>
      <View style={{ paddingHorizontal: 18, paddingBottom: 10 }}>{children}</View>
    </View>
  );
}

export function TicketLine({ label, value, detail, first = false }: { label: string; value: string; detail?: string; first?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 16, paddingVertical: 11, borderTopWidth: first ? 0 : 1, borderTopColor: colors.border }}>
      <Text style={{ color: colors.muted, fontSize: 14, fontWeight: '700' }}>{label}</Text>
      <View style={{ flex: 1, alignItems: 'flex-end', gap: 2 }}>
        <Text style={{ color: colors.text, fontSize: 14, fontWeight: '800', textAlign: 'right' }}>{value}</Text>
        {detail ? <Text style={{ color: colors.muted, fontSize: 12, textAlign: 'right' }}>{detail}</Text> : null}
      </View>
    </View>
  );
}

const PERIODS: Array<{ value: RatePeriod; label: string }> = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'semi', label: 'Semi-monthly' },
  { value: 'daily', label: 'Daily' },
];

/** Monthly, Semi-monthly or Daily: which price the rate cards show. */
export function PeriodSwitch({ value, onChange }: { value: RatePeriod; onChange: (next: RatePeriod) => void }) {
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 999, padding: 4 }}>
      {PERIODS.map((p) => {
        const on = p.value === value;
        return (
          <Pressable
            key={p.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(p.value)}
            style={{ flex: 1, minHeight: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.accent : 'transparent' }}
          >
            <Text style={{ color: on ? colors.accentText : colors.muted, fontSize: 13, fontWeight: '900' }}>{p.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function RateCard({ name, detail, price, mine }: { name: string; detail: string; price: string; mine: boolean }) {
  return (
    <Card style={[{ flexDirection: 'row', alignItems: 'center', gap: 12 }, mine && { borderColor: colors.accent, borderWidth: 2, backgroundColor: colors.accentSoft }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '900' }}>{name}</Text>
          {mine ? (
            <View style={{ backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Text style={{ color: colors.accentText, fontSize: 11, fontWeight: '900' }}>Your plan</Text>
            </View>
          ) : null}
        </View>
        <Text style={{ color: colors.muted, fontSize: 13 }}>{detail}</Text>
      </View>
      <Text style={{ color: colors.text, fontSize: 20, fontWeight: '900' }}>{price}</Text>
    </Card>
  );
}

export function NewsCard({ label, title, body, date }: { label?: string; title: string; body: string; date: string }) {
  return (
    <Card style={{ gap: 6 }}>
      {label ? <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '800' }}>{label}</Text> : null}
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
        <Text style={{ flex: 1, color: colors.text, fontSize: 16, fontWeight: '900' }}>{title}</Text>
        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700' }}>{date}</Text>
      </View>
      <Text style={{ color: colors.text, fontSize: 13, lineHeight: 19 }}>{body}</Text>
    </Card>
  );
}
