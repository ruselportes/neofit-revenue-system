import {
  MemberSync,
  RevenueEngine,
  SyncOutbox,
  SystemClock,
  type IClock,
  type ICloudPublisher,
} from '@neofit/core';
import type { ICloud } from './cloud/ports';
import { SupabaseCloud } from './cloud/SupabaseCloud';
import type { ServerConfig } from './config/ServerConfig';
import { AppDatabase } from './database/AppDatabase';
import { CloudNotConfiguredError } from './errors';
import { LogbookBackupRepository } from './repositories/LogbookBackupRepository';
import { MemberRepository } from './repositories/MemberRepository';
import { PaymentRepository } from './repositories/PaymentRepository';
import { RateRepository } from './repositories/RateRepository';
import { SettingsRepository } from './repositories/SettingsRepository';
import { SqliteOutboxStore } from './repositories/SqliteOutboxStore';
import { UserRepository } from './repositories/UserRepository';
import { AuthService } from './services/AuthService';
import { CloudSyncCoordinator } from './services/CloudSyncCoordinator';
import { LogbookService } from './services/LogbookService';
import { AnnouncementService, CloudPublisher, MemberAccessService } from './services/MemberCloudServices';
import { MemberService } from './services/MemberService';
import { PaymentService } from './services/PaymentService';
import { RateService } from './services/RateService';
import {
  CompositeRevenueSource,
  EmptyLogbookRecords,
  RevenueService,
  type ILogbookRecords,
} from './services/RevenueService';
import { BcryptHasher, TokenService, type IPasswordHasher } from './services/security';
import { SettingsService } from './services/SettingsService';

/** Parts that can be replaced: tests use fast hashing, a fixed clock and a fake cloud. */
export interface ContainerOverrides {
  clock?: IClock;
  hasher?: IPasswordHasher;
  /** A replacement for the Supabase cloud. */
  cloud?: ICloud;
  /** Logbook source used when there is no cloud. */
  logbook?: ILogbookRecords;
  publisher?: ICloudPublisher;
  onSyncError?: (error: unknown) => void;
}

/** Composition root: builds every object once and wires them together. */
export class Container {
  readonly clock: IClock;
  readonly database: AppDatabase;
  readonly tokens: TokenService;
  readonly auth: AuthService;
  readonly members: MemberService;
  readonly rates: RateService;
  readonly revenue: RevenueService;
  readonly settings: SettingsService;
  readonly cloud: CloudSyncCoordinator;

  /** Present only when the cloud connection is configured. */
  private readonly cloudServices?: {
    logbook: LogbookService;
    memberAccess: MemberAccessService;
    announcements: AnnouncementService;
  };

  constructor(
    readonly config: ServerConfig,
    overrides: ContainerOverrides = {},
  ) {
    this.clock = overrides.clock ?? new SystemClock();
    this.database = new AppDatabase(config.dbPath);

    const memberRepo = new MemberRepository(this.database);
    const paymentRepo = new PaymentRepository(this.database);
    const rateRepo = new RateRepository(this.database);

    const remote: ICloud | undefined = overrides.cloud ?? (config.cloud ? new SupabaseCloud(config.cloud) : undefined);
    const publisher: ICloudPublisher | undefined =
      overrides.publisher ?? (remote ? new CloudPublisher(remote.members, memberRepo, paymentRepo, rateRepo) : undefined);

    const outbox = new SyncOutbox(new SqliteOutboxStore(this.database), publisher ?? neverPublishes);
    const memberSync = new MemberSync(outbox, { isInvited: async (id) => memberRepo.findById(Number(id))?.cloudId != null });
    this.cloud = new CloudSyncCoordinator(memberSync, publisher !== undefined, overrides.onSyncError);

    this.tokens = new TokenService(config.jwtSecret, config.tokenTtl);
    this.auth = new AuthService(new UserRepository(this.database), overrides.hasher ?? new BcryptHasher(), this.tokens);
    this.rates = new RateService(rateRepo, this.cloud);
    this.members = new MemberService(
      this.database,
      memberRepo,
      new PaymentService(paymentRepo, rateRepo),
      this.cloud,
      this.clock,
    );
    this.settings = new SettingsService(new SettingsRepository(this.database));

    let logbookSource: ILogbookRecords = overrides.logbook ?? new EmptyLogbookRecords();
    if (remote) {
      const logbook = new LogbookService(remote.logbook, new LogbookBackupRepository(this.database), this.clock);
      this.cloudServices = {
        logbook,
        memberAccess: new MemberAccessService(remote.members, memberRepo, paymentRepo, this.members),
        announcements: new AnnouncementService(remote.announcements),
      };
      logbookSource = logbook;
    }
    this.revenue = new RevenueService(
      new RevenueEngine(new CompositeRevenueSource(logbookSource, paymentRepo)),
      logbookSource,
    );
  }

  get cloudConfigured(): boolean {
    return this.cloudServices !== undefined;
  }

  /** The cloud-backed services; each call throws a 503 error when the cloud is not set up. */
  get logbook(): LogbookService {
    return this.needCloud().logbook;
  }
  get memberAccess(): MemberAccessService {
    return this.needCloud().memberAccess;
  }
  get announcements(): AnnouncementService {
    return this.needCloud().announcements;
  }

  /** First-run work: official rates and the administrator account. */
  async initialize(): Promise<void> {
    this.rates.ensureSeeded();
    await this.auth.seedAdmin(this.config.adminEmail, this.config.adminPassword);
  }

  close(): void {
    this.cloud.stop();
    this.database.close();
  }

  private needCloud() {
    if (!this.cloudServices) throw new CloudNotConfiguredError();
    return this.cloudServices;
  }
}

/** Placeholder publisher: the outbox only publishes when a real one is configured. */
const neverPublishes: ICloudPublisher = {
  async publish() {
    throw new Error('No cloud publisher is configured.');
  },
};
