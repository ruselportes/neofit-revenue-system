const { app, BrowserWindow, shell } = require('electron');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');

const DEV_URL = 'http://localhost:5173';
const isDev = !app.isPackaged;
const SERVER_DIR = path.join(__dirname, '..', 'server');

let serverProcess = null;
let quitting = false;
let apiUrl = '';

/**
 * The app's settings file, in its data folder. The JWT secret is made once, on the first run.
 * The optional "cloud" section connects the app to Supabase:
 *   { "jwtSecret": "...", "cloud": { "url": "https://<ref>.supabase.co", "anonKey": "...",
 *                                    "ownerEmail": "...", "ownerPassword": "..." } }
 */
function loadConfig() {
  const file = path.join(app.getPath('userData'), 'neofit-config.json');
  let saved = {};
  try {
    saved = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    // first run, or an unreadable file
  }
  if (typeof saved.jwtSecret !== 'string' || saved.jwtSecret.length < 32) {
    saved.jwtSecret = crypto.randomBytes(32).toString('hex');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(saved, null, 2), { mode: 0o600 });
  }
  return saved;
}

/** Asks the system for a free port on this computer, so a program already using 3001 cannot stop the app. */
function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

/**
 * Starts the local API as a child process.
 * In development it runs the TypeScript source with the regular Node: the SQLite module is built for
 * Node, not for Electron. The packaged app runs a bundled file with Electron's own Node, and the build
 * rebuilds the SQLite module for it.
 */
function startServer(port) {
  const config = loadConfig();
  const cloud = config.cloud || {};
  const env = {
    ...process.env,
    JWT_SECRET: config.jwtSecret,
    DB_PATH: path.join(app.getPath('userData'), 'neofit.db'),
    PORT: String(port),
    CORS_ORIGINS: isDev ? DEV_URL : 'null',
    SUPABASE_URL: cloud.url || '',
    SUPABASE_ANON_KEY: cloud.anonKey || '',
    SUPABASE_OWNER_EMAIL: cloud.ownerEmail || '',
    SUPABASE_OWNER_PASSWORD: cloud.ownerPassword || '',
  };

  let command;
  let args;
  if (isDev) {
    command = process.env.NEOFIT_NODE || 'node';
    args = ['--import', 'tsx', path.join(SERVER_DIR, 'src', 'main.ts')];
  } else {
    command = process.execPath;
    args = [path.join(app.getAppPath(), 'app', 'server', 'server.cjs')];
    env.ELECTRON_RUN_AS_NODE = '1';
  }

  serverProcess = spawn(command, args, { cwd: isDev ? SERVER_DIR : app.getPath('userData'), env, stdio: ['ignore', 'inherit', 'inherit'] });
  serverProcess.on('error', (err) => {
    console.error(`Could not start the local API (${command}): ${err.message}`);
    app.quit();
  });
  serverProcess.on('exit', (code) => {
    serverProcess = null;
    if (!quitting) {
      console.error(`Local API stopped (code ${code}).`);
      app.quit();
    }
  });
}

function stopServer() {
  quitting = true;
  if (serverProcess) serverProcess.kill();
}

function waitFor(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() > deadline) reject(new Error(`Timed out waiting for ${url}`));
        else setTimeout(attempt, 300);
      });
      req.setTimeout(2000, () => req.destroy());
    };
    attempt();
  });
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: 'NeoFit Revenue System',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      additionalArguments: [`--neofit-version=${app.getVersion()}`, `--neofit-api=${apiUrl}`],
    },
  });
  win.setMenuBarVisibility(false);
  win.once('ready-to-show', () => win.show());

  // Links open in the user's browser; the app window never navigates away.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(DEV_URL) && !url.startsWith('file://')) event.preventDefault();
  });

  if (isDev) await win.loadURL(DEV_URL);
  else await win.loadFile(path.join(app.getAppPath(), 'app', 'renderer', 'index.html'));
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.whenReady().then(async () => {
    try {
      const port = await freePort();
      apiUrl = `http://127.0.0.1:${port}`;
      startServer(port);
      await waitFor(`${apiUrl}/api/health`);
      if (isDev) await waitFor(DEV_URL);
      await createWindow();
      if (process.env.NEOFIT_SMOKE) console.log(`NEOFIT_SMOKE ready ${apiUrl}`);
    } catch (err) {
      console.error(err instanceof Error ? err.message : err);
      stopServer();
      app.quit();
    }
  });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', stopServer);
}
