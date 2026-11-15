import { useState, type ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Image,
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

// NeoFit's navy and green.
export const colors = {
  bg: '#0A0E1A',
  surface: '#131A2B',
  surface2: '#1B2438',
  border: '#243049',
  text: '#EAF0FF',
  muted: '#8A97B5',
  accent: '#3DDC97',
  accentText: '#04281A',
  accentSoft: 'rgba(61,220,151,0.14)',
  ok: '#3DDC97',
  danger: '#FF6B7A',
  warn: '#FFC15E',
};

/** The colour with transparency, for soft tinted backgrounds. */
const tint = (hex: string, alpha: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
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
        kind === 'danger' && { backgroundColor: tint(colors.danger, 0.1), borderWidth: 1, borderColor: tint(colors.danger, 0.5) },
        off && { opacity: 0.5 },
        pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={kind === 'primary' ? colors.accentText : colors.text} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            kind === 'primary' && styles.buttonTextPrimary,
            small && { fontSize: 14 },
            kind === 'danger' && { color: colors.danger },
          ]}
        >
          {kind === 'primary' ? title.toUpperCase() : title}
        </Text>
      )}
    </Pressable>
  );
}

/** A labelled text input. A password field (secureTextEntry) gets a show/hide button. */
export function Field({ label, error, secureTextEntry, ...input }: { label: string; error?: string } & TextInputProps) {
  const [shown, setShown] = useState(false);
  const border = error ? { borderColor: colors.danger } : null;
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      {secureTextEntry ? (
        <View style={[styles.input, styles.inputRow, border]}>
          <TextInput
            accessibilityLabel={label}
            placeholderTextColor={colors.muted}
            style={styles.inputBare}
            secureTextEntry={!shown}
            autoCapitalize="none"
            autoCorrect={false}
            {...input}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={shown ? 'Hide password' : 'Show password'}
            onPress={() => setShown((s) => !s)}
            hitSlop={10}
            style={{ paddingLeft: 10, paddingVertical: 8 }}
          >
            <Ionicons name={shown ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.muted} />
          </Pressable>
        </View>
      ) : (
        <TextInput accessibilityLabel={label} placeholderTextColor={colors.muted} style={[styles.input, border]} {...input} />
      )}
      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
    </View>
  );
}

export function Notice({ kind = 'info', children }: { kind?: 'info' | 'error' | 'warn' | 'ok'; children: ReactNode }) {
  const color = kind === 'error' ? colors.danger : kind === 'warn' ? colors.warn : kind === 'ok' ? colors.ok : colors.muted;
  return (
    <View
      accessibilityRole={kind === 'error' ? 'alert' : undefined}
      style={[styles.notice, { borderLeftColor: color, backgroundColor: kind === 'info' ? colors.surface : tint(color, 0.1) }]}
    >
      <Text style={{ color: kind === 'info' ? colors.text : color, fontSize: 14, lineHeight: 20 }}>{children}</Text>
    </View>
  );
}

export function Badge({ text, tone = 'info' }: { text: string; tone?: 'ok' | 'warn' | 'bad' | 'info' }) {
  const color = tone === 'ok' ? colors.ok : tone === 'warn' ? colors.warn : tone === 'bad' ? colors.danger : colors.muted;
  return (
    <View style={[styles.badge, { backgroundColor: tint(color, 0.15) }]}>
      <Text style={{ color, fontSize: 11, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' }}>{text}</Text>
    </View>
  );
}

/** The white NeoFit logo, for the sign-in screens. */
export function Logo({ width = 200 }: { width?: number }) {
  return (
    <Image
      source={require('../assets/logo.png')}
      accessibilityLabel="NeoFit Fitness Gym"
      style={{ width, height: width * (348 / 600), alignSelf: 'center' }}
      resizeMode="contain"
    />
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
  title: { color: colors.text, fontSize: 30, fontWeight: '900', letterSpacing: -0.5 },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  card: { backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 18, gap: 12 },
  label: { color: colors.muted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.2 },
  body: { color: colors.text, fontSize: 16, lineHeight: 22 },
  button: { minHeight: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  buttonSmall: { minHeight: 42, borderRadius: 12, paddingHorizontal: 14 },
  buttonText: { color: colors.text, fontSize: 16, fontWeight: '700' },
  buttonTextPrimary: { color: colors.accentText, fontWeight: '900', letterSpacing: 1.2 },
  input: { minHeight: 54, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2, color: colors.text, paddingHorizontal: 16, fontSize: 16 },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  inputBare: { flex: 1, minHeight: 52, color: colors.text, fontSize: 16, padding: 0 },
  notice: { borderLeftWidth: 4, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  loading: { alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
});
