import { ServerConfig } from './config/ServerConfig';
import { Container } from './Container';
import { createApp } from './http/createApp';

async function main(): Promise<void> {
  const config = ServerConfig.fromEnv();
  const container = new Container(config, { onSyncError: (e) => console.error('Cloud sync failed:', e) });
  await container.initialize();
  container.cloud.start();

  const server = createApp(container).listen(config.port, config.host, () => {
    console.log(`NeoFit local API listening on http://${config.host}:${config.port}`);
  });

  const shutdown = () => {
    server.close(() => {
      container.close();
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
