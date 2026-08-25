import { describe, expect, it, vi } from 'vitest';
import {
  FetchHttpClient,
  HepsiburadaApiError,
  HepsiburadaAuthenticationError,
  HepsiburadaError,
  HepsiburadaParseError,
  toFormData,
  type Middleware,
} from '../src/index.js';
import { MERCHANT_ID, StubHttpClient, testClient } from './helpers.js';

describe('request assembly', () => {
  it('expands the path template and keeps the base URL of the module', async () => {
    const { client, http } = testClient({ body: [] });

    await client.orders.list();

    expect(http.last.url).toBe(`https://oms-external.hepsiburada.com/orders/merchantid/${MERCHANT_ID}`);
  });

  it('routes each product to its own host', async () => {
    const { client, http } = testClient({ body: {} });

    await client.orders.list();
    await client.listings.list({ offset: 0, limit: 50 });

    expect(http.requests[0]!.url).toContain('oms-external.hepsiburada.com');
    expect(http.requests[1]!.url).toContain('listing-external.hepsiburada.com');
  });

  it('drops undefined query parameters rather than sending them empty', async () => {
    const { client, http } = testClient({ body: [] });

    await client.orders.list({ limit: 50 });

    expect(http.query.get('limit')).toBe('50');
    expect(http.query.has('begindate')).toBe(false);
  });

  it('sets a JSON content type for a body, and none for FormData', async () => {
    const { client, http } = testClient({ body: {} });

    await client.request({ operationId: 'x', module: 'order', method: 'POST', path: '/x', body: { a: 1 } });
    expect(http.last.headers['content-type']).toBe('application/json');
    expect(http.last.body).toBe('{"a":1}');

    // fetch must choose the multipart boundary itself; forcing a content-type breaks the upload.
    await client.request({
      operationId: 'y',
      module: 'order',
      method: 'POST',
      path: '/y',
      body: toFormData({ file: { data: '[]', filename: 'p.json' } }),
    });
    expect(http.last.headers['content-type']).toBeUndefined();
  });

  it('carries the operation into the request context, for middleware', async () => {
    const { client, http } = testClient({ body: [] });

    await client.orders.list();

    expect(http.last.context).toMatchObject({
      operationId: 'getOrders',
      module: 'order',
      pathTemplate: '/orders/merchantid/{merchantId}',
    });
  });

  it('refuses a path template with a missing parameter', async () => {
    const { client } = testClient();

    await expect(
      client.request({ operationId: 'x', module: 'order', method: 'GET', path: '/orders/{id}' })
    ).rejects.toThrow(/Missing path parameter "id"/);
  });
});

describe('response decoding', () => {
  it('returns undefined for 204', async () => {
    const { client } = testClient({ status: 204, body: '' });

    await expect(client.request({ operationId: 'x', module: 'order', method: 'POST', path: '/x' })).resolves.toBeUndefined();
  });

  it('returns undefined for an empty 200', async () => {
    const { client } = testClient({ status: 200, body: '' });

    await expect(client.request({ operationId: 'x', module: 'order', method: 'POST', path: '/x' })).resolves.toBeUndefined();
  });

  // The listing service advertises XML on several endpoints and honours an Accept that asks for
  // it. Handing the text back beats failing to parse it.
  it('hands back a non-JSON body as text', async () => {
    const { client } = testClient({ headers: { 'content-type': 'application/xml' }, body: '<listings/>' });

    await expect(client.request({ operationId: 'x', module: 'listing', method: 'GET', path: '/x' })).resolves.toBe(
      '<listings/>'
    );
  });

  it('raises a parse error when JSON is promised and not delivered', async () => {
    const { client } = testClient({ body: '<html>gateway</html>' });

    await expect(client.request({ operationId: 'x', module: 'order', method: 'GET', path: '/x' })).rejects.toBeInstanceOf(
      HepsiburadaParseError
    );
  });
});

describe('failures', () => {
  it('maps a status to its class', async () => {
    const { client } = testClient({ status: 401, body: 'Missing Credentials!' });

    await expect(client.orders.list()).rejects.toBeInstanceOf(HepsiburadaAuthenticationError);
  });

  it('names the operation in the message', async () => {
    const { client } = testClient({ status: 400, body: { message: 'WrongDateFormat' } });

    await expect(client.orders.list()).rejects.toThrow(/getOrders failed \(400\): WrongDateFormat/);
  });

  it('is catchable as HepsiburadaError', async () => {
    const { client } = testClient({ status: 500, body: '' });

    await expect(client.orders.list()).rejects.toBeInstanceOf(HepsiburadaError);
  });
});

describe('failure reported inside a 200', () => {
  // Three products answer 200 and put the verdict in the body, in three spellings. Only one of
  // them documents it, so the check runs on every decoded body rather than where a resource opts
  // in — an opt-in derived from the specs would have covered exactly one of these three.
  it('raises when mpop sends success: false', async () => {
    const { client } = testClient({ body: { success: false, code: 400, message: 'Kategori bulunamadı' } });

    await expect(client.products.categories()).rejects.toThrow(/Kategori bulunamadı/);
  });

  it('raises on a non-zero code even when success is absent', async () => {
    const { client } = testClient({ body: { code: 7, message: 'nope' } });

    await expect(client.products.categories()).rejects.toBeInstanceOf(HepsiburadaApiError);
  });

  it('raises when diskonto sends PascalCase Success: false', async () => {
    // The published promotion schema declares this envelope in camelCase and production sends it
    // in Pascal, so a check that only knew `success` would pass the failure straight through.
    const { client } = testClient({ body: { Success: false, Data: null, message: 'kampanya yok' } });

    // `page` and `pagesize` are required by the promotion spec. The values are immaterial here —
    // the stub answers regardless — and the spec documents no page base, so nothing is implied.
    await expect(client.promotions.list({ page: 1, pagesize: 50 })).rejects.toThrow(/kampanya yok/);
  });

  it('raises when shipping sends error: true, whose flag is inverted', async () => {
    const { client } = testClient({ body: { cargoFirms: [], error: true, msg: 'merchant not found' } });

    await expect(client.shipping.cargoFirms()).rejects.toThrow(/merchant not found/);
  });

  it('is silent on a healthy body from any product', async () => {
    const { client } = testClient({ body: { cargoFirms: [], error: false, msg: null } });

    await expect(client.shipping.cargoFirms()).resolves.toEqual({ cargoFirms: [], error: false, msg: null });
  });

  it('is silent when no verdict field is present', async () => {
    const { client } = testClient({ body: { data: [] } });

    await expect(client.products.categories()).resolves.toEqual({ data: [] });
  });

  it('does not read a non-numeric code as a failure', async () => {
    // `Number('TRY') !== 0` is true. A currency code at the top of an undocumented response must
    // not be mistaken for a status, which is the risk taken on by checking every body.
    const { client } = testClient({ body: { code: 'TRY', amount: 12 } });

    await expect(client.orders.list()).resolves.toEqual({ code: 'TRY', amount: 12 });
  });
});

describe('middleware', () => {
  it('runs outermost-first around every request', async () => {
    const order: string[] = [];
    const trace = (name: string): Middleware => ({
      name,
      async handle(request, next) {
        order.push(`>${name}`);
        const response = await next(request);
        order.push(`<${name}`);
        return response;
      },
    });

    const { client } = testClient({ body: [] }, { middleware: [trace('a'), trace('b')] });
    await client.orders.list();

    expect(order).toEqual(['>a', '>b', '<b', '<a']);
  });

  it('installs logging only when a logger is supplied', async () => {
    const logger = { debug: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const { client } = testClient({ body: [] }, { logger });

    await client.orders.list();

    expect(logger.debug).toHaveBeenCalled();
  });
});

describe('FetchHttpClient', () => {
  it('converts a timeout into a typed error', async () => {
    const never: typeof fetch = ((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      })) as unknown as typeof fetch;

    const http = new FetchHttpClient({ fetch: never as never, timeoutMs: 5 });

    await expect(
      http.send({
        method: 'GET',
        url: 'https://example.test/x',
        headers: {},
        context: { operationId: 'x', module: 'order', pathTemplate: '/x', attempt: 1, meta: {} },
      })
    ).rejects.toThrow(/timed out|timeout/i);
  });

  it('says so plainly when there is no fetch to use', () => {
    const original = globalThis.fetch;
    // @ts-expect-error — removing a global for the length of one assertion
    delete globalThis.fetch;
    try {
      expect(() => new FetchHttpClient()).toThrow(/No global fetch/);
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe('the escape hatch', () => {
  it('runs an undocumented operation through the same pipeline', async () => {
    const http = new StubHttpClient({ body: { ok: true } });
    const { client } = testClient({}, { httpClient: http });

    const result = await client.request({
      operationId: 'somethingNew',
      module: 'order',
      method: 'GET',
      path: '/new/thing',
    });

    expect(result).toEqual({ ok: true });
    expect(http.last.headers['authorization']).toBeDefined();
    expect(http.last.headers['user-agent']).toBe('testintegrator_dev');
  });
});

describe('the merchant id as a header', () => {
  // `api-asktoseller-merchant` is the one product that takes the merchant id as a header instead
  // of a path segment, and all six of its operations declare it required. Without it production
  // answers a bare 401 — which reads as a credential problem, sends you to check the User-Agent,
  // and is not a credential problem at all. Every operation on this resource must carry it.
  it('is sent on a list call', async () => {
    const { client, http } = testClient({ body: { data: [] } });

    await client.questions.list();

    expect(http.last.headers['merchantid']).toBe(MERCHANT_ID);
  });

  it('is sent on every other operation of the product', async () => {
    const { client, http } = testClient({ body: {} });

    await client.questions.count();
    expect(http.last.headers['merchantid']).toBe(MERCHANT_ID);

    await client.questions.get('12345');
    expect(http.last.headers['merchantid']).toBe(MERCHANT_ID);
  });

  it('does not put it in the path, which this product has no placeholder for', async () => {
    const { client, http } = testClient({ body: { data: [] } });

    await client.questions.list();

    expect(new URL(http.last.url).pathname).toBe('/api/v1.0/issues');
  });

  it('yields to a caller who overrides it, for a multi-merchant integrator', async () => {
    const { client, http } = testClient({ body: { data: [] } });

    await client.questions.list({}, { headers: { merchantId: 'someone-else' } });

    expect(http.last.headers['merchantid']).toBe('someone-else');
  });

  it('is not sent by the eleven products that take it in the path', async () => {
    const { client, http } = testClient({ body: { items: [] } });

    await client.orders.list();

    expect(http.last.headers['merchantid']).toBeUndefined();
    expect(new URL(http.last.url).pathname).toContain(MERCHANT_ID);
  });
});
