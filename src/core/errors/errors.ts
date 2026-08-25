/** Everything known about the request that failed. */
export interface HepsiburadaErrorContext {
  /** The SDK's name for the operation, e.g. `getOrders`. */
  readonly operationId: string;
  /** The product the operation belongs to, e.g. `order`. */
  readonly module: string;
  readonly method: string;
  readonly url: string;
  readonly status?: number | undefined;
  /**
   * `x-correlation-id` from the response.
   *
   * Hepsiburada support asks for this when you open a ticket, and retains it for seven days.
   * Losing it means losing the ability to ask what happened, so it is lifted out of the headers
   * and onto the error rather than left in `raw`.
   */
  readonly correlationId?: string | undefined;
  readonly payload?: HepsiburadaErrorPayload | undefined;
  /** Raw response body, truncated to 2000 characters. */
  readonly body?: string | undefined;
}

/**
 * The union of error bodies Hepsiburada actually returns.
 *
 * There are three shapes and they do not agree, because three teams wrote them:
 *
 * - the catalog services wrap everything in `{ success, code, message, data }`, where `code: 0`
 *   means success and anything else is a failure — an envelope that can, structurally, carry a
 *   failure inside an HTTP 200;
 * - the listing service returns per-element `errors[]`;
 * - the Go services (orders, shipping, claims) declare their 400/401/500 bodies as a bare string,
 *   and in practice `listing-external` answers 401 with `text/plain: Missing Credentials!` while
 *   `oms-external` answers 401 with an empty body and a JSON content type.
 *
 * So every field here is optional and nothing may be assumed present.
 */
export interface HepsiburadaErrorPayload {
  /** The catalog envelope. `false` means failure even when the status said 200. */
  success?: boolean;
  /** The catalog envelope's error code. `0` is success; anything else is not. */
  code?: number | string;
  message?: string;
  /**
   * Whatever the service put under `errors`.
   *
   * Deliberately not narrowed to an array. The listing service sends
   * `[{ message, code, elementNo, errors }]`, but `mpfinance-external` returns ASP.NET Core's
   * ProblemDetails, where `errors` is a dictionary of field name to messages. Declaring the array
   * and iterating it is what threw a TypeError out of the error path against production.
   * Read it with {@link flattenMessages}, never by indexing.
   */
  errors?: unknown;
  [key: string]: unknown;
}

/**
 * Every human-readable message inside an `errors` field, whatever shape it arrived in.
 *
 * Three teams wrote these services and they do not agree on what `errors` is:
 *
 * - `listing-external` sends an array of `{ message, code, elementNo, errors[] }`;
 * - `mpfinance-external` sends ASP.NET Core ProblemDetails, where it is a *dictionary* of field
 *   name to messages — iterating that as an array throws `errors is not iterable`;
 * - some responses put a bare string there.
 *
 * So this accepts `unknown` and reads whichever it finds. A dictionary keeps its field names,
 * because "begindate: The value is not valid" is a usable message and "The value is not valid"
 * is not.
 */
export function flattenMessages(errors: unknown): string[] {
  const out: string[] = [];

  if (typeof errors === 'string') {
    if (errors) out.push(errors);
    return out;
  }

  if (Array.isArray(errors)) {
    for (const entry of errors) {
      if (typeof entry === 'string') {
        if (entry) out.push(entry);
        continue;
      }
      if (!entry || typeof entry !== 'object') continue;
      const row = entry as { message?: unknown; errors?: unknown };
      if (typeof row.message === 'string' && row.message) out.push(row.message);
      for (const nested of flattenMessages(row.errors)) out.push(nested);
    }
    return out;
  }

  if (errors && typeof errors === 'object') {
    for (const [field, messages] of Object.entries(errors as Record<string, unknown>)) {
      // ASP.NET keys a model-level error with the empty string; prefixing that yields ": msg".
      for (const message of flattenMessages(messages)) {
        out.push(field.trim() ? `${field}: ${message}` : message);
      }
    }
  }

  return out;
}

/** Base class for everything this SDK throws. `instanceof HepsiburadaError` catches all of it. */
export class HepsiburadaError extends Error {
  override readonly name: string = 'HepsiburadaError';

  constructor(
    message: string,
    readonly context: HepsiburadaErrorContext,
    options?: { cause?: unknown }
  ) {
    super(message, options as ErrorOptions);
    // Restores the prototype chain, which extending a built-in otherwise breaks when the
    // package is consumed as ES5.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** The request never reached Hepsiburada: DNS, TLS, connection reset. */
export class HepsiburadaConnectionError extends HepsiburadaError {
  override readonly name = 'HepsiburadaConnectionError';
}

/** The request was abandoned — by the configured timeout, or by the caller's signal. */
export class HepsiburadaTimeoutError extends HepsiburadaError {
  override readonly name = 'HepsiburadaTimeoutError';
}

/** A response arrived but could not be decoded as the operation's declared media type. */
export class HepsiburadaParseError extends HepsiburadaError {
  override readonly name = 'HepsiburadaParseError';
}

/** Hepsiburada answered, and the answer was a failure. */
export class HepsiburadaApiError extends HepsiburadaError {
  override readonly name: string = 'HepsiburadaApiError';

  get status(): number {
    return this.context.status ?? 0;
  }

  /**
   * Every human-readable message in the payload, flattened.
   *
   * Walks all three body shapes so callers do not have to know which service they hit.
   */
  get details(): string[] {
    const payload = this.context.payload;
    if (!payload) return [];

    const out = flattenMessages(payload.errors);
    if (!out.length && payload.message) out.push(payload.message);
    // ProblemDetails carries `detail`/`title` and never `message`.
    if (!out.length && typeof payload['detail'] === 'string') out.push(payload['detail']);
    if (!out.length && typeof payload['title'] === 'string') out.push(payload['title']);
    return out;
  }
}

/** 400 — malformed request. Frequently a date format the endpoint does not accept. */
export class HepsiburadaBadRequestError extends HepsiburadaApiError {
  override readonly name = 'HepsiburadaBadRequestError';
}

/**
 * 401 — rejected credentials.
 *
 * Overwhelmingly the first error a new integration sees, and almost always one of two causes:
 * the Basic-auth username slot wants the GUID merchant id rather than a separate username, or
 * the `User-Agent` is not an exact match for the registered integrator name. See the README.
 */
export class HepsiburadaAuthenticationError extends HepsiburadaApiError {
  override readonly name = 'HepsiburadaAuthenticationError';
}

/** 403 — authenticated, but not entitled to this operation or this merchant. */
export class HepsiburadaAuthorizationError extends HepsiburadaApiError {
  override readonly name = 'HepsiburadaAuthorizationError';
}

/** 404 — no such resource. */
export class HepsiburadaNotFoundError extends HepsiburadaApiError {
  override readonly name = 'HepsiburadaNotFoundError';
}

/** 409 — conflicts with current state, e.g. a package that already carries an invoice. */
export class HepsiburadaConflictError extends HepsiburadaApiError {
  override readonly name = 'HepsiburadaConflictError';
}

/** 422 — well-formed but semantically rejected. */
export class HepsiburadaValidationError extends HepsiburadaApiError {
  override readonly name = 'HepsiburadaValidationError';
}

/**
 * 429 — too many requests.
 *
 * Hepsiburada documents three separate limits (180 req/min per IP, 240/min on commissions, and a
 * cap of five concurrent listing uploads) but publishes no `Retry-After` or `X-RateLimit-*`
 * header, so `retryAfterMs` is populated only when a header happens to be present.
 */
export class HepsiburadaRateLimitError extends HepsiburadaApiError {
  override readonly name = 'HepsiburadaRateLimitError';

  constructor(
    message: string,
    context: HepsiburadaErrorContext,
    readonly retryAfterMs?: number | undefined,
    options?: { cause?: unknown }
  ) {
    super(message, context, options);
  }
}

/** 5xx — Hepsiburada's problem, and usually worth retrying. */
export class HepsiburadaServerError extends HepsiburadaApiError {
  override readonly name = 'HepsiburadaServerError';
}
