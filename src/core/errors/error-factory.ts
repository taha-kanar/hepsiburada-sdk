import type { HttpRequest, HttpResponse } from '../http/types.js';
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
  flattenMessages,
  type HepsiburadaErrorContext,
  type HepsiburadaErrorPayload,
} from './errors.js';

/** Status → class. Open for extension: add a row, not a branch. */
const BY_STATUS: Record<number, new (message: string, context: HepsiburadaErrorContext) => HepsiburadaApiError> = {
  400: HepsiburadaBadRequestError,
  401: HepsiburadaAuthenticationError,
  403: HepsiburadaAuthorizationError,
  404: HepsiburadaNotFoundError,
  409: HepsiburadaConflictError,
  422: HepsiburadaValidationError,
};

const MAX_BODY = 2000;

/**
 * Parse an error body without assuming it is JSON.
 *
 * This is the function that keeps `Missing Credentials!` — which is what `listing-external`
 * returns, as `text/plain`, for a 401 — from becoming a parse error that hides the real problem.
 * A body that is not JSON becomes `{ message: <the text> }` so `error.details` still says
 * something useful.
 */
export function parseErrorPayload(body: string): HepsiburadaErrorPayload | undefined {
  const trimmed = body.trim();
  if (!trimmed) return undefined;

  // A leading `"` counts: the Go services declare their 400/401/500 bodies as a bare string, so
  // `"WrongDateFormat"` arrives quoted and must be unquoted rather than reported with its quotes.
  if (/^[{["]/.test(trimmed)) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return { errors: parsed };
      if (parsed && typeof parsed === 'object') return parsed as HepsiburadaErrorPayload;
      // A bare JSON scalar, e.g. the Go services' `"some message"`.
      return { message: String(parsed) };
    } catch {
      // Fall through: it looked like JSON and was not.
    }
  }
  return { message: trimmed.slice(0, MAX_BODY) };
}

/** The best available human-readable summary of a failure. */
function describe(payload: HepsiburadaErrorPayload | undefined, response: HttpResponse): string {
  if (payload) {
    const nested = flattenMessages(payload.errors)[0];
    if (nested) return nested;
    if (payload.message) return payload.message;
    // ProblemDetails again: a 400 from `mpfinance-external` carries `title` and `detail`,
    // never `message`.
    if (typeof payload['detail'] === 'string' && payload['detail']) return payload['detail'];
    if (typeof payload['title'] === 'string' && payload['title']) return payload['title'];
    if (payload.code !== undefined) return `code ${payload.code}`;
  }
  return response.statusText || `HTTP ${response.status}`;
}

/** `Retry-After` in milliseconds, if the response carried one. Seconds and dates are both legal. */
function retryAfterMs(headers: Record<string, string>): number | undefined {
  const value = headers['retry-after'];
  if (!value) return undefined;

  const seconds = Number(value);
  if (Number.isFinite(seconds)) return seconds * 1000;

  const at = Date.parse(value);
  return Number.isNaN(at) ? undefined : Math.max(0, at - Date.now());
}

/** Build the error context shared by every failure of this request. */
export function errorContext(
  request: HttpRequest,
  response: HttpResponse,
  payload?: HepsiburadaErrorPayload | undefined
): HepsiburadaErrorContext {
  return {
    operationId: request.context.operationId,
    module: request.context.module,
    method: request.method,
    url: request.url,
    status: response.status,
    ...(response.headers['x-correlation-id'] ? { correlationId: response.headers['x-correlation-id'] } : {}),
    ...(payload ? { payload } : {}),
    ...(response.body ? { body: response.body.slice(0, MAX_BODY) } : {}),
  };
}

/** Turn a failing response into the most specific error class that fits its status. */
export function createApiError(request: HttpRequest, response: HttpResponse): HepsiburadaApiError {
  const payload = parseErrorPayload(response.body);
  const context = errorContext(request, response, payload);
  const message = `${request.context.operationId} failed (${response.status}): ${describe(payload, response)}`;

  if (response.status === 429) {
    return new HepsiburadaRateLimitError(message, context, retryAfterMs(response.headers));
  }

  const Specific = BY_STATUS[response.status];
  if (Specific) return new Specific(message, context);
  if (response.status >= 500) return new HepsiburadaServerError(message, context);
  return new HepsiburadaApiError(message, context);
}

/**
 * Raise if a service reported a failure inside an otherwise successful response.
 *
 * Three products answer HTTP 200 and put the verdict in the body, in three different spellings —
 * all three confirmed against production:
 *
 * - `mpop` (catalog): `{ success, code, message, data }`, where `code: 0` means success;
 * - `diskonto-external` (promotions): `{ Success, Data }`, PascalCase, and the published schema
 *   does not mention the envelope at all;
 * - `shipping-external`: `{ cargoFirms, error, msg }`, where the flag is inverted.
 *
 * This runs on **every** decoded body rather than where a resource opted in. That flag was the
 * bug: gating the check on what the document promised is how n11 turned a rate-limit refusal into
 * an empty page, and two of the three envelopes above are undocumented, so no flag derived from
 * the specs could have covered them.
 *
 * It stays conservative to earn that reach: only an explicit `false`, an explicit `error: true`,
 * or a numeric non-zero `code` counts. `code` is required to be numeric because a non-numeric one
 * is not a status — `Number('TRY') !== 0` is true, and a currency code at the top of some
 * undocumented response must not be read as a failure.
 */
export function assertEnvelopeSuccess(body: unknown, request: HttpRequest, response: HttpResponse): void {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return;

  const envelope = body as Record<string, unknown>;
  const flag = envelope['success'] ?? envelope['Success'];
  const code = envelope['code'] ?? envelope['Code'];
  const error = envelope['error'] ?? envelope['Error'];

  const numeric = Number(code);
  const failed = flag === false || error === true || (Number.isFinite(numeric) && numeric !== 0);
  if (!failed) return;

  // `msg` is shipping's spelling of `message`; normalise so `describe` and `details` find it.
  const payload = envelope as HepsiburadaErrorPayload;
  const message = payload.message ?? (envelope['msg'] as string | undefined) ?? (envelope['Message'] as string | undefined);
  const normalised: HepsiburadaErrorPayload = { ...payload, ...(message ? { message } : {}) };

  throw new HepsiburadaApiError(
    `${request.context.operationId} failed: ${describe(normalised, response)}`,
    errorContext(request, response, normalised)
  );
}
