/**
 * The sign-in code length is a Supabase dashboard setting (Authentication > Email > "Email OTP Length": 6 to 10 digits,
 * 8 by default on new projects), so the app accepts any length in that range instead of guessing one.
 */
export const CODE_MIN_LENGTH = 6;
export const CODE_MAX_LENGTH = 10;

/** Keeps only the digits of what was typed or pasted, at most CODE_MAX_LENGTH of them ("123 456" becomes "123456"). */
export function cleanCode(text: string): string {
  return text.replace(/\D/g, '').slice(0, CODE_MAX_LENGTH);
}

/** True once at least the shortest possible code is typed, so the Sign in button can be pressed (the server is the judge). */
export function isCompleteCode(text: string): boolean {
  return cleanCode(text).length >= CODE_MIN_LENGTH;
}

/** Seconds left before a new code may be asked for; 0 when it may be asked for now. */
export function resendSecondsLeft(sentAt: number, now: number, cooldownSeconds = 60): number {
  return Math.max(0, Math.ceil(cooldownSeconds - (now - sentAt) / 1000));
}

/** The label of the resend button: "Resend code", or how long to wait. */
export function resendLabel(secondsLeft: number): string {
  return secondsLeft > 0 ? `Resend code in ${secondsLeft}s` : 'Resend code';
}
