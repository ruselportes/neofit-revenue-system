import { Router } from 'express';
import type { AuthService } from '../services/AuthService';
import type { LogbookService } from '../services/LogbookService';
import type { AnnouncementService, MemberAccessService } from '../services/MemberCloudServices';
import type { MemberService } from '../services/MemberService';
import type { RateService } from '../services/RateService';
import { WordRevenueReport } from '../reports/WordRevenueReport';
import type { ReportExporter } from '../reports/ReportExporter';
import type { RevenueReport, RevenueService } from '../services/RevenueService';
import type { SettingsService } from '../services/SettingsService';
import { parseId } from '../util/validate';

/** A controller turns HTTP requests into service calls. It holds no business rules. */
export abstract class Controller {
  abstract router(): Router;
}

export class AuthController extends Controller {
  constructor(private readonly auth: AuthService) {
    super();
  }

  router(): Router {
    const r = Router();
    r.post('/login', async (req, res) => {
      res.json(await this.auth.login(req.body?.email, req.body?.password));
    });
    r.get('/setup/status', (_req, res) => void res.json({ needsSetup: this.auth.needsSetup() }));
    r.post('/setup', async (req, res) => {
      res.status(201).json(await this.auth.setup(req.body?.email, req.body?.password));
    });
    return r;
  }
}

export class MemberController extends Controller {
  constructor(private readonly members: MemberService) {
    super();
  }

  router(): Router {
    const r = Router();
    r.get('/members', (_req, res) => void res.json(this.members.list()));
    r.get('/members/summary', (_req, res) => void res.json(this.members.summary()));
    r.post('/members', async (req, res) => void res.status(201).json(await this.members.create(req.body)));
    r.get('/members/:id', (req, res) => void res.json(this.members.get(parseId(req.params.id))));
    r.put('/members/:id', async (req, res) => void res.json(await this.members.update(parseId(req.params.id), req.body)));
    r.delete('/members/:id', async (req, res) => {
      await this.members.delete(parseId(req.params.id));
      res.status(204).end();
    });
    r.get('/members/:id/payments', (req, res) => void res.json(this.members.paymentsOf(parseId(req.params.id))));
    r.post('/members/:id/renew', async (req, res) => {
      res.status(201).json(await this.members.renew(parseId(req.params.id), req.body));
    });
    return r;
  }
}

/** Features that need the cloud. The getters throw a 503 error when it is not set up. */
export interface CloudFeatures {
  readonly configured: boolean;
  readonly logbook: LogbookService;
  readonly memberAccess: MemberAccessService;
  readonly announcements: AnnouncementService;
}

export class CloudController extends Controller {
  constructor(
    private readonly cloud: CloudFeatures,
    private readonly today: () => string,
  ) {
    super();
  }

  router(): Router {
    const r = Router();
    r.get('/cloud/status', (_req, res) => void res.json({ configured: this.cloud.configured }));

    r.post('/members/:id/invite', async (req, res) => {
      res.json(await this.cloud.memberAccess.invite(parseId(req.params.id), req.body));
    });

    r.get('/announcements', async (_req, res) => void res.json(await this.cloud.announcements.list()));
    r.post('/announcements', async (req, res) => void res.status(201).json(await this.cloud.announcements.post(req.body)));
    r.delete('/announcements/:id', async (req, res) => {
      await this.cloud.announcements.remove(String(req.params.id));
      res.status(204).end();
    });

    r.get('/logbook', async (req, res) => {
      res.json(await this.cloud.logbook.day(String(req.query.date ?? this.today())));
    });
    r.get('/logbook/totals', async (req, res) => {
      const now = new Date();
      const year = req.query.year ? Number(req.query.year) : now.getFullYear();
      const month = req.query.month ? Number(req.query.month) : now.getMonth() + 1;
      res.json(await this.cloud.logbook.monthTotals(year, month));
    });
    r.post('/logbook/entries', async (req, res) => void res.status(201).json(await this.cloud.logbook.addEntries(req.body)));
    r.put('/logbook/entries/:id', async (req, res) => {
      res.json(await this.cloud.logbook.updateEntry(String(req.params.id), req.body));
    });
    r.delete('/logbook/entries/:id', async (req, res) => {
      await this.cloud.logbook.deleteEntry(String(req.params.id));
      res.status(204).end();
    });
    r.delete('/logbook', async (req, res) => {
      res.json({ deleted: await this.cloud.logbook.deleteDate(String(req.query.date ?? '')) });
    });
    return r;
  }
}

export class RateController extends Controller {
  constructor(private readonly rates: RateService) {
    super();
  }

  router(): Router {
    const r = Router();
    r.get('/rates', (_req, res) => void res.json(this.rates.list()));
    r.put('/rates', async (req, res) => void res.json(await this.rates.save(req.body)));
    r.post('/rates/reset', async (_req, res) => void res.json(await this.rates.reset()));
    return r;
  }
}

export class RevenueController extends Controller {
  constructor(
    private readonly revenue: RevenueService,
    private readonly now: () => Date,
    private readonly exporter: ReportExporter<RevenueReport>,
  ) {
    super();
  }

  router(): Router {
    const r = Router();
    r.get('/revenue', async (req, res) => {
      const now = this.now();
      const year = req.query.year ? Number(req.query.year) : now.getFullYear();
      const month = req.query.month ? Number(req.query.month) : now.getMonth() + 1;
      res.json(await this.revenue.report(year, month));
    });
    r.get('/revenue/report', async (req, res) => {
      const now = this.now();
      const year = req.query.year ? Number(req.query.year) : now.getFullYear();
      const month = req.query.month ? Number(req.query.month) : now.getMonth() + 1;
      const report = await this.revenue.report(year, month);
      const file = await this.exporter.export(report, now);
      // year and month were checked as whole numbers by the service, so the name is safe to put in a header.
      res
        .type(this.exporter.contentType)
        .set('Content-Disposition', `attachment; filename="${this.exporter.fileName(WordRevenueReport.label(report))}"`)
        .send(file);
    });
    return r;
  }
}

export class SettingsController extends Controller {
  constructor(private readonly settings: SettingsService) {
    super();
  }

  router(): Router {
    const r = Router();
    r.get('/settings', (_req, res) => void res.json(this.settings.get()));
    r.put('/settings', (req, res) => void res.json(this.settings.update(req.body)));
    return r;
  }
}
