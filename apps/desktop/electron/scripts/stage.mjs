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
