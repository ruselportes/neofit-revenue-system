// Builds the Windows app with electron-builder in a separate staging folder (.stage).
//   node scripts/stage.mjs          only prepares .stage
//   node scripts/stage.mjs --dir    also builds the unpacked app (dist/win-unpacked)
//   node scripts/stage.mjs --win    also builds the installer
//
// Why a separate folder: electron-builder installs the app's production dependencies where it runs.
// Run inside this workspace it would prune the whole project's shared node_modules (the test tools,
// Vite, Expo...). In .stage it has a package.json of its own and touches nothing else.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const electronDir = join(here, '..');
const stage = join(electronDir, '.stage');
const server = join(electronDir, '..', 'server', 'dist', 'server.cjs');
const renderer = join(electronDir, '..', 'renderer', 'dist');
const root = join(electronDir, '..', '..', '..');

for (const [what, path] of [['server bundle', server], ['renderer build', renderer]]) {
  if (!existsSync(path)) {
    console.error(`The ${what} is missing (${path}). Run "npm run build:desktop" from the project folder first.`);
    process.exit(1);
  }
}

const pkg = JSON.parse(readFileSync(join(electronDir, 'package.json'), 'utf8'));

rmSync(stage, { recursive: true, force: true });
mkdirSync(join(stage, 'app', 'server'), { recursive: true });
cpSync(server, join(stage, 'app', 'server', 'server.cjs'));
cpSync(renderer, join(stage, 'app', 'renderer'), { recursive: true });
cpSync(join(electronDir, 'main.cjs'), join(stage, 'main.cjs'));
cpSync(join(electronDir, 'preload.cjs'), join(stage, 'preload.cjs'));
cpSync(join(electronDir, 'neofit.ico'), join(stage, 'neofit.ico'));

writeFileSync(
  join(stage, 'package.json'),
  JSON.stringify(
    {
      name: 'neofit-revenue-system',
      version: pkg.version,
      description: pkg.description,
      author: pkg.author,
      main: 'main.cjs',
      dependencies: {
        'better-sqlite3': pkg.dependencies['better-sqlite3'],
        'electron-updater': pkg.dependencies['electron-updater'],
      },
      build: {
        ...pkg.build,
        directories: { output: '../dist' },
        files: [...pkg.build.files, 'neofit.ico'],
        win: { ...pkg.build.win, icon: 'neofit.ico' },
      },
    },
    null,
    2,
  ),
);
// The Supabase project URL and anon key are put into the app at build time, so the administrator never types them.
// Both are public by design (the phone app ships them too; Row-Level Security protects the data). The OWNER password
// is never baked in: the installer is public. The values come from the environment or from the phone app's .env,
// which is not committed, so they are not in the source code either.
function loadCloudDefaults() {
  const fromFile = (key) => {
    try {
      const text = readFileSync(join(root, 'apps', 'mobile', '.env'), 'utf8');
      return (new RegExp(`^${key}=(.*)$`, 'm').exec(text)?.[1] ?? '').trim().replace(/^["']|["']$/g, '');
    } catch {
      return '';
    }
  };
  const url = (process.env.NEOFIT_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || fromFile('EXPO_PUBLIC_SUPABASE_URL')).trim().replace(/\/+$/, '');
  const anonKey = (process.env.NEOFIT_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || fromFile('EXPO_PUBLIC_SUPABASE_ANON_KEY')).trim();
  return /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) && anonKey ? { url, anonKey } : null;
}
const defaults = loadCloudDefaults();
if (defaults) {
  writeFileSync(join(stage, 'app', 'cloud-defaults.json'), JSON.stringify(defaults));
  console.log(`Built in the Supabase project ${new URL(defaults.url).host} (URL and anon key only).`);
} else {
  console.warn('No Supabase URL and anon key found (set NEOFIT_SUPABASE_URL / NEOFIT_SUPABASE_ANON_KEY or fill apps/mobile/.env): the admin will have to type them.');
}
console.log(`Staged the app in ${stage}`);

const mode = process.argv.find((a) => a === '--dir' || a === '--win');
if (!mode) process.exit(0);

const builder = join(root, 'node_modules', 'electron-builder', 'cli.js');
const result = spawnSync(process.execPath, [builder, mode, '--projectDir', stage], {
  cwd: stage,
  stdio: 'inherit',
  env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false' },
});
process.exit(result.status ?? 1);
