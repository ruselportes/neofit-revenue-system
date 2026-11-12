import cors from 'cors';
import express, { type Express } from 'express';
import type { Container } from '../Container';
import { WordRevenueReport } from '../reports/WordRevenueReport';
import { formatDate } from '../util/dates';
import {
  AuthController,
  CloudController,
  MemberController,
  RateController,
  RevenueController,
  SettingsController,
} from './controllers';
import { errorHandler, requireAuth } from './middleware';

/** Builds the Express app. Public: /api/health and /api/login. Everything else needs a JWT. */
export function createApp(c: Container): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: c.config.corsOrigins }));
  app.use(express.json({ limit: '4mb' }));

  app.get('/api/health', (_req, res) => void res.json({ status: 'ok' }));
  app.use('/api', new AuthController(c.auth).router());

  const protectedApi = express.Router();
  protectedApi.use(requireAuth(c.tokens));
  for (const controller of [
    new MemberController(c.members),
    new CloudController(
      {
        get configured() {
          return c.cloudConfigured;
        },
        get logbook() {
          return c.logbook;
        },
        get memberAccess() {
          return c.memberAccess;
        },
        get announcements() {
          return c.announcements;
        },
      },
      () => formatDate(c.clock.now()),
    ),
    new RateController(c.rates),
    new RevenueController(c.revenue, () => c.clock.now(), new WordRevenueReport()),
    new SettingsController(c.settings),
  ]) {
    protectedApi.use(controller.router());
  }
  app.use('/api', protectedApi);

  app.use((_req, res) => void res.status(404).json({ error: 'Not found.' }));
  app.use(errorHandler());
  return app;
}
