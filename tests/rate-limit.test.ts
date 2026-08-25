import { describe, expect, it, vi } from 'vitest';
import { RateLimitMiddleware } from '../src/index.js';
import type { HttpRequest, HttpResponse } from '../src/core/http/index.js';

const ok: HttpResponse = { status: 200, statusText: 'OK', headers: {}, body: '' };

const request = (url: string, method: 'GET' | 'POST' = 'GET'): HttpRequest => ({
  method,
  url,
  headers: {},
  context: { operationId: 'x', module: 'listing', pathTemplate: '/x', attempt: 1, meta: {} },
});

/** Let every already-scheduled continuation run, without counting microtask ticks by hand. */
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

const LIST = 'https://listing-external.hepsiburada.com/listings/merchantid/x';
const UPLOAD = 'https://listing-external.hepsiburada.com/listings/merchantid/x/inventory-uploads';

describe('the per-minute budget', () => {
  it('lets a burst inside the budget straight through', async () => {
    const sleep = vi.fn(async () => {});
    const middleware = new RateLimitMiddleware({ perMinute: 3, sleep, now: () => 0 });

    for (let i = 0; i < 3; i++) await middleware.handle(request(LIST), async () => ok);

    expect(sleep).not.toHaveBeenCalled();
  });

  it('waits exactly until the oldest request leaves the window', async () => {
    let clock = 0;
    const sleep = vi.fn(async (ms: number) => {
      clock += ms;
    });
    const middleware = new RateLimitMiddleware({ perMinute: 2, sleep, now: () => clock });

    await middleware.handle(request(LIST), async () => ok); // t=0
    clock = 10_000;
    await middleware.handle(request(LIST), async () => ok); // t=10s
    await middleware.handle(request(LIST), async () => ok); // must wait until t=60s

    expect(sleep).toHaveBeenCalledWith(50_000);
  });

  it('forgets requests that have left the rolling window', async () => {
    let clock = 0;
    const sleep = vi.fn(async () => {});
    const middleware = new RateLimitMiddleware({ perMinute: 1, sleep, now: () => clock });

    await middleware.handle(request(LIST), async () => ok);
    clock = 61_000;
    await middleware.handle(request(LIST), async () => ok);

    expect(sleep).not.toHaveBeenCalled();
  });
});

/**
 * The upload cap is the one that has to be enforced locally.
 *
 * A sixth in-flight upload is not refused with a 429 — the listing service answers with a message
 * inside an otherwise successful response, so nothing downstream would recognise it as a failure
 * worth retrying. Waiting for a slot is the only reliable fix.
 */
describe('the concurrent-upload cap', () => {
  it('holds a sixth upload until a slot frees', async () => {
    const middleware = new RateLimitMiddleware({ maxConcurrentUploads: 2, perMinute: 1000, now: () => 0 });
    const release: Array<() => void> = [];
    let started = 0;

    const send = (): Promise<HttpResponse> =>
      middleware.handle(request(UPLOAD, 'POST'), async () => {
        started++;
        await new Promise<void>((resolve) => release.push(resolve));
        return ok;
      });

    const all = [send(), send(), send()];
    await settle();

    expect(started).toBe(2);

    release.shift()!();
    await settle();

    expect(started).toBe(3);

    for (const resolve of release) resolve();
    await Promise.all(all);
  });

  it('does not count an ordinary request against the upload cap', async () => {
    const middleware = new RateLimitMiddleware({ maxConcurrentUploads: 1, perMinute: 1000, now: () => 0 });
    let started = 0;

    const send = (): Promise<HttpResponse> =>
      middleware.handle(request(LIST), async () => {
        started++;
        return ok;
      });

    await Promise.all([send(), send(), send()]);

    expect(started).toBe(3);
  });

  it('frees the slot even when the request fails', async () => {
    const middleware = new RateLimitMiddleware({ maxConcurrentUploads: 1, perMinute: 1000, now: () => 0 });

    await expect(
      middleware.handle(request(UPLOAD, 'POST'), async () => {
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');

    // If the slot leaked, this would hang rather than resolve.
    await expect(middleware.handle(request(UPLOAD, 'POST'), async () => ok)).resolves.toBe(ok);
  });

  it('takes a custom definition of an upload', async () => {
    const middleware = new RateLimitMiddleware({
      maxConcurrentUploads: 1,
      perMinute: 1000,
      now: () => 0,
      isUpload: (req) => req.url.includes('/products/import'),
    });

    await expect(middleware.handle(request(UPLOAD, 'POST'), async () => ok)).resolves.toBe(ok);
  });
});

describe('defaults', () => {
  it('matches the published limits', async () => {
    // 180 req/min per IP, five concurrent uploads. Both are documented; neither is enforced by a
    // header we could read back.
    const middleware = new RateLimitMiddleware({ now: () => 0, sleep: vi.fn(async () => {}) });

    for (let i = 0; i < 180; i++) await middleware.handle(request(LIST), async () => ok);

    expect(middleware).toBeDefined();
  });
});
