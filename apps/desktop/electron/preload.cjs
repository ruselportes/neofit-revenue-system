const { contextBridge } = require('electron');

// The version and the address of the local API are passed by main.cjs as command-line arguments,
// because a sandboxed preload script cannot read the app's information itself.
const arg = (name) => {
  const found = process.argv.find((a) => a.startsWith(`--${name}=`));
  return found ? found.slice(name.length + 3) : undefined;
};

contextBridge.exposeInMainWorld('neofit', {
  version: arg('neofit-version') ?? '1.0.0',
  apiUrl: arg('neofit-api'),
});
