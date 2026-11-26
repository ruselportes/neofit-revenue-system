// Raises the update number in src/appVersion.ts, then publishes an over-the-air update to the phones.
//   npm run publish:update -- "What changed"
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const message = process.argv.slice(2).join(' ').trim();
if (!message || /["%]/.test(message)) {
  console.error('Say what changed (without " or %):  npm run publish:update -- "What changed"');
  process.exit(1);
}

const file = new URL('../src/appVersion.ts', import.meta.url);
const before = readFileSync(file, 'utf8');
const found = before.match(/UPDATE_NUMBER = (\d+);/);
if (!found) {
  console.error('UPDATE_NUMBER was not found in src/appVersion.ts.');
  process.exit(1);
}
const next = Number(found[1]) + 1;
writeFileSync(file, before.replace(found[0], `UPDATE_NUMBER = ${next};`));

console.log(`Publishing update number ${next}...`);
const result = spawnSync(`npx --yes eas-cli update --channel preview --environment preview --message "${message}" --non-interactive`, {
  stdio: 'inherit',
  shell: true,
});

// A failed publish must not use up a number.
if (result.status !== 0) writeFileSync(file, before);
else console.log('Done. Commit src/appVersion.ts so the number is remembered.');
process.exit(result.status ?? 1);
