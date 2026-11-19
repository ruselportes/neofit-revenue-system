import { useState } from 'react';
import { Text, View } from 'react-native';
import type { Profile } from '../../cloud/types';
import { todayText } from '../../format';
import { activityText, staffActivity } from '../../historyView';
import { confirmAsync, notify } from '../../platform/confirm';
import { messageOf, useAsync, useServices } from '../../state';
import { Body, Button, Card, InitialsTile, Label, Loading, Notice, Screen, SummaryTiles, Title, colors } from '../../ui';

export default function StaffManagementScreen() {
  const { profiles, uploads } = useServices();
  const staff = useAsync(() => profiles.staff(), []);
  // What each person has uploaded. If it cannot be loaded the people still show, just without the muted line.
  const activity = useAsync(async () => staffActivity(await uploads.all(), todayText()), []);
  const [busyId, setBusyId] = useState<string>();

  const toggle = async (p: Profile) => {
    const disabling = p.isActive;
    const ok = await confirmAsync(
      disabling ? 'Disable this account?' : 'Enable this account?',
      disabling
        ? `${p.fullName} will not be able to sign in. Pages they already uploaded stay in the records.`
        : `${p.fullName} will be able to sign in again.`,
      disabling ? 'Disable' : 'Enable',
      disabling,
    );
    if (!ok) return;
    setBusyId(p.id);
    try {
      await profiles.setActive(p.id, !p.isActive);
      await staff.reload();
    } catch (err) {
      notify('Could not change the account', messageOf(err));
    } finally {
      setBusyId(undefined);
    }
  };

  const people = staff.data ?? [];
  const active = people.filter((p) => p.isActive);
  const disabled = people.filter((p) => !p.isActive);
  const today = todayText();

  const row = (p: Profile) => (
    <Card key={p.id} style={{ padding: 14, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <InitialsTile name={p.fullName} muted={!p.isActive} />
        <View style={{ flex: 1, gap: 2 }}>
          {/* No "Disabled" badge: the group heading, the grey tile and the Enable button already say it. */}
          <Text numberOfLines={1} style={{ color: p.isActive ? colors.text : colors.muted, fontSize: 17, fontWeight: '800' }}>{p.fullName}</Text>
          <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 14 }}>{p.email}</Text>
          {activity.data ? <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12 }}>{activityText(activity.data.get(p.id), today)}</Text> : null}
        </View>
      </View>
      {/* Small and to the side: disabling is rare, so it should not be the loudest thing on the screen. */}
      <View style={{ alignSelf: 'flex-end' }}>
        <Button small kind={p.isActive ? 'danger' : 'secondary'} title={p.isActive ? 'Disable account' : 'Enable account'} busy={busyId === p.id} onPress={() => toggle(p)} />
      </View>
    </Card>
  );

  return (
    <Screen brand onRefresh={staff.reload} refreshing={staff.loading}>
      <Title sub="Turn an account off to stop someone signing in.">Staff</Title>
      {staff.error ? <Notice kind="error">{staff.error}</Notice> : null}
      {staff.loading && !staff.data ? <Loading /> : null}
      {staff.data ? (
        <SummaryTiles
          tiles={[
            { label: 'Active', value: String(active.length) },
            { label: 'Disabled', value: String(disabled.length) },
            { label: 'Total', value: String(people.length) },
          ]}
        />
      ) : null}
      {active.map(row)}
      {disabled.length > 0 ? (
        <View style={{ gap: 10 }}>
          <Label>Disabled</Label>
          {disabled.map(row)}
        </View>
      ) : null}
      {staff.data && people.length === 0 ? <Body muted>No staff accounts yet.</Body> : null}
      {staff.data ? <Notice>New staff accounts are created in Supabase by the owner.</Notice> : null}
    </Screen>
  );
}
