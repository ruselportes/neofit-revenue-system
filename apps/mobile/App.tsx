import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ConfigError, loadConfig } from './src/config';
import RootNavigator from './src/navigation/RootNavigator';
import { Services } from './src/services/Services';
import { ServicesProvider } from './src/state';
import { UpdateModal } from './src/UpdateModal';
import { Loading, Notice, colors } from './src/ui';

const MEMBER_LINK_URL = 'neofit://auth';

export default function App() {
  // Created once. A missing setting shows a clear message instead of a blank screen.
  const built = useMemo(() => {
    try {
      // The sign-in link in a member's email opens this address; the "neofit" scheme in app.json routes it to the app.
      return { services: new Services(loadConfig(), MEMBER_LINK_URL) };
    } catch (err) {
      return { error: err instanceof ConfigError ? err.message : 'The app could not start.' };
    }
  }, []);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!built.services) return;
    built.services.auth.start().finally(() => setReady(true));
  }, [built.services]);

  if (!built.services) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: 24, gap: 12 }}>
        <Text style={{ color: colors.text, fontSize: 24, fontWeight: '800' }}>NeoFit</Text>
        <Notice kind="error">{built.error}</Notice>
        <Text style={{ color: colors.muted }}>Copy .env.example to .env, fill in the values and restart the app.</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <ServicesProvider value={built.services}>{ready ? <RootNavigator /> : <View style={{ flex: 1, backgroundColor: colors.bg, padding: 18, paddingTop: 60 }}><Loading variant="page" text="Starting…" /></View>}</ServicesProvider>
      <UpdateModal />
    </SafeAreaProvider>
  );
}
