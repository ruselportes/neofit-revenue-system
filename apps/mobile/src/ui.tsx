import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  Animated,
  Easing,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type DimensionValue,
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
  brand = false,
}: {
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  scroll?: boolean;
  padded?: boolean;
  /** Shows the NeoFit brand bar at the top. Used on the main screen of each tab. */
  brand?: boolean;
}) {
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      {brand ? <BrandBar /> : null}
      {scroll ? (
        <ScrollView
          contentContainerStyle={[padded && styles.content, { gap: 14 }]}
          keyboardShouldPersistTaps="handled"
          refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} /> : undefined}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.fill, padded ? styles.content : { gap: 0 }]}>{children}</View>
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
        <BusyBars color={kind === 'primary' ? colors.accentText : kind === 'danger' ? colors.danger : colors.text} />
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

/** Inside a busy button: three short pulsing bars instead of a spinner. */
function BusyBars({ color }: { color: string }) {
  const pulse = usePulse();
  return (
    <Animated.View accessibilityLabel="Working" style={{ flexDirection: 'row', gap: 6, opacity: pulse }}>
      {[22, 34, 22].map((w, i) => (
        <View key={i} style={{ width: w, height: 6, borderRadius: 3, backgroundColor: color }} />
      ))}
    </Animated.View>
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

/** A slim bar with the NF mark and the NEOFIT name, at the top of the main screens. */
export function BrandBar() {
  return (
    <View style={styles.brandBar} accessibilityRole="header" accessibilityLabel="NeoFit">
      <Image source={require('../assets/logo-mark.png')} style={{ width: 40, height: 18 }} resizeMode="contain" />
      <Text style={styles.brandText}>NEOFIT</Text>
      <View style={{ flex: 1 }} />
      <Text style={styles.brandSub}>FITNESS GYM</Text>
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

/** A gentle fade in and out, shared by every skeleton block. */
function usePulse() {
  const value = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.ease), useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(value, { toValue: 0.45, duration: 650, easing: Easing.inOut(Easing.ease), useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [value]);
  return value;
}

/** One grey placeholder block. */
export function Skeleton({ width = '100%', height = 14, radius = 8, style }: { width?: DimensionValue; height?: number; radius?: number; style?: StyleProp<ViewStyle> }) {
  const pulse = usePulse();
  return <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: colors.surface2, opacity: pulse }, style]} />;
}

/** A skeleton card shaped like a list item: a title line, a shorter line and an amount. */
function SkeletonItem() {
  return (
    <View style={[styles.card, { gap: 10 }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
        <Skeleton width="55%" height={16} />
        <Skeleton width={70} height={16} />
      </View>
      <Skeleton width="35%" height={12} />
    </View>
  );
}

/**
 * Placeholder while something loads: grey blocks in the shape of what is coming instead of a spinner.
 * `list` for lists of cards, `dashboard` for the stat tiles and chart, `rows` for a table, `page` for a whole screen.
 */
export function Loading({ text = 'Loading…', variant = 'list', caption }: { text?: string; variant?: 'list' | 'dashboard' | 'rows' | 'page'; caption?: string }) {
  let body: ReactNode;
  if (variant === 'dashboard') {
    body = (
      <>
        {[0, 1].map((r) => (
          <View key={r} style={{ flexDirection: 'row', gap: 12 }}>
            {[0, 1].map((c) => (
              <View key={c} style={[styles.card, { flex: 1, gap: 10 }]}>
                <Skeleton width="50%" height={11} />
                <Skeleton width="80%" height={22} />
              </View>
            ))}
          </View>
        ))}
        <View style={[styles.card, { gap: 12 }]}>
          <Skeleton width="35%" height={11} />
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 120 }}>
            {[40, 90, 20, 55, 70, 30, 100].map((h, i) => (
              <Skeleton key={i} height={h} radius={4} style={{ flex: 1 }} width={undefined} />
            ))}
          </View>
        </View>
      </>
    );
  } else if (variant === 'rows') {
    body = (
      <View style={[styles.card, { gap: 10, padding: 12 }]}>
        {Array.from({ length: 7 }, (_, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Skeleton width={18} height={12} />
            <Skeleton height={30} style={{ flex: 1 }} width={undefined} />
            <Skeleton width={80} height={30} />
          </View>
        ))}
      </View>
    );
  } else if (variant === 'page') {
    body = (
      <>
        <Skeleton width="45%" height={28} />
        <Skeleton width="65%" height={14} />
        <SkeletonItem />
        <SkeletonItem />
        <SkeletonItem />
      </>
    );
  } else {
    body = (
      <>
        <SkeletonItem />
        <SkeletonItem />
        <SkeletonItem />
        <SkeletonItem />
      </>
    );
  }
  return (
    <View style={{ gap: 12 }} accessible accessibilityRole="progressbar" accessibilityLabel={text}>
      {caption ? <Text style={[styles.muted, { textAlign: 'center' }]}>{caption}</Text> : null}
      {body}
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
  brandBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bg,
  },
  brandText: { color: colors.text, fontSize: 17, fontWeight: '900', fontStyle: 'italic', letterSpacing: 1.5 },
  brandSub: { color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 2 },
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
