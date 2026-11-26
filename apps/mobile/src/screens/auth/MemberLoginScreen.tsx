import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CODE_MAX_LENGTH, cleanCode, isCompleteCode, resendLabel, resendSecondsLeft } from '../../memberCode';
import type { AuthStackParams } from '../../navigation/types';
import { messageOf, useServices } from '../../state';
import { Body, Button, Field, Logo, Notice, Screen, Title, colors } from '../../ui';
import { VersionLabel } from '../../UpdateModal';

/**
 * Member sign-in in two steps: type the email, then type the code that was emailed. There is no link to
 * open, so it works from any email app and even when the email is read on another device.
 */
export default function MemberLoginScreen({ navigation }: NativeStackScreenProps<AuthStackParams, 'MemberLogin'>) {
  const { auth } = useServices();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  // 'code' is the second step. sentAt stays empty when the member says they already have a code (from the invite email),
  // because asking for a new one could cancel the one they hold.
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  // Counts down the wait before another code may be asked for.
  useEffect(() => {
    if (sentAt === null) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [sentAt]);

  const waiting = sentAt === null ? 0 : resendSecondsLeft(sentAt, now);

  const validEmail = () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const send = async () => {
    if (!validEmail()) return setError('Enter a valid email address.');
    setBusy(true);
    setError(undefined);
    try {
      await auth.requestMemberCode(email);
      setCode('');
      setNow(Date.now());
      setSentAt(Date.now());
      setStep('code');
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  };

  const signIn = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await auth.verifyMemberCode(email, code);
    } catch (err) {
      setError(messageOf(err));
      setBusy(false);
    }
    // On success the app switches to the member screens by itself, so there is nothing more to do here.
  };

  /** Goes to the code step without sending anything: the code from the invite email is still good. */
  const haveCode = () => {
    if (!validEmail()) return setError('Enter your email address first.');
    setError(undefined);
    setCode('');
    setSentAt(null);
    setStep('code');
  };

  const changeEmail = () => {
    setStep('email');
    setSentAt(null);
    setCode('');
    setError(undefined);
  };

  return (
    <Screen>
      <View style={{ alignItems: 'center', paddingTop: 36, paddingBottom: 12 }}>
        <Logo width={210} />
      </View>
      <Title sub="No password needed.">Member sign in</Title>
      {error ? <Notice kind="error">{error}</Notice> : null}

      {step === 'email' ? (
        <>
          <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" />
          <Button title="Send Code" onPress={send} busy={busy} />
          <Pressable accessibilityRole="link" onPress={haveCode} style={{ alignItems: 'center', padding: 8 }}>
            <Text style={{ color: colors.accent, fontWeight: '600' }}>I already have a code</Text>
          </Pressable>
          <Body muted>Not a member yet, or no access? Ask the front desk to invite you.</Body>
        </>
      ) : (
        <>
          <Notice kind="ok">
            {sentAt === null
              ? `Type the code from your invite email for ${email.trim()}.`
              : `If ${email.trim()} has been invited, a code is on its way. Type it below. It may take a minute to arrive.`}
          </Notice>
          <Field
            label="Code from the email"
            value={code}
            onChangeText={(t) => setCode(cleanCode(t))}
            keyboardType="number-pad"
            maxLength={CODE_MAX_LENGTH}
            autoComplete="sms-otp"
            textContentType="oneTimeCode"
            autoFocus
          />
          <Button title="Sign In" onPress={signIn} busy={busy} disabled={!isCompleteCode(code)} />
          <Button small kind="secondary" title={resendLabel(waiting)} onPress={send} disabled={waiting > 0 || busy} />
          <Pressable accessibilityRole="link" onPress={changeEmail} style={{ alignItems: 'center', padding: 8 }}>
            <Text style={{ color: colors.muted, fontWeight: '600' }}>Use a different email</Text>
          </Pressable>
        </>
      )}

      <Pressable accessibilityRole="link" onPress={() => navigation.navigate('Login')} style={{ alignItems: 'center', padding: 12 }}>
        <Text style={{ color: colors.accent, fontWeight: '600' }}>Staff and owner sign in</Text>
      </Pressable>
      <VersionLabel />
    </Screen>
  );
}
