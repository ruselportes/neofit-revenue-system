/** What is wrong with a new password typed twice, or null when it can be saved. */
export function passwordProblem(password: string, again: string): string | null {
  if (password.length < 8) return 'The new password must be at least 8 characters.';
  if (password !== again) return 'The two passwords are not the same.';
  return null;
}
