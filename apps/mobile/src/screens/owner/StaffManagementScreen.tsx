import { useState } from 'react';
import type { Profile } from '../../cloud/types';
import { confirmAsync, notify } from '../../platform/confirm';
import { messageOf, useAsync, useServices } from '../../state';
import { Badge, Body, Button, Card, Loading, Notice, Row, Screen, Title } from '../../ui';

export default function StaffManagementScreen() {
  const { profiles } = useServices();
  const staff = useAsync(() => profiles.staff(), []);
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

  const active = staff.data?.filter((p) => p.isActive).length ?? 0;
  const total = staff.data?.length ?? 0;

  return (
    <Screen onRefresh={staff.reload} refreshing={staff.loading}>
      <Title sub="Accounts are created in Supabase by the owner.">Staff</Title>
      {staff.error ? <Notice kind="error">{staff.error}</Notice> : null}
      {staff.loading && !staff.data ? <Loading /> : null}
      {staff.data ? (
        <Card>
          <Row><Body muted>Active</Body><Body strong>{String(active)}</Body></Row>
          <Row><Body muted>Disabled</Body><Body strong>{String(total - active)}</Body></Row>
          <Row><Body muted>Total</Body><Body strong>{String(total)}</Body></Row>
        </Card>
      ) : null}
      {staff.data?.map((p) => (
        <Card key={p.id}>
          <Row>
            <Body strong>{p.fullName}</Body>
            <Badge tone={p.isActive ? 'ok' : 'bad'} text={p.isActive ? 'Active' : 'Disabled'} />
          </Row>
          <Body muted>{p.email}</Body>
          <Button small kind={p.isActive ? 'danger' : 'secondary'} title={p.isActive ? 'Disable account' : 'Enable account'} busy={busyId === p.id} onPress={() => toggle(p)} />
        </Card>
      ))}
    </Screen>
  );
}
