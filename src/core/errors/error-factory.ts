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
      if (Array.isArray(parsed)) return { errors: parsed as NonNullable<HepsiburadaErrorPayload['errors']> };
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
    const first = payload.errors?.find((entry) => entry.message ?? entry.errors?.length);
    const nested = first?.message ?? first?.errors?.[0];
    if (nested) return nested;
    if (payload.message) return payload.message;
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
 * Raise if the catalog services reported a failure inside an otherwise successful response.
 *
 * `mpop` wraps its answers in `{ success, code, message, data }`, where `code: 0` means success.
 * The schema permits `success: false` on an HTTP 200 and no published example proves whether it
 * happens, so this check is deliberately defensive: it fires only on an explicit `success: false`
 * or an explicit non-zero `code`, and is silent when neither field is present.
 *
 * n11 taught this lesson the expensive way — a rate-limit refusal arrived as HTTP 200 and decoded
 * as an empty page, because the check was gated on what the schema promised rather than run on
 * what actually came back. So this runs on every catalog response.
 */
export function assertEnvelopeSuccess(body: unknown, request: HttpRequest, response: HttpResponse): void {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return;

  const envelope = body as HepsiburadaErrorPayload;
  const failed = envelope.success === false || (envelope.code !== undefined && Number(envelope.code) !== 0);
  if (!failed) return;

  const context = errorContext(request, response, envelope);
  throw new HepsiburadaApiError(
    `${request.context.operationId} failed: ${describe(envelope, response)}`,
    context
  );
}
