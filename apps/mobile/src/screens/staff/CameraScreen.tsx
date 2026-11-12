import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { longDate, shiftDate, todayText } from '../../format';
import type { ScanStackParams } from '../../navigation/types';
import { notify } from '../../platform/confirm';
import { messageOf, useServices } from '../../state';
import { Badge, Body, Button, Card, Row, Screen, colors } from '../../ui';

export default function CameraScreen({ navigation }: NativeStackScreenProps<ScanStackParams, 'Camera'>) {
  const { scan } = useServices();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [date, setDate] = useState(todayText());
  const [remaining, setRemaining] = useState<{ left: number; limit: number; reset: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const today = todayText();

  // Refresh the scan counter whenever the screen comes back into view.
  useFocusEffect(
    useCallback(() => {
      let current = true;
      scan.limiter.usage().then((u) => current && setRemaining({ left: u.remaining, limit: u.limit, reset: scan.limiter.formatResetTime() }));
      return () => {
        current = false;
      };
    }, [scan]),
  );

  const go = (imageUri: string) => navigation.navigate('Review', { imageUri, date });

  const capture = async () => {
    if (!camera.current || busy) return;
    setBusy(true);
    try {
      const photo = await camera.current.takePictureAsync({ quality: 0.9 });
      if (photo?.uri) go(photo.uri);
    } catch (err) {
      notify('Could not take the picture', messageOf(err));
    } finally {
      setBusy(false);
    }
  };

  const pick = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
      const uri = result.assets?.[0]?.uri;
      if (!result.canceled && uri) go(uri);
    } catch (err) {
      notify('Could not open the gallery', messageOf(err));
    }
  };

  if (!permission) return <Screen><Body muted>Checking the camera…</Body></Screen>;

  return (
    <Screen scroll={false}>
      <Card>
        <Row>
          <Pressable accessibilityRole="button" accessibilityLabel="Earlier day" onPress={() => setDate(shiftDate(date, -1))} style={styles.arrow}>
            <Text style={styles.arrowText}>‹</Text>
          </Pressable>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>{longDate(date)}</Text>
            <Body muted>{date === today ? 'Log date: today' : 'Log date'}</Body>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Later day"
            disabled={date >= today}
            onPress={() => setDate(shiftDate(date, 1))}
            style={[styles.arrow, date >= today && { opacity: 0.3 }]}
          >
            <Text style={styles.arrowText}>›</Text>
          </Pressable>
        </Row>
        {remaining ? (
          <Badge
            tone={remaining.left > 0 ? 'ok' : 'warn'}
            text={remaining.left > 0 ? `${remaining.left} of ${remaining.limit} online scans left · resets ${remaining.reset}` : `No online scans left · resets ${remaining.reset} (pages are read on the phone)`}
          />
        ) : null}
      </Card>

      {permission.granted ? (
        <View style={styles.cameraWrap}>
          <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" />
          <View pointerEvents="none" style={styles.frame} />
        </View>
      ) : (
        <Card>
          <Body>NeoFit needs the camera to photograph the logbook page.</Body>
          <Button title="Allow camera" onPress={requestPermission} />
        </Card>
      )}

      <Body muted>Tip: use good lighting and keep the whole page inside the frame.</Body>
      <Row between>
        <Button title="Gallery" kind="secondary" onPress={pick} />
        <View style={{ flex: 1 }}>
          <Button title="Take picture" onPress={capture} busy={busy} disabled={!permission.granted} />
        </View>
      </Row>
    </Screen>
  );
}

const styles = StyleSheet.create({
  arrow: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  arrowText: { color: colors.text, fontSize: 28, marginTop: -3 },
  cameraWrap: { flex: 1, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000', minHeight: 240 },
  frame: { position: 'absolute', top: 18, bottom: 18, left: 18, right: 18, borderWidth: 2, borderColor: colors.accent, borderRadius: 12, opacity: 0.8 },
});
