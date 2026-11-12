import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export const colors = {
  bg: '#0A0E1A',
  surface: '#131A2B',
  surface2: '#1B2438',
  border: '#243049',
  text: '#EAF0FF',
  muted: '#8A97B5',
  accent: '#3DDC97',
  accentText: '#04281A',
  danger: '#FF6B7A',
  warn: '#FFC15E',
};

/** A scrolling page with the app's background. Pass `onRefresh` for pull-to-refresh. */
export function Screen({
  children,
  onRefresh,
  refreshing = false,
  scroll = true,
  padded = true,
}: {
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  scroll?: boolean;
  padded?: boolean;
}) {
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[padded && styles.content, { gap: 14 }]}
          keyboardShouldPersistTaps="handled"
          refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} /> : undefined}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.fill, padded && styles.content]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Title({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <View style={{ gap: 4 }}>
      <Text accessibilityRole="header" style={styles.title}>{children}</Text>
      {sub ? <Text style={styles.muted}>{sub}</Text> : null}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Label({ children }: { children: ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function Body({ children, muted, strong }: { children: ReactNode; muted?: boolean; strong?: boolean }) {
  return <Text style={[styles.body, muted && styles.muted, strong && { fontWeight: '700' }]}>{children}</Text>;
}

export function Button({
  title,
  onPress,
  kind = 'primary',
  busy = false,
  disabled = false,
  small = false,
}: {
  title: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'danger';
  busy?: boolean;
  disabled?: boolean;
  small?: boolean;
}) {
  const off = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy }}
      onPress={off ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        kind === 'primary' && { backgroundColor: colors.accent },
        kind === 'secondary' && { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border },
        kind === 'danger' && { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.danger },
        off && { opacity: 0.5 },
        pressed && { opacity: 0.8 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={kind === 'primary' ? colors.accentText : colors.text} />
      ) : (
        <Text style={[styles.buttonText, kind === 'primary' && { color: colors.accentText }, kind === 'danger' && { color: colors.danger }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Field({ label, error, ...input }: { label: string; error?: string } & TextInputProps) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        style={[styles.input, error ? { borderColor: colors.danger } : null]}
        {...input}
      />
      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
    </View>
  );
}

export function Notice({ kind = 'info', children }: { kind?: 'info' | 'error' | 'warn' | 'ok'; children: ReactNode }) {
  const color = kind === 'error' ? colors.danger : kind === 'warn' ? colors.warn : kind === 'ok' ? colors.accent : colors.muted;
  return (
    <View accessibilityRole={kind === 'error' ? 'alert' : undefined} style={[styles.notice, { borderColor: color }]}>
      <Text style={{ color: kind === 'info' ? colors.text : color }}>{children}</Text>
    </View>
  );
}

export function Badge({ text, tone = 'info' }: { text: string; tone?: 'ok' | 'warn' | 'bad' | 'info' }) {
  const color = tone === 'ok' ? colors.accent : tone === 'warn' ? colors.warn : tone === 'bad' ? colors.danger : colors.muted;
  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <Text style={{ color, fontSize: 12, fontWeight: '700' }}>{text}</Text>
    </View>
  );
}

export function Loading({ text = 'Loading…' }: { text?: string }) {
  return (
    <View style={styles.loading} accessibilityLabel={text}>
      <ActivityIndicator color={colors.accent} size="large" />
      <Text style={styles.muted}>{text}</Text>
    </View>
  );
}

export function Row({ children, between = true }: { children: ReactNode; between?: boolean }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: between ? 'space-between' : 'flex-start', gap: 10 }}>{children}</View>;
}

export function StatusTone(status: string): 'ok' | 'warn' | 'bad' | 'info' {
  return status === 'Active' ? 'ok' : status === 'Expiring Soon' ? 'warn' : status === 'Expired' ? 'bad' : 'info';
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  fill: { flex: 1, gap: 14 },
  content: { padding: 18, paddingBottom: 40 },
  title: { color: colors.text, fontSize: 26, fontWeight: '800' },
  muted: { color: colors.muted, fontSize: 14 },
  card: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 10 },
  label: { color: colors.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  body: { color: colors.text, fontSize: 16 },
  button: { minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  buttonSmall: { minHeight: 44, borderRadius: 12, paddingHorizontal: 14 },
  buttonText: { color: colors.text, fontSize: 16, fontWeight: '700' },
  input: { minHeight: 52, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2, color: colors.text, paddingHorizontal: 14, fontSize: 16 },
  notice: { borderWidth: 1, borderRadius: 12, padding: 12, backgroundColor: colors.surface },
  badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' },
  loading: { alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
});
