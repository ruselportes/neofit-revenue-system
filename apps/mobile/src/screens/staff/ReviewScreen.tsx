import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ReviewRowView, ReviewSession } from '@neofit/core';
import { v4 as uuid } from 'uuid';
import { entriesText, longDate, pesoText } from '../../format';
import type { ScanStackParams } from '../../navigation/types';
import { confirmAsync } from '../../platform/confirm';
import type { ScanOutcome } from '../../services/ScanService';
import { messageOf, useAuthState, useServices } from '../../state';
import { Badge, Button, Loading, Notice, Screen, Title, colors } from '../../ui';

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
      <Screen scroll={false} padded={false}>
        <PhotoPanel uri={imageUri} />
        <View style={{ padding: 12 }}>
          <Loading variant="rows" text="Reading the page…" caption="Reading the page…" />
        </View>
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
    <Screen scroll={false} padded={false}>
      <PhotoPanel uri={imageUri} />

      <View style={styles.summary}>
        <Text style={styles.summaryText} numberOfLines={1}>
          {longDate(date)} · {entriesText(session.count())}
        </Text>
        <Badge tone={outcome.engine === 'Gemini' ? 'ok' : 'warn'} text={engineLabel(outcome.engine)} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled">
        {outcome.usedFallback && outcome.engine !== 'Manual' ? (
          <Notice kind="warn">{outcome.reason} Local results may be less accurate, so check every row.</Notice>
        ) : null}
        {outcome.engine === 'Manual' ? <Notice kind="warn">The page could not be read. Add the entries by hand.</Notice> : null}

        <View style={styles.table}>
          <View style={styles.headRow}>
            <Text style={[styles.head, { width: 24 }]}>#</Text>
            <Text style={[styles.head, { flex: 1 }]}>Name</Text>
            <Text style={[styles.head, { width: 86, textAlign: 'right' }]}>Amount</Text>
            <View style={{ width: 34 }} />
          </View>
          {rows.map((row, i) => (
            <RowEditor
              key={row.key}
              index={i + 1}
              row={row}
              last={i === rows.length - 1}
              onChange={(change) => setSession(session.update(row.key, change))}
              onDelete={() => setSession(session.remove(row.key))}
            />
          ))}
          <Pressable accessibilityRole="button" onPress={() => setSession(session.add())} style={styles.addRow}>
            <Ionicons name="add-circle-outline" size={18} color={colors.accent} />
            <Text style={{ color: colors.accent, fontWeight: '700' }}>Add a row</Text>
          </Pressable>
        </View>

        <Text style={styles.hint}>Flags only help you check the page. A flagged value may still be correct.</Text>
        {used !== null ? <Text style={styles.hint}>Online scans used today: {used}</Text> : null}
        {auth.kind !== 'staff' ? <Notice kind="error">Sign in as staff to save.</Notice> : null}
      </ScrollView>

      <View style={styles.footer}>
        <View>
          <Text style={styles.footLabel}>TOTAL</Text>
          <Text style={styles.footTotal}>{pesoText(total.pesos)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Confirm & Save" onPress={save} busy={saving} disabled={session.count() === 0} />
        </View>
      </View>
    </Screen>
  );
}

/**
 * The photographed page, kept on screen while the rows are checked.
 * Zoom with the buttons, then drag to move around the page. Can be folded away to give the rows more room.
 */
function PhotoPanel({ uri }: { uri: string }) {
  const { width, height } = useWindowDimensions();
  const [open, setOpen] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [ratio, setRatio] = useState(4 / 3); // height / width, corrected once the picture loads

  useEffect(() => {
    Image.getSize(uri, (w, h) => w > 0 && setRatio(h / w), () => undefined);
  }, [uri]);

  const panelHeight = Math.round(height * 0.36);
  const imageWidth = width * zoom;
  const imageHeight = imageWidth * ratio;

  return (
    <View style={styles.photo}>
      <View style={styles.photoBar}>
        <Ionicons name="image-outline" size={16} color={colors.muted} />
        <Text style={styles.photoTitle}>Page photo</Text>
        <View style={{ flex: 1 }} />
        {open ? (
          <>
            <IconButton icon="remove" label="Zoom out" disabled={zoom <= 1} onPress={() => setZoom((z) => Math.max(1, z - 0.5))} />
            <Text style={styles.zoomText}>{zoom.toFixed(1)}×</Text>
            <IconButton icon="add" label="Zoom in" disabled={zoom >= 4} onPress={() => setZoom((z) => Math.min(4, z + 0.5))} />
          </>
        ) : null}
        <IconButton icon={open ? 'chevron-up' : 'chevron-down'} label={open ? 'Hide photo' : 'Show photo'} onPress={() => setOpen((o) => !o)} />
      </View>
      {open ? (
        <ScrollView style={{ height: panelHeight }} nestedScrollEnabled>
          <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={zoom > 1}>
            <Image
              source={{ uri }}
              style={{ width: imageWidth, height: imageHeight, backgroundColor: colors.surface2 }}
              resizeMode="contain"
              accessibilityLabel="The page you photographed"
            />
          </ScrollView>
        </ScrollView>
      ) : null}
    </View>
  );
}

function IconButton({ icon, label, onPress, disabled }: { icon: 'add' | 'remove' | 'chevron-up' | 'chevron-down'; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={disabled ? undefined : onPress} hitSlop={6} style={[styles.iconBtn, disabled && { opacity: 0.35 }]}>
      <Ionicons name={icon} size={18} color={colors.text} />
    </Pressable>
  );
}

function RowEditor({
  index,
  row,
  last,
  onChange,
  onDelete,
}: {
  index: number;
  row: ReviewRowView;
  last: boolean;
  onChange: (c: { name?: string; amount?: number | null }) => void;
  onDelete: () => void;
}) {
  // The amount is kept as text while typing, so "70." does not turn into "70" under the user's finger.
  const [amountText, setAmountText] = useState(row.amount === null ? '' : String(row.amount));
  const flagged = row.issues.length > 0;

  return (
    <View style={[styles.row, !last && styles.rowLine, flagged && styles.rowFlagged]}>
      <View style={styles.rowMain}>
        <Text style={styles.index}>{index}</Text>
        <TextInput
          accessibilityLabel={`Name, row ${index}`}
          value={row.name}
          placeholder="Name"
          placeholderTextColor={colors.muted}
          onChangeText={(name) => onChange({ name })}
          style={[styles.input, { flex: 1 }]}
        />
        <TextInput
          accessibilityLabel={`Amount, row ${index}`}
          value={amountText}
          placeholder="₱"
          placeholderTextColor={colors.muted}
          keyboardType="decimal-pad"
          onChangeText={(text) => {
            const cleaned = text.replace(/[^0-9.]/g, '');
            setAmountText(cleaned);
            const value = cleaned === '' ? null : Number(cleaned);
            if (value === null || Number.isFinite(value)) onChange({ amount: value });
          }}
          style={[styles.input, { width: 86, textAlign: 'right' }]}
        />
        <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${row.name || `row ${index}`}`} onPress={onDelete} hitSlop={6} style={styles.delete}>
          <Ionicons name="close" size={18} color={colors.danger} />
        </Pressable>
      </View>
      {flagged ? (
        <View style={styles.flags}>
          {row.issues.includes('unofficial-amount') ? <Badge tone="warn" text="amount?" /> : null}
          {row.issues.includes('missing-amount') ? <Badge tone="info" text="no amount" /> : null}
          {row.issues.includes('duplicate') ? <Badge tone="warn" text="DUP" /> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  photo: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  photoBar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6 },
  photoTitle: { color: colors.muted, fontSize: 12, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  zoomText: { color: colors.text, fontSize: 12, fontWeight: '700', minWidth: 30, textAlign: 'center' },
  iconBtn: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface2 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8 },
  summaryText: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '700' },
  listContent: { paddingHorizontal: 12, paddingBottom: 16, gap: 10 },
  table: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 6, backgroundColor: colors.surface2 },
  head: { color: colors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  row: { paddingHorizontal: 8, paddingVertical: 4 },
  rowLine: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  rowFlagged: { backgroundColor: 'rgba(255,193,94,0.06)' },
  rowMain: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  index: { width: 24, color: colors.muted, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  input: { height: 38, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2, color: colors.text, paddingHorizontal: 8, paddingVertical: 0, fontSize: 15 },
  delete: { width: 28, height: 38, alignItems: 'center', justifyContent: 'center' },
  flags: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', paddingLeft: 30, paddingTop: 4, paddingBottom: 2 },
  addRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg },
  footLabel: { color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  footTotal: { color: colors.accent, fontSize: 20, fontWeight: '900' },
});
