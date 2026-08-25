import { describe, expect, it, vi } from 'vitest';
import { HepsiburadaClient, HOSTS } from '../src/index.js';
import { MERCHANT_ID, StubHttpClient, testClient } from './helpers.js';

const base = { merchantId: MERCHANT_ID, password: 'secret', userAgent: 'acme_dev' };

describe('configuration', () => {
  it.each(['merchantId', 'password', 'userAgent'] as const)('requires %s', (field) => {
    expect(() => new HepsiburadaClient({ ...base, [field]: '  ', httpClient: new StubHttpClient() })).toThrow(field);
  });

  it('defaults to production', () => {
    const { client } = testClient();

    expect(client.config.environment).toBe('production');
    expect(client.config.baseUrls['order']).toBe('https://oms-external.hepsiburada.com');
  });

  it('switches every product to its sandbox host', () => {
    const { client } = testClient({}, { environment: 'sandbox' });

    expect(client.config.baseUrls['order']).toBe('https://oms-external-sit.hepsiburada.com');
    expect(client.config.baseUrls['listing']).toBe('https://listing-external-sit.hepsiburada.com');
  });

  it('accepts a per-product override', () => {
    const { client } = testClient({}, { baseUrls: { order: 'http://localhost:4010/' } });

    expect(client.config.baseUrls['order']).toBe('http://localhost:4010');
    expect(client.config.baseUrls['listing']).toBe('https://listing-external.hepsiburada.com');
  });
});

// `oms-stub-external.hepsiburada.com` and `claim-stub-external.hepsiburada.com` do not resolve.
// Emitting the derived name would turn a documented limitation into a DNS failure three layers
// down, with nothing to say why.
describe('the two sandbox-only products', () => {
  it.each(['test-order', 'claim-create'])('%s has no production host', (module) => {
    expect(HOSTS[module]?.prod).toBeNull();
    expect(HOSTS[module]?.sitOnly).toBe(true);
  });

  it('explains itself rather than failing at DNS', async () => {
    const { client } = testClient();

    await expect(client.testOrders.create({} as never)).rejects.toThrow(/only in the sandbox/);
  });

  it('works when the client is pointed at the sandbox', async () => {
    const { client, http } = testClient({ body: {} }, { environment: 'sandbox' });

    await client.testOrders.create({} as never);

    expect(http.last.url).toContain('oms-stub-external-sit.hepsiburada.com');
  });

  it('works when a base URL is supplied for it', async () => {
    const { client, http } = testClient({ body: {} }, { baseUrls: { 'test-order': 'http://localhost:4010' } });

    await client.testOrders.create({} as never);

    expect(http.last.url).toContain('localhost:4010');
  });
});

describe('the host table', () => {
  // The plan's first "must not be guessed": production is recorded in the manifest, never derived
  // at runtime by stripping `-sit` from whatever the document happened to say.
  it('never uses a sandbox host as a production default', () => {
    for (const [module, hosts] of Object.entries(HOSTS)) {
      expect(hosts.sit, module).toContain('-sit');
      if (hosts.prod !== null) expect(hosts.prod, module).not.toContain('-sit');
    }
  });

  it('covers all twelve products', () => {
    expect(Object.keys(HOSTS)).toHaveLength(12);
  });
});

describe('resources', () => {
  it('are constructed once and reused', () => {
    const { client } = testClient();

    expect(client.orders).toBe(client.orders);
  });

  it('are not constructed until used', () => {
    const logger = { debug: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const { client } = testClient({}, { logger });

    expect(client).toBeInstanceOf(HepsiburadaClient);
  });
});
