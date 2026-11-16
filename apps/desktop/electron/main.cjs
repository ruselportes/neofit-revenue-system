const { app, BrowserWindow, ipcMain, shell } = require('electron');
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
    // Windows PowerShell and some editors save a byte-order mark, which JSON.parse rejects.
    saved = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
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

/**
 * The Supabase project URL and anon key that were built into this installer (see scripts/stage.mjs). Both are public by
 * design. Without them (a development run) the administrator types them in the "Connect to the cloud" form.
 */
function loadCloudDefaults() {
  try {
    const file = path.join(app.getAppPath(), 'app', 'cloud-defaults.json');
    const d = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { url: String(d.url || ''), anonKey: String(d.anonKey || '') };
  } catch {
    return { url: '', anonKey: '' };
  }
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
  // The project URL and anon key are built into the installer; the owner's login is the part the administrator adds.
  const defaults = loadCloudDefaults();
  const saved = config.cloud || {};
  const cloud = { url: saved.url || defaults.url, anonKey: saved.anonKey || defaults.anonKey, ownerEmail: saved.ownerEmail, ownerPassword: saved.ownerPassword };
  // The server wants all four values or none, so a URL and key without the owner's login is not passed on.
  const connected = !!(cloud.url && cloud.anonKey && cloud.ownerEmail && cloud.ownerPassword);
  const env = {
    ...process.env,
    JWT_SECRET: config.jwtSecret,
    DB_PATH: path.join(app.getPath('userData'), 'neofit.db'),
    PORT: String(port),
    CORS_ORIGINS: isDev ? DEV_URL : 'null',
    SUPABASE_URL: connected ? cloud.url : '',
    SUPABASE_ANON_KEY: connected ? cloud.anonKey : '',
    SUPABASE_OWNER_EMAIL: connected ? cloud.ownerEmail : '',
    SUPABASE_OWNER_PASSWORD: connected ? cloud.ownerPassword : '',
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
    icon: path.join(__dirname, 'neofit.ico'),
    backgroundColor: '#0a0a0a',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      additionalArguments: [
        `--neofit-version=${app.getVersion()}`,
        `--neofit-api=${apiUrl}`,
        // Tells the window that the project URL and anon key are built in, so the forms ask only for the owner's login.
        `--neofit-cloud-preset=${loadCloudDefaults().url ? '1' : '0'}`,
      ],
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
  else {
    await win.loadFile(path.join(app.getAppPath(), 'app', 'renderer', 'index.html'));
    startUpdater(win);
  }
}

let autoUpdater = null;

/**
 * Checks GitHub Releases for a newer version a few seconds after start (packaged builds only),
 * downloads it in the background and tells the window, which offers "Restart now".
 */
function startUpdater(win) {
  try {
    ({ autoUpdater } = require('electron-updater'));
  } catch (err) {
    console.warn('[updater] electron-updater is not available:', err.message);
    return;
  }
  const send = (channel, payload) => {
    if (!win.isDestroyed()) win.webContents.send(channel, payload);
  };
  autoUpdater.logger = {
    info: (m) => console.log('[updater]', m),
    warn: (m) => console.warn('[updater]', m),
    error: (m) => console.error('[updater]', m),
  };
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-available', (info) => send('update-available', info.version));
  autoUpdater.on('download-progress', (p) => send('download-progress', { percent: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded', (info) => send('update-downloaded', info.version));
  autoUpdater.on('error', (err) => console.error('[updater] error:', err.message));
  setTimeout(() => autoUpdater.checkForUpdates().catch((err) => console.error('[updater] check failed:', err.message)), 3000);
}

ipcMain.handle('install-update', () => {
  if (autoUpdater) autoUpdater.quitAndInstall();
});

/**
 * "Connect to the cloud" form: checks that the owner can sign in to the Supabase project, saves the
 * connection in the settings file (private to this user) and restarts the app so the local API picks it up.
 */
ipcMain.handle('save-cloud-config', async (_event, input) => {
  const checked = await checkCloudLogin(input);
  if (!checked.ok) return checked;

  const config = loadConfig();
  config.cloud = checked.cloud;
  fs.writeFileSync(path.join(app.getPath('userData'), 'neofit-config.json'), JSON.stringify(config, null, 2), { mode: 0o600 });
  setTimeout(() => {
    app.relaunch();
    app.exit(0);
  }, 800);
  return { ok: true };
});

/** Checks an owner login against Supabase without saving anything (used by the first-run setup before it creates the account). */
ipcMain.handle('check-cloud-login', async (_event, input) => {
  const checked = await checkCloudLogin(input);
  return checked.ok ? { ok: true } : checked;
});

/**
 * Signs in to Supabase as the owner to prove the login works. The project URL and anon key come from the form when it
 * has them, and otherwise from the installer; the administrator normally types only the email and password.
 */
async function checkCloudLogin(input) {
  const defaults = loadCloudDefaults();
  const url = String(input?.url || defaults.url || '').trim().replace(/\/+$/, '');
  const anonKey = String(input?.anonKey || defaults.anonKey || '').trim();
  const ownerEmail = String(input?.ownerEmail ?? '').trim();
  const ownerPassword = String(input?.ownerPassword ?? '');
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)) {
    return { ok: false, error: 'The project URL should look like https://<project>.supabase.co' };
  }
  if (!anonKey || !ownerEmail || !ownerPassword) return { ok: false, error: 'Fill in every field.' };

  try {
    const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: anonKey, 'content-type': 'application/json' },
      body: JSON.stringify({ email: ownerEmail, password: ownerPassword }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: `Supabase refused the sign-in: ${body.error_description || body.msg || res.status}. Check the email and password.` };
    }
  } catch (err) {
    return { ok: false, error: `Could not reach Supabase. Check the internet connection. (${err.message})` };
  }
  return { ok: true, cloud: { url, anonKey, ownerEmail, ownerPassword } };
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
