/**
 * `hepsiburada-sdk` — a typed client for the Hepsiburada Marketplace API.
 *
 * ```ts
 * import { HepsiburadaClient } from 'hepsiburada-sdk';
 *
 * const client = new HepsiburadaClient({
 *   merchantId: process.env.HB_MERCHANT_ID!,
 *   password: process.env.HB_SERVICE_KEY!,
 *   userAgent: process.env.HB_INTEGRATOR_NAME!, // exactly as registered — an inexact value 401s
 * });
 *
 * const orders = await client.orders.list({ begindate: new Date(Date.now() - 3_600_000) });
 * ```
 *
 * Pass a `Date` to any filter: `begindate` is read as Turkey local time (UTC+3, no DST), and an
 * ISO-8601 string is accepted and then matches nothing.
 *
 * Twelve products, nine hosts, three authoring teams. What that costs the caller is documented
 * where it bites: {@link PAGINATION} for the six query dialects, {@link REJECTS_DATE_FILTER} for
 * the endpoints that 400 on a date filter, and the `types` namespaces below, which stay separate
 * because twelve independent APIs each define their own `Money` and mean different things by it.
 *
 * Drift detection lives at `hepsiburada-sdk/drift`, which reads from disk and is therefore kept
 * out of this bundle.
 */

export { HepsiburadaClient, type HepsiburadaClientOptions } from './client.js';
export type { ClientOptions, Environment, ResolvedConfig } from './config.js';

// Resources — reachable from the client, exported for typing a function that takes one.
export {
  ClaimsResource,
  FinanceResource,
  ListingsResource,
  OrdersResource,
  ProductUpdatesResource,
  ProductsResource,
  PromotionsResource,
  QuestionsResource,
  ShippingResource,
  SuppliersResource,
  TestOrdersResource,
  type CapitalisedPageWindow,
  type ClaimStatus,
  type DateWindow,
  type PageWindow,
} from './resources/index.js';
export { BaseResource, type RequestOptions } from './core/resource/index.js';

// Errors. Catch `HepsiburadaError` for everything, or a subclass for one condition.
export {
  HepsiburadaApiError,
  HepsiburadaAuthenticationError,
  HepsiburadaAuthorizationError,
  HepsiburadaBadRequestError,
  HepsiburadaConflictError,
  HepsiburadaConnectionError,
  HepsiburadaError,
  HepsiburadaNotFoundError,
  HepsiburadaParseError,
  HepsiburadaRateLimitError,
  HepsiburadaServerError,
  HepsiburadaTimeoutError,
  HepsiburadaValidationError,
  assertEnvelopeSuccess,
  createApiError,
  errorContext,
  parseErrorPayload,
  type HepsiburadaErrorContext,
  type HepsiburadaErrorPayload,
} from './core/errors/index.js';

// Pagination. `paginate` walks any of the six dialects given the operation's descriptor.
export {
  paginate,
  pageQuery,
  readPage,
  type OffsetRequest,
  type Page,
  type PageRequest,
  type PaginateOptions,
  type PaginationDescriptor,
  type PaginationEnvelope,
} from './core/pagination.js';

// Batch submission. Partial failure inside a 200 is a value here, never an exception.
export {
  isSettled,
  pollBatch,
  readBatchResult,
  type BatchResult,
  type BatchRowError,
  type BatchStatus,
  type PollOptions,
} from './core/batch.js';

// Dates. `formatDateFilter` is the difference between a full page and a silently empty one.
export { formatDateFilter, parseTimestamp } from './core/date.js';

// The HTTP seam: swap the client, wrap it in middleware, or replace `fetch` alone.
export {
  FetchHttpClient,
  toFormData,
  withHeaders,
  withRequest,
  type FetchHttpClientOptions,
  type FetchLike,
  type FileInput,
  type FormFields,
  type HttpClient,
  type HttpHeaders,
  type HttpMethod,
  type HttpRequest,
  type HttpResponse,
  type RequestContext,
} from './core/http/index.js';
export {
  LoggingMiddleware,
  RateLimitMiddleware,
  composeMiddleware,
  type Middleware,
  type Next,
  type RateLimitMiddlewareOptions,
} from './core/middleware/index.js';
export { consoleLogger, silentLogger, type Logger } from './core/logger.js';
export {
  BasicAuthenticator,
  encodeBase64,
  type Authenticator,
  type BasicAuthenticatorOptions,
} from './core/auth/index.js';
export { Transport, type BaseUrlResolver, type OperationRequest, type TransportOptions } from './core/transport.js';
export {
  expandPath,
  joinUrl,
  serializeQuery,
  type ArrayFormat,
  type PathParams,
  type QueryParams,
  type QueryValue,
} from './core/url/index.js';

// Generated data: pagination descriptors, the date-filter blocklist, and the host table.
export { HOSTS, PAGINATION, REJECTS_DATE_FILTER, type ProductHosts } from './generated/index.js';

/**
 * Request and response types live at `hepsiburada-sdk/types`, one namespace per product:
 *
 * ```ts
 * import type { order, listing } from 'hepsiburada-sdk/types';
 * const line: order.LineRepresentation = …;
 * ```
 *
 * You rarely need them — every resource method is already typed, and the shapes are inlined into
 * this entry point's declarations. Import them when you want to name one.
 *
 * They are namespaced rather than flattened because these are twelve independently-authored APIs:
 * several define a `Money`, several define a `Claim`, and no two agree. `order.Money` and
 * `finance.Money` are different shapes, and collapsing them would have to pick a winner. They sit
 * behind their own entry point rather than at this one's root so that `order` and `listing` are
 * not names every consumer of this package has to avoid.
 */

/**
 * Inbound webhook payload types.
 *
 * Types only — Hepsiburada calls you, and there is no registration API to wrap. See
 * `src/webhooks/types.ts` for how registration actually works.
 */
export * as webhooks from './webhooks/index.js';
