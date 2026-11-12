import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

/**
 * In the finished app the page may only load its own files and talk to the local API on this computer.
 * (Development needs inline scripts for hot reloading, so the policy is added to the build only.)
 */
function contentSecurityPolicy(): Plugin {
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "connect-src 'self' http://127.0.0.1:* http://localhost:*",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');
  return {
    name: 'neofit-csp',
    apply: 'build',
    transformIndexHtml: (html) => html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`),
  };
}

export default defineConfig({
  plugins: [react(), contentSecurityPolicy()],
  base: './',
  server: { port: 5173, strictPort: true },
  test: { environment: 'node' },
});
