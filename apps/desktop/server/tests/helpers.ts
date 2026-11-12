import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { BcryptHasher } from '../src/services/security';
import { ServerConfig } from '../src/config/ServerConfig';
import { Container, type ContainerOverrides } from '../src/Container';
import { createApp } from '../src/http/createApp';
import type { IClock } from '@neofit/core';

export const ADMIN = { email: 'admin@neofit.test', password: 'correct-horse-battery' };

export class FixedClock implements IClock {
  constructor(public date = new Date(2026, 10, 4, 10, 0, 0)) {}
  now(): Date {
    return this.date;
  }
}

export class TestServer {
  private constructor(
    readonly container: Container,
    readonly clock: FixedClock,
    private readonly server: Server,
    readonly url: string,
  ) {}

  static async start(overrides: ContainerOverrides = {}, seedAdmin = true): Promise<TestServer> {
    const clock = new FixedClock();
    const config = ServerConfig.from({
      jwtSecret: 'test-secret-test-secret-test-secret-1234',
      dbPath: ':memory:',
      port: 0,
      tokenTtl: '1h',
      corsOrigins: ['http://localhost:5173'],
      adminEmail: seedAdmin ? ADMIN.email : undefined,
      adminPassword: seedAdmin ? ADMIN.password : undefined,
    });
    const container = new Container(config, { clock, hasher: new BcryptHasher(4), ...overrides });
    await container.initialize();
    const server = await new Promise<Server>((resolve) => {
      const s = createApp(container).listen(0, '127.0.0.1', () => resolve(s));
    });
    return new TestServer(container, clock, server, `http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  }

  async stop(): Promise<void> {
    await new Promise((r) => this.server.close(r));
    this.container.close();
  }

  async request(method: string, path: string, body?: unknown, token?: string) {
    const res = await fetch(this.url + path, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : undefined };
  }

  /** A file download: the status, the headers and the bytes. */
  async download(path: string, token?: string) {
    const res = await fetch(this.url + path, { headers: token ? { authorization: `Bearer ${token}` } : {} });
    return { status: res.status, headers: res.headers, bytes: Buffer.from(await res.arrayBuffer()) };
  }

  async login(): Promise<string> {
    const res = await this.request('POST', '/api/login', ADMIN);
    return res.body.token as string;
  }
}
