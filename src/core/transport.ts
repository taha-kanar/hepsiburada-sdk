import type { Authenticator } from './auth/index.js';
import { assertEnvelopeSuccess, createApiError, HepsiburadaError, HepsiburadaParseError } from './errors/index.js';
import type { HttpClient, HttpHeaders, HttpMethod, HttpRequest, HttpResponse } from './http/index.js';
import { composeMiddleware, type Middleware } from './middleware/index.js';
import {
  expandPath,
  joinUrl,
  serializeQuery,
  type ArrayFormat,
  type PathParams,
  type QueryParams,
} from './url/index.js';

/** One API call, described the way the published document describes it. */
export interface OperationRequest {
  /** The SDK's name for the operation, e.g. `getOrders`. Shows up in logs and errors. */
  operationId: string;
  /** Which product this belongs to, e.g. `order`. Selects the base URL. */
  module: string;
  method: HttpMethod;
  /** Path template with `{placeholders}`, copied from the spec, casing included. */
  path: string;
  pathParams?: PathParams;
  query?: QueryParams;
  /** Serialised as JSON unless it is already a `FormData`. */
  body?: unknown;
  headers?: HttpHeaders;
  signal?: AbortSignal;
  /** Values forwarded to middleware through `request.context.meta`. */
  meta?: Record<string, unknown>;
}

/** Resolves a module name to the host it lives on. */
export type BaseUrlResolver = (module: string) => string;

export interface TransportOptions {
  baseUrl: BaseUrlResolver;
  httpClient: HttpClient;
  authenticator: Authenticator;
  middleware?: readonly Middleware[];
  defaultHeaders?: HttpHeaders;
  arrayFormat?: ArrayFormat;
}

/**
 * Turns an {@link OperationRequest} into an HTTP call and back into a typed value.
 *
 * The only place that knows how a Hepsiburada call is assembled: base-URL selection, auth, the
 * middleware chain, status-to-error mapping and decoding. Resources describe *what* to call; the
 * transport decides *how*.
 *
 * The base URL is a function of the module rather than a single string, because there is no one
 * Hepsiburada host: the twelve products are spread across nine of them, and two exist only in the
 * sandbox.
 */
export class Transport {
  private readonly baseUrl: BaseUrlResolver;
  private readonly httpClient: HttpClient;
  private readonly authenticator: Authenticator;
  private readonly middleware: readonly Middleware[];
  private readonly defaultHeaders: HttpHeaders;
  private readonly arrayFormat: ArrayFormat;

  constructor(options: TransportOptions) {
    this.baseUrl = options.baseUrl;
    this.httpClient = options.httpClient;
    this.authenticator = options.authenticator;
    this.middleware = options.middleware ?? [];
    this.defaultHeaders = options.defaultHeaders ?? {};
    this.arrayFormat = options.arrayFormat ?? 'comma';
  }

  /** Execute an operation and decode its body as `TResponse`. */
  async request<TResponse>(operation: OperationRequest): Promise<TResponse> {
    const { response, request } = await this.exchange(operation);
    const decoded = this.decode<TResponse>(operation, response);

    // Runs on every decoded body, not on what the schema promised, and not where a resource opted
    // in. n11 taught this the expensive way: gating an in-band check on the document declaring the
    // field meant a rate-limit refusal arrived as a 200 and decoded as an empty page. Production
    // then proved the point again here — two of the three products that answer 200 with a failure
    // flag do not document the envelope at all, so no opt-in could have covered them.
    assertEnvelopeSuccess(decoded, request, response);

    return decoded;
  }

  /**
   * Execute an operation and return the raw response.
   *
   * Non-2xx statuses still throw; use this when an endpoint returns something other than JSON, or
   * when response headers matter.
   */
  async send(operation: OperationRequest): Promise<HttpResponse> {
    return (await this.exchange(operation)).response;
  }

  private async exchange(operation: OperationRequest): Promise<{ request: HttpRequest; response: HttpResponse }> {
    const request = this.buildRequest(operation);
    const authenticated = await this.authenticator.authenticate(request);

    const run = composeMiddleware(this.middleware, (req) => this.httpClient.send(req));
    const response = await run(authenticated);

    if (response.status < 200 || response.status >= 300) {
      throw createApiError(authenticated, response);
    }
    return { request: authenticated, response };
  }

  private buildRequest(operation: OperationRequest): HttpRequest {
    const base = this.baseUrl(operation.module);
    if (!base) {
      throw new HepsiburadaError(
        `No base URL is configured for the "${operation.module}" product, which ${operation.operationId} belongs to.`,
        { operationId: operation.operationId, module: operation.module, method: operation.method, url: operation.path }
      );
    }

    const path = expandPath(operation.path, operation.pathParams, operation.operationId, operation.module);
    const queryString = serializeQuery(operation.query, this.arrayFormat);
    const url = joinUrl(base, path) + (queryString ? `?${queryString}` : '');

    const isFormData = typeof FormData !== 'undefined' && operation.body instanceof FormData;
    const hasBody = operation.body !== undefined && operation.body !== null;

    const headers: HttpHeaders = {
      accept: 'application/json',
      ...lowerCaseKeys(this.defaultHeaders),
      ...lowerCaseKeys(operation.headers ?? {}),
    };
    // `fetch` must set the multipart boundary itself, so never force a type there.
    if (hasBody && !isFormData && !headers['content-type']) {
      headers['content-type'] = 'application/json';
    }

    return {
      method: operation.method,
      url,
      headers,
      body: hasBody ? (isFormData ? (operation.body as FormData) : JSON.stringify(operation.body)) : undefined,
      signal: operation.signal,
      context: {
        operationId: operation.operationId,
        module: operation.module,
        pathTemplate: operation.path,
        attempt: 1,
        meta: operation.meta ?? {},
      },
    };
  }

  private decode<TResponse>(operation: OperationRequest, response: HttpResponse): TResponse {
    const body = response.body?.trim() ?? '';
    // 204, or an endpoint that answers with an empty 200 — both mean "no value". The OMS status
    // transitions are the common case: they answer 204 with nothing at all.
    if (!body || response.status === 204) return undefined as TResponse;

    const contentType = response.headers['content-type'] ?? '';
    // The listing service advertises XML on several endpoints and will honour an `Accept` that
    // asks for it. Hand anything non-JSON back as text rather than failing to parse it.
    if (contentType && !contentType.includes('json')) return body as unknown as TResponse;

    try {
      return JSON.parse(body) as TResponse;
    } catch (cause) {
      throw new HepsiburadaParseError(
        `${operation.operationId} returned a ${response.status} that is not valid JSON`,
        {
          operationId: operation.operationId,
          module: operation.module,
          method: operation.method,
          url: `${this.baseUrl(operation.module)}${operation.path}`,
          status: response.status,
          body: body.slice(0, 2000),
        },
        { cause }
      );
    }
  }
}

function lowerCaseKeys(headers: HttpHeaders): HttpHeaders {
  return Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
}
