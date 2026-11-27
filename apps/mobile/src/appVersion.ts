/**
 * The fourth number of the version shown in the app ("1.0.0.1"). `npm run publish:update` raises it by one before it
 * publishes an over-the-air update. The first three numbers come from app.json and must NOT change for an update:
 * phones only take updates made for the version they were installed with.
 */
export const UPDATE_NUMBER = 5;

/** "1.0.0.1": the installed app version followed by the update number. */
export function versionText(base: string, updateNumber: number = UPDATE_NUMBER): string {
  return `${base}.${updateNumber}`;
}
