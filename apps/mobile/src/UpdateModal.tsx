import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Text, View } from 'react-native';
import * as Updates from 'expo-updates';
import { colors } from './ui';

type Phase = 'idle' | 'downloading' | 'restarting' | 'failed';

/**
 * Checks for an over-the-air update when the app opens. When one exists it shows a
 * "Updating" window while it downloads, then restarts the app on the new version.
 * Does nothing in development, in a browser, or when the app has no update address.
 */
export function UpdateModal() {
  const [phase, setPhase] = useState<Phase>('idle');

  useEffect(() => {
    if (!Updates.isEnabled) return;
    let cancelled = false;
    (async () => {
      try {
        const check = await Updates.checkForUpdateAsync();
        if (cancelled || !check.isAvailable) return;
        setPhase('downloading');
        const fetched = await Updates.fetchUpdateAsync();
        if (cancelled) return;
        if (!fetched.isNew) return setPhase('idle');
        setPhase('restarting');
        // A moment on screen so the person sees the update finished before the app restarts.
        await new Promise((resolve) => setTimeout(resolve, 900));
        await Updates.reloadAsync();
      } catch {
        // No connection or a server problem: keep using the current version, try again next launch.
        if (!cancelled) setPhase('failed');
        setTimeout(() => !cancelled && setPhase('idle'), 2500);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = phase !== 'idle';
  const text =
    phase === 'downloading' ? 'Downloading the latest version…' : phase === 'restarting' ? 'Update ready. Restarting…' : 'Could not update. Using the current version.';

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => undefined}>
      <View style={{ flex: 1, backgroundColor: 'rgba(5,8,16,0.88)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <View
          style={{
            width: '100%',
            maxWidth: 340,
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 16,
            padding: 24,
            alignItems: 'center',
            gap: 14,
          }}
        >
          {phase === 'failed' ? null : <ActivityIndicator size="large" color={colors.accent} />}
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>{phase === 'failed' ? 'Update skipped' : 'Updating NeoFit'}</Text>
          <Text style={{ color: colors.muted, fontSize: 14, textAlign: 'center' }}>{text}</Text>
        </View>
      </View>
    </Modal>
  );
}
