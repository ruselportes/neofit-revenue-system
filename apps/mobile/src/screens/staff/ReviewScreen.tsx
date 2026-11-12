import { useEffect, useState } from 'react';
import { Image, Pressable, Text, TextInput, View, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ReviewRowView, ReviewSession } from '@neofit/core';
import { v4 as uuid } from 'uuid';
import { entriesText, longDate, pesoText } from '../../format';
import type { ScanStackParams } from '../../navigation/types';
import { confirmAsync } from '../../platform/confirm';
import type { ScanOutcome } from '../../services/ScanService';
import { messageOf, useAuthState, useServices } from '../../state';
import { Badge, Body, Button, Card, Loading, Notice, Row, Screen, Title, colors } from '../../ui';

const engineLabel = (engine: string) => (engine === 'Gemini' ? 'Gemini 2.5 AI' : engine === 'ML Kit' ? 'Local ML Kit' : 'Manual entry');

export default function ReviewScreen({ route, navigation }: NativeStackScreenProps<ScanStackParams, 'Review'>) {
  const { imageUri, date } = route.params;
  const { scan, saver } = useServices();
  const auth = useAuthState();
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);
  const [session, setSession] = useState<ReviewSession | null>(null);
  const [used, setUsed] = useState<number | null>(null);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let current = true;
    scan
      .scan(imageUri, date)
      .then(async (result) => {
        if (!current) return;
        setOutcome(result);
        setSession(result.session);
        setUsed((await scan.limiter.usage()).used);
      })
      .catch((err) => current && setError(messageOf(err)));
    return () => {
      current = false;
    };
  }, [scan, imageUri, date]);

  if (error) {
    return (
      <Screen>
        <Title>Could not read the page</Title>
        <Notice kind="error">{error}</Notice>
        <Button title="Try another picture" onPress={() => navigation.goBack()} />
      </Screen>
    );
  }
  if (!session || !outcome) {
    return (
      <Screen>
        <Loading text="Reading the page…" />
      </Screen>
    );
  }

  const rows = session.rows();
  const total = session.total();

  const save = async () => {
    if (auth.kind !== 'staff') return;
    let upload;
    try {
      upload = session.confirm(uuid(), auth.profile.id);
    } catch (err) {
      return setError(messageOf(err));
    }
    const ok = await confirmAsync(
      'Save this page?',
      `${upload.totalEntries} ${upload.totalEntries === 1 ? 'entry' : 'entries'}\nLog date: ${longDate(upload.date)}\nTotal: ${pesoText(upload.totalAmount.pesos)}`,
      'Save',
    );
    if (!ok) return;
    setSaving(true);
    try {
      const result = await saver.save(upload);
      navigation.replace('Success', {
        date: upload.date,
        count: upload.totalEntries,
        total: upload.totalAmount.pesos,
        outcome: result,
        savedAt: new Date().toISOString(),
      });
    } catch (err) {
      setError(messageOf(err));
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Title sub={longDate(date)}>Review</Title>
      <Card>
        <Row>
          <Image source={{ uri: imageUri }} style={styles.thumb} accessibilityLabel="The page you photographed" />
          <View style={{ flex: 1, gap: 6 }}>
            <Body strong>{entriesText(session.count())}</Body>
            <Badge tone={outcome.engine === 'Gemini' ? 'ok' : 'warn'} text={engineLabel(outcome.engine)} />
            {used !== null ? <Body muted>Online scans used today: {used}</Body> : null}
          </View>
        </Row>
      </Card>

      {outcome.usedFallback && outcome.engine !== 'Manual' ? (
        <Notice kind="warn">{outcome.reason} Local results may be less accurate, so check every row.</Notice>
      ) : null}
      {outcome.engine === 'Manual' ? <Notice kind="warn">The page could not be read. Add the entries by hand.</Notice> : null}

      {rows.map((row) => (
        <RowEditor key={row.key} row={row} onChange={(change) => setSession(session.update(row.key, change))} onDelete={() => setSession(session.remove(row.key))} />
      ))}
      <Button title="+ Add a row" kind="secondary" onPress={() => setSession(session.add())} />

      <Card>
        <Row>
          <Body muted>Total</Body>
          <Text style={{ color: colors.accent, fontSize: 24, fontWeight: '800' }}>{pesoText(total.pesos)}</Text>
        </Row>
        <Body muted>Flags only help you check the page. A flagged value may still be correct.</Body>
      </Card>
      {auth.kind !== 'staff' ? <Notice kind="error">Sign in as staff to save.</Notice> : null}
      <Button title="Confirm & Save" onPress={save} busy={saving} disabled={session.count() === 0} />
    </Screen>
  );
}

function RowEditor({ row, onChange, onDelete }: { row: ReviewRowView; onChange: (c: { name?: string; amount?: number | null }) => void; onDelete: () => void }) {
  // The amount is kept as text while typing, so "70." does not turn into "70" under the user's finger.
  const [amountText, setAmountText] = useState(row.amount === null ? '' : String(row.amount));

  return (
    <Card style={{ gap: 8 }}>
      <Row>
        <TextInput
          accessibilityLabel="Name"
          value={row.name}
          placeholder="Name"
          placeholderTextColor={colors.muted}
          onChangeText={(name) => onChange({ name })}
          style={[styles.input, { flex: 2 }]}
        />
        <TextInput
          accessibilityLabel="Amount"
          value={amountText}
          placeholder="Amount"
          placeholderTextColor={colors.muted}
          keyboardType="decimal-pad"
          onChangeText={(text) => {
            const cleaned = text.replace(/[^0-9.]/g, '');
            setAmountText(cleaned);
            const value = cleaned === '' ? null : Number(cleaned);
            if (value === null || Number.isFinite(value)) onChange({ amount: value });
          }}
          style={[styles.input, { flex: 1, textAlign: 'right' }]}
        />
        <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${row.name || 'row'}`} onPress={onDelete} style={styles.delete}>
          <Text style={{ color: colors.danger, fontSize: 18 }}>✕</Text>
        </Pressable>
      </Row>
      {row.issues.length > 0 ? (
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {row.issues.includes('unofficial-amount') ? <Badge tone="warn" text="amount?" /> : null}
          {row.issues.includes('missing-amount') ? <Badge tone="info" text="no amount" /> : null}
          {row.issues.includes('duplicate') ? <Badge tone="warn" text="DUP" /> : null}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  thumb: { width: 72, height: 96, borderRadius: 8, backgroundColor: colors.surface2 },
  input: { minHeight: 48, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2, color: colors.text, paddingHorizontal: 12, fontSize: 16 },
  delete: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});

