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

describe('the catalog envelope', () => {
  // mpop wraps everything in { success, code, data } and the schema permits a failure inside a
  // 200. n11 shipped without this check and lost a day to rate-limit refusals decoding as empty
  // pages, so it runs on the decoded body rather than on what the document promised.
  it('raises when a 200 carries success: false', async () => {
    const { client } = testClient({ body: { success: false, code: 400, message: 'Kategori bulunamadı' } });

    await expect(client.products.categories()).rejects.toThrow(/Kategori bulunamadı/);
  });

  it('raises on a non-zero code even when success is absent', async () => {
    const { client } = testClient({ body: { code: 7, message: 'nope' } });

    await expect(client.products.categories()).rejects.toBeInstanceOf(HepsiburadaApiError);
  });

  it('is silent when neither field is present', async () => {
    const { client } = testClient({ body: { data: [] } });

    await expect(client.products.categories()).resolves.toEqual({ data: [] });
  });

  it('is not applied to products that do not use the envelope', async () => {
    // `code` means something else entirely on other hosts; only the catalog services get checked.
    const { client } = testClient({ body: { code: 7 } });

    await expect(client.orders.list()).resolves.toEqual({ code: 7 });
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
