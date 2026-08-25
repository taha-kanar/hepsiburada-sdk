/**
 * A working tour of the SDK, in the order an integration actually needs it.
 *
 * Type-checked as part of `npm run typecheck`, so it cannot drift from the API it demonstrates.
 * Run it with real credentials in the environment:
 *
 *   HB_MERCHANT_ID=… HB_SERVICE_KEY=… HB_INTEGRATOR=… npx tsx examples/usage.ts
 */
import {
  HepsiburadaApiError,
  HepsiburadaClient,
  HepsiburadaRateLimitError,
  PAGINATION,
  RateLimitMiddleware,
  paginate,
  pollBatch,
  parseTimestamp,
} from '../src/index.js';
import type { order } from '../src/generated/types.js';

const client = new HepsiburadaClient({
  merchantId: process.env['HB_MERCHANT_ID'] ?? '',
  password: process.env['HB_SERVICE_KEY'] ?? '',
  // Exactly the integrator name registered in the merchant panel. Any decorated variant 401s.
  userAgent: process.env['HB_INTEGRATOR'] ?? '',
  // Opt in to the published limits: 180 req/min, and at most five concurrent uploads.
  middleware: [new RateLimitMiddleware()],
  logger: console,
});

/**
 * 1. Poll for new orders.
 *
 * `begindate` is honoured *only* here, and it is read as Turkey local time. Pass a `Date` and the
 * SDK formats it; passing an ISO string yourself would return 200 with an empty page.
 */
async function pollOrders(): Promise<void> {
  const since = new Date(Date.now() - 60 * 60_000);
  const response = await client.orders.list({ begindate: since, limit: 100 });

  for (const line of response.items ?? []) {
    // `merchantSKU`, capitalised — this product spells it that way and the type keeps it.
    console.log(line.orderNumber, line.merchantSKU, parseTimestamp(line.orderDate ?? null));
  }
}

/**
 * 2. Walk every page of a feed.
 *
 * The descriptor carries this operation's own dialect — `offset`/`limit` here, `Offset`/`Limit`
 * for finance, `page`/`pagesize` for promotions. Never hard-code one.
 */
async function everyCancelledOrder(): Promise<void> {
  const descriptor = PAGINATION['order.getOrdersCancelled'];
  if (!descriptor) throw new Error('no descriptor — did the generator run?');

  for await (const page of paginate<order.CancelledOrderLineRepresentation>(descriptor, (query) =>
    client.orders.listCancelled(query as { offset?: number; limit?: number })
  )) {
    console.log(`page ${page.index}: ${page.items.length} of ${page.total ?? '?'}`);
  }
}

/**
 * 3. Push stock and price, and read the per-row outcome.
 *
 * The batch is asynchronous and partial failure arrives inside a 200 — `pollBatch` resolves with
 * it rather than throwing, so the rows that succeeded are not lost with the ones that did not.
 *
 * Two traps here: listing prices are numbers with a dot (product *import* wants `"130,50"`, a
 * string with a comma), and a listing whose `isFulfilledByHB` is true must be excluded — pushing
 * your own stock at a Hepsiburada-warehouse listing oversells or zeroes it.
 */
async function syncInventory(): Promise<void> {
  const { listings } = await client.listings.list({ offset: 0, limit: 100 });
  const mine = (listings ?? []).filter((listing) => !listing.isFulfilledByHB);

  const rows = mine.map((listing) => ({
    hepsiburadaSku: listing.hepsiburadaSku ?? '',
    merchantSku: listing.merchantSku ?? '',
    price: 120.5,
    availableStock: 4,
    dispatchTime: 1,
  }));

  // `client.listings.updateInventory(rows)` is the typed call, and it returns `void`: the
  // document declares no response body for this operation. The service does hand back an upload
  // id, but nothing published says so, and this SDK will not invent a type from a rumour. Until
  // an overlay records it with evidence, read it through the escape hatch — which runs the same
  // authenticated, middleware-wrapped pipeline.
  const { id } = await client.request<{ id: string }>({
    operationId: 'postListingsInventoryUploads',
    module: 'listing',
    method: 'POST',
    path: '/listings/merchantid/{merchantId}/inventory-uploads',
    pathParams: { merchantId: client.config.merchantId },
    body: rows,
  });

  const result = await pollBatch(() => client.listings.inventoryUploadResult(id));

  if (result.ok) console.log(`all ${result.total ?? mine.length} rows accepted`);
  else for (const row of result.failed) console.warn(`row ${row.elementNo}: ${row.messages.join(', ')}`);
}

/**
 * 4. Ship a package.
 *
 * Note what does *not* happen next: your own API-driven actions are not echoed back as webhooks,
 * so nothing will arrive on your `/packages/{n}/intransit` endpoint because of this call.
 */
async function shipPackage(packageNumber: string, trackingNumber: string): Promise<void> {
  await client.orders.ship(packageNumber, { trackingNumber, deci: 2, shippedDate: new Date().toISOString() });
  console.log(`${packageNumber} handed to the carrier`);
}

/**
 * 5. Handle failures by what they are, not by their message.
 */
async function withErrorHandling(): Promise<void> {
  try {
    await client.orders.list();
  } catch (error) {
    if (error instanceof HepsiburadaRateLimitError) {
      // Hepsiburada publishes no Retry-After, so this is usually undefined.
      await new Promise((resolve) => setTimeout(resolve, error.retryAfterMs ?? 60_000));
    } else if (error instanceof HepsiburadaApiError) {
      // Quote the correlation id when opening a ticket — they keep it for seven days.
      console.error(error.status, error.details.join('; '), error.context.correlationId);
    } else {
      throw error;
    }
  }
}

/**
 * 6. Type a webhook handler.
 *
 * Hepsiburada calls you; there is nothing to subscribe to. Deliveries can repeat, so whatever
 * this does must be idempotent.
 */
export function onOrderCreated(body: import('../src/index.js').webhooks.CreateOrderWebhook): void {
  for (const line of body.items ?? []) upsertOrderLine(line.id ?? '', line);
}

declare function upsertOrderLine(id: string, line: unknown): void;

export { pollOrders, everyCancelledOrder, syncInventory, shipPackage, withErrorHandling };
