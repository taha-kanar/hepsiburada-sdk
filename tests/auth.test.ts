import { describe, expect, it, vi } from 'vitest';
import { BasicAuthenticator, encodeBase64 } from '../src/index.js';
import { HepsiburadaClient } from '../src/index.js';
import { MERCHANT_ID, StubHttpClient, testClient } from './helpers.js';

const decode = (header: string): string =>
  Buffer.from(header.replace(/^Basic /, ''), 'base64').toString('utf8');

const request = {
  method: 'GET' as const,
  url: 'https://example.test/x',
  headers: {},
  context: { operationId: 'op', module: 'order', pathTemplate: '/x', attempt: 1, meta: {} },
};

describe('BasicAuthenticator', () => {
  it('puts the merchant id in the username slot by default', () => {
    const auth = new BasicAuthenticator({ merchantId: MERCHANT_ID, password: 'secret', userAgent: 'acme_dev' });

    const headers = auth.authenticate(request).headers;

    expect(decode(headers['authorization']!)).toBe(`${MERCHANT_ID}:secret`);
  });

  // The contested fact. Hepsiburada's own FAQ describes a separate integrator username, four
  // published PHP SDKs take one, and live testing against oms-external shows the merchant id is
  // what the slot actually accepts. Both readings have to work from one code path.
  it('uses an explicit username when one is given', () => {
    const auth = new BasicAuthenticator({
      merchantId: MERCHANT_ID,
      username: 'acme_dev',
      password: 'secret',
      userAgent: 'acme_dev',
    });

    expect(decode(auth.authenticate(request).headers['authorization']!)).toBe('acme_dev:secret');
  });

  it('sends the User-Agent verbatim', () => {
    const auth = new BasicAuthenticator({ merchantId: MERCHANT_ID, password: 'secret', userAgent: 'acme_dev' });

    expect(auth.authenticate(request).headers['user-agent']).toBe('acme_dev');
  });

  it('encodes non-ASCII credentials as UTF-8', () => {
    // Turkish integrator names are real; a Latin-1 btoa would mangle them into a 401.
    expect(Buffer.from(encodeBase64('ş:ğ'), 'base64').toString('utf8')).toBe('ş:ğ');
  });
});

describe('client authentication', () => {
  it('authenticates every request', async () => {
    const { client, http } = testClient({ body: [] });

    await client.orders.list();

    expect(decode(http.last.headers['authorization']!)).toBe(`${MERCHANT_ID}:test-service-key`);
    expect(http.last.headers['user-agent']).toBe('testintegrator_dev');
  });

  it('refuses to construct without a userAgent', () => {
    expect(
      () =>
        new HepsiburadaClient({
          merchantId: MERCHANT_ID,
          password: 'secret',
          userAgent: '',
          httpClient: new StubHttpClient(),
        })
    ).toThrow(/userAgent/);
  });

  // `{merchantId} - {AppName}` is the format most widely published online, and every decorated
  // variant of it is refused with a 401. Warn rather than throw: only the seller can know what
  // their registered name is, and a wrong refusal would be worse than a wrong success.
  it('warns when the userAgent looks like the widely-published, rejected format', () => {
    const warn = vi.fn();

    testClient({}, { userAgent: `${MERCHANT_ID} - SelfIntegration`, logger: { debug: vi.fn(), warn, error: vi.fn() } });

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('401'), expect.anything());
  });

  it('does not warn about an ordinary integrator name', () => {
    const warn = vi.fn();

    testClient({}, { userAgent: 'acme-dev', logger: { debug: vi.fn(), warn, error: vi.fn() } });

    expect(warn).not.toHaveBeenCalled();
  });
});
