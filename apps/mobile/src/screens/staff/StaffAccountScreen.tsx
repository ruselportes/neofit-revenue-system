import { Text, View } from 'react-native';
import { confirmAsync, notify } from '../../platform/confirm';
import { SyncCard } from '../../SyncCard';
import { messageOf, useAuthState, useServices } from '../../state';
import { VersionLabel } from '../../UpdateModal';
import { Badge, Body, Button, Card, InitialsTile, Screen, colors } from '../../ui';

/** A staff member's own page: who they are, whether their pages have uploaded, the app version and Sign Out. */
export default function StaffAccountScreen() {
  const { auth, queue } = useServices();
  const state = useAuthState();
  const profile = state.kind === 'staff' ? state.profile : null;

  const signOut = async () => {
    const waiting = await queue.pendingCount().catch(() => 0);
    const ok = await confirmAsync(
      'Sign out?',
      waiting > 0
        ? `${waiting} ${waiting === 1 ? 'page has' : 'pages have'} not uploaded yet. They stay on this phone and upload once someone signs in with a connection.`
        : 'You will need to sign in again to scan.',
      'Sign out',
      true,
    );
    if (!ok) return;
    try {
      await auth.signOut();
    } catch (err) {
      notify('Could not sign out', messageOf(err));
    }
  };

  return (
    <Screen brand>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 }}>
        <InitialsTile name={profile?.fullName ?? ''} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={1} style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>{profile?.fullName ?? ''}</Text>
          <Body muted>{profile?.email ?? ''}</Body>
        </View>
        <Badge tone="info" text="Staff" />
      </Card>
      <SyncCard />
      <Button title="Sign Out" kind="danger" onPress={signOut} />
      <VersionLabel />
    </Screen>
  );
}
