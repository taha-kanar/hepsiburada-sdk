import { describe, expect, it } from 'vitest';
import {
  HepsiburadaApiError,
  HepsiburadaAuthenticationError,
  HepsiburadaAuthorizationError,
  HepsiburadaBadRequestError,
  HepsiburadaConflictError,
  HepsiburadaNotFoundError,
  HepsiburadaRateLimitError,
  HepsiburadaServerError,
  HepsiburadaValidationError,
  createApiError,
  parseErrorPayload,
  type HttpRequest,
  type HttpResponse,
} from '../src/index.js';

const request: HttpRequest = {
  method: 'GET',
  url: 'https://oms-external.hepsiburada.com/orders/merchantid/x',
  headers: {},
  context: { operationId: 'getOrders', module: 'order', pathTemplate: '/orders/merchantid/{merchantId}', attempt: 1, meta: {} },
};

const response = (patch: Partial<HttpResponse>): HttpResponse => ({
  status: 400,
  statusText: 'Bad Request',
  headers: { 'content-type': 'application/json' },
  body: '',
  ...patch,
});

describe('parseErrorPayload', () => {
  // The one that matters most: listing-external answers 401 with text/plain, and treating that as
  // JSON would replace the real problem with a parse error.
  it('turns a plain-text body into a message', () => {
    expect(parseErrorPayload('Missing Credentials!')).toEqual({ message: 'Missing Credentials!' });
  });

  it('returns undefined for an empty body', () => {
    // oms-external answers 401 with nothing at all and a JSON content type.
    expect(parseErrorPayload('')).toBeUndefined();
    expect(parseErrorPayload('   ')).toBeUndefined();
  });

  it('reads a JSON object', () => {
    expect(parseErrorPayload('{"message":"nope","code":3}')).toEqual({ message: 'nope', code: 3 });
  });

  it('reads a bare JSON array as errors', () => {
    // The listing service's per-element errors arrive as a top-level array.
    expect(parseErrorPayload('[{"elementNo":2,"message":"bad sku"}]')).toEqual({
      errors: [{ elementNo: 2, message: 'bad sku' }],
    });
  });

  it('reads a bare JSON string', () => {
    // The Go services declare their 400/401/500 bodies as a bare string.
    expect(parseErrorPayload('"WrongDateFormat"')).toEqual({ message: 'WrongDateFormat' });
  });

  it('falls back to text when a body only looks like JSON', () => {
    expect(parseErrorPayload('{not json')).toEqual({ message: '{not json' });
  });
});

describe('createApiError', () => {
  it.each([
    [400, HepsiburadaBadRequestError],
    [401, HepsiburadaAuthenticationError],
    [403, HepsiburadaAuthorizationError],
    [404, HepsiburadaNotFoundError],
    [409, HepsiburadaConflictError],
    [422, HepsiburadaValidationError],
    [429, HepsiburadaRateLimitError],
    [500, HepsiburadaServerError],
    [503, HepsiburadaServerError],
  ])('maps %i to its class', (status, Class) => {
    expect(createApiError(request, response({ status }))).toBeInstanceOf(Class);
  });

  it('falls back to the base class for an unmapped 4xx', () => {
    const error = createApiError(request, response({ status: 418 }));

    expect(error).toBeInstanceOf(HepsiburadaApiError);
    expect(error).not.toBeInstanceOf(HepsiburadaBadRequestError);
    expect(error.status).toBe(418);
  });

  // Hepsiburada support asks for the correlation id and keeps it for seven days; losing it means
  // losing the ability to ask what happened.
  it('lifts the correlation id out of the headers', () => {
    const error = createApiError(
      request,
      response({ headers: { 'x-correlation-id': 'abc-123', 'content-type': 'application/json' } })
    );

    expect(error.context.correlationId).toBe('abc-123');
  });

  it('reads Retry-After in seconds', () => {
    const error = createApiError(request, response({ status: 429, headers: { 'retry-after': '30' } }));

    expect((error as HepsiburadaRateLimitError).retryAfterMs).toBe(30_000);
  });

  it('leaves retryAfterMs undefined when no header is sent', () => {
    // Hepsiburada publishes no Retry-After and no X-RateLimit-*, so this is the normal case.
    const error = createApiError(request, response({ status: 429 }));

    expect((error as HepsiburadaRateLimitError).retryAfterMs).toBeUndefined();
  });

  it('truncates the retained body', () => {
    const error = createApiError(request, response({ body: 'x'.repeat(5000) }));

    expect(error.context.body).toHaveLength(2000);
  });
});

describe('error.details', () => {
  it('flattens listing-style per-element errors', () => {
    const error = createApiError(
      request,
      response({ body: JSON.stringify({ errors: [{ elementNo: 1, errors: ['stok negatif', 'fiyat yok'] }] }) })
    );

    expect(error.details).toEqual(['stok negatif', 'fiyat yok']);
  });

  it('falls back to the envelope message', () => {
    const error = createApiError(request, response({ body: JSON.stringify({ success: false, message: 'reddedildi' }) }));

    expect(error.details).toEqual(['reddedildi']);
  });

  it('is empty when there is nothing to say', () => {
    expect(createApiError(request, response({ body: '' })).details).toEqual([]);
  });
});
