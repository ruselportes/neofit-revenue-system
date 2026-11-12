// Development only: runs the local API against an in-memory stand-in for Supabase,
// with sample logbook pages, so the cloud screens can be tried without a Supabase project.
//   npm run dev:fake-cloud -w @neofit/desktop-server
// Data is lost when it stops. Open the app, create the administrator account, and look around.
import { randomBytes } from 'node:crypto';
import { ServerConfig } from '../src/config/ServerConfig';
import { Container } from '../src/Container';
import { createApp } from '../src/http/createApp';
import { FakeCloud } from '../tests/fakeCloud';

const cloud = new FakeCloud();
const today = new Date();
const day = (offset: number) => {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
cloud.seedPage(day(0), [['Ian', 450], ['Rose', 90], ['Jiany', 90], ['Walk-in', null]]);
cloud.seedPage(day(-1), [['Dimple', 20], ['AJ', 20], ['Matthew', 60]]);
cloud.seedPage(day(-3), [['Lorraine', 70], ['Nathalie', 70]]);
cloud.announcementList.push({ id: crypto.randomUUID(), title: 'Holiday hours', body: 'The gym closes at 6 PM on Nov 1.', postedAt: new Date().toISOString() });

const config = ServerConfig.from({
  jwtSecret: randomBytes(32).toString('hex'),
  dbPath: ':memory:',
  port: 3001,
  tokenTtl: '24h',
  corsOrigins: ['http://localhost:5173'],
});
const container = new Container(config, { cloud });
await container.initialize();
createApp(container).listen(config.port, config.host, () => {
  console.log(`Local API with a FAKE cloud on http://${config.host}:${config.port} (data is not saved)`);
});
