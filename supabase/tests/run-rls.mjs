// Runs the security tests on a throwaway Postgres in Docker.
//   npm run test:rls -w @neofit/supabase
// Needs Docker. Uses the official postgres image and removes the container when done.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const NAME = 'neofit-rls-test';
const IMAGE = process.env.POSTGRES_IMAGE ?? 'postgres:16-alpine';

const docker = (args, input) => spawnSync('docker', args, { input, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const sql = (file) => readFileSync(join(here, file), 'utf8');

function cleanup() {
  docker(['rm', '-f', NAME]);
}

function fail(message) {
  console.error(message);
  cleanup();
  process.exit(1);
}

cleanup();
const started = docker(['run', '-d', '--rm', '--name', NAME, '-e', 'POSTGRES_PASSWORD=test', IMAGE]);
if (started.status !== 0) fail(`Could not start Postgres:\n${started.stderr}`);

// The image restarts Postgres once after its first start, so wait for two good answers in a row.
let ready = 0;
for (let i = 0; i < 60 && ready < 2; i++) {
  const ping = docker(['exec', NAME, 'psql', '-U', 'postgres', '-tAc', 'select 1']);
  ready = ping.status === 0 ? ready + 1 : 0;
  if (ready < 2) spawnSync(process.execPath, ['-e', 'setTimeout(()=>{},1000)']);
}
if (ready < 2) fail('Postgres did not become ready.');

const script = [
  sql('rls/00_supabase_stub.sql'),
  readFileSync(join(here, '..', 'migrations', '0001_schema.sql'), 'utf8'),
  sql('rls/10_rls_tests.sql'),
].join('\n;\n');

const run = docker(['exec', '-i', NAME, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q'], script);
const lines = (run.stderr ?? '').split(/\r?\n/);
const passes = lines.filter((l) => /NOTICE:\s+PASS:/.test(l));
for (const l of lines.filter((l) => /NOTICE:\s+(PASS|ALL)|ERROR|FAIL|DETAIL|CONTEXT|HINT/.test(l))) {
  console.log(l.replace(/^psql:.*?:\d+:\s*/, '').replace(/NOTICE:\s+/, ''));
}
cleanup();

if (run.status !== 0 || !lines.some((l) => l.includes('ALL SECURITY CHECKS PASSED'))) {
  console.error(`\nSecurity tests FAILED (${passes.length} checks passed before the failure).`);
  process.exit(1);
}
console.log(`\n${passes.length} security checks passed.`);
