const { contextBridge, ipcRenderer } = require('electron');

// The version and the address of the local API are passed by main.cjs as command-line arguments,
// because a sandboxed preload script cannot read the app's information itself.
const arg = (name) => {
  const found = process.argv.find((a) => a.startsWith(`--${name}=`));
  return found ? found.slice(name.length + 3) : undefined;
};

contextBridge.exposeInMainWorld('neofit', {
  version: arg('neofit-version') ?? '1.0.0',
  apiUrl: arg('neofit-api'),
  // Updates arrive from GitHub Releases (packaged app only).
  onUpdateAvailable: (cb) => ipcRenderer.on('update-available', (_e, version) => cb(version)),
  onDownloadProgress: (cb) => ipcRenderer.on('download-progress', (_e, data) => cb(data.percent)),
  onUpdateDownloaded: (cb) => ipcRenderer.on('update-downloaded', (_e, version) => cb(version)),
  installUpdate: () => ipcRenderer.invoke('install-update'),
});
