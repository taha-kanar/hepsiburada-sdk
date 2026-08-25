import { resolveConfig, type ClientOptions, type ResolvedConfig } from './config.js';
import { BasicAuthenticator } from './core/auth/basic-authenticator.js';
import { FetchHttpClient, type FetchLike, type HttpClient } from './core/http/index.js';
import { LoggingMiddleware, type Middleware } from './core/middleware/index.js';
import { silentLogger, type Logger } from './core/logger.js';
import { Transport, type OperationRequest } from './core/transport.js';
import { HepsiburadaError } from './core/errors/errors.js';
import { HOSTS } from './generated/hosts.js';
import {
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
} from './resources/index.js';

export interface HepsiburadaClientOptions extends ClientOptions {
  /** Replace the HTTP layer entirely — a test double, a proxy, an instrumented client. */
  httpClient?: HttpClient;
  /** Replace just the fetch implementation, keeping the default client. */
  fetch?: FetchLike;
  /** Runs outermost-first, around every request. */
  middleware?: readonly Middleware[];
  /** Headers added to every request, below anything a call sets itself. */
  defaultHeaders?: Record<string, string>;
}

/**
 * The Hepsiburada Marketplace client.
 *
 * ```ts
 * const client = new HepsiburadaClient({
 *   merchantId: '00000000-0000-4000-8000-000000000001',  // yours, from the merchant panel
 *   password: '<service key>',
 *   userAgent: 'yourintegrator_dev',   // exactly as registered — see the README
 * });
 *
 * const orders = await client.orders.list({ begindate: new Date(Date.now() - 3_600_000) });
 * ```
 *
 * Resources are created on first use and cached, so `client.orders` is always the same instance.
 */
export class HepsiburadaClient {
  readonly config: ResolvedConfig;

  private readonly transport: Transport;
  private readonly cache = new Map<string, unknown>();

  constructor(options: HepsiburadaClientOptions) {
    const logger: Logger = options.logger ?? silentLogger;
    this.config = resolveConfig(options, logger);

    const httpClient =
      options.httpClient ??
      new FetchHttpClient({
        ...(options.fetch ? { fetch: options.fetch } : {}),
        ...(this.config.timeoutMs !== undefined ? { timeoutMs: this.config.timeoutMs } : {}),
      });

    const middleware = options.middleware ?? (options.logger ? [new LoggingMiddleware(logger)] : []);

    this.transport = new Transport({
      baseUrl: (module) => this.baseUrlFor(module),
      httpClient,
      authenticator: new BasicAuthenticator({
        merchantId: this.config.merchantId,
        password: this.config.password,
        userAgent: this.config.userAgent,
        ...(this.config.username ? { username: this.config.username } : {}),
      }),
      middleware,
      ...(options.defaultHeaders ? { defaultHeaders: options.defaultHeaders } : {}),
    });
  }

  /** Orders, packages and their status transitions. */
  get orders(): OrdersResource {
    return this.resource('orders', OrdersResource);
  }

  /** Stock, price and listing state. */
  get listings(): ListingsResource {
    return this.resource('listings', ListingsResource);
  }

  /** Product creation and the category tree. */
  get products(): ProductsResource {
    return this.resource('products', ProductsResource);
  }

  /** Updating products already in the catalog. */
  get productUpdates(): ProductUpdatesResource {
    return this.resource('productUpdates', ProductUpdatesResource);
  }

  /** Carriers and shipping profiles. */
  get shipping(): ShippingResource {
    return this.resource('shipping', ShippingResource);
  }

  /** Settlement and transactions. */
  get finance(): FinanceResource {
    return this.resource('finance', FinanceResource);
  }

  /** Customer questions. */
  get questions(): QuestionsResource {
    return this.resource('questions', QuestionsResource);
  }

  /** Seller-funded campaigns. */
  get promotions(): PromotionsResource {
    return this.resource('promotions', PromotionsResource);
  }

  /** Returns and claims. */
  get claims(): ClaimsResource {
    return this.resource('claims', ClaimsResource);
  }

  /** Supplier listings and purchase orders. */
  get suppliers(): SuppliersResource {
    return this.resource('suppliers', SuppliersResource);
  }

  /** Test order creation. Sandbox only. */
  get testOrders(): TestOrdersResource {
    return this.resource('testOrders', TestOrdersResource);
  }

  /**
   * Call an operation this SDK does not type.
   *
   * The escape hatch, running the same authenticated, middleware-wrapped pipeline. Hepsiburada
   * ships endpoints before it documents them, and a missing type should never be the reason an
   * integration is blocked.
   *
   * ```ts
   * await client.request({ operationId: 'somethingNew', module: 'order', method: 'GET', path: '/new/thing' });
   * ```
   */
  request<TResponse>(operation: OperationRequest): Promise<TResponse> {
    return this.transport.request<TResponse>(operation);
  }

  /**
   * The base URL a product resolves to, or a refusal explaining why it has none.
   *
   * The two sandbox stubs are the only products without a production host, and this is where a
   * caller finds that out — in a message, rather than as a DNS failure three layers down.
   */
  private baseUrlFor(module: string): string {
    const url = this.config.baseUrls[module];
    if (url) return url;

    const hosts = HOSTS[module];
    if (hosts?.sitOnly) {
      throw new HepsiburadaError(
        `The "${module}" product exists only in the sandbox — Hepsiburada publishes no production ` +
          `host for it, and the name does not resolve. Construct the client with ` +
          `{ environment: 'sandbox' } to use it, or pass baseUrls['${module}'] to point it somewhere.`,
        { operationId: 'resolveBaseUrl', module, method: 'NONE', url: '' }
      );
    }
    return '';
  }

  /** Resources are constructed once and reused. */
  private resource<T>(key: string, Ctor: new (transport: Transport, merchantId: string) => T): T {
    const existing = this.cache.get(key);
    if (existing) return existing as T;

    const created = new Ctor(this.transport, this.config.merchantId);
    this.cache.set(key, created);
    return created;
  }
}
