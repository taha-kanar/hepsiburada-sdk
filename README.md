# hepsiburada-sdk

Typed TypeScript client for the Hepsiburada Marketplace API. Twelve products, ninety-six
operations, zero runtime dependencies.

```bash
npm install hepsiburada-sdk
```

```ts
import { HepsiburadaClient } from 'hepsiburada-sdk';

const client = new HepsiburadaClient({
  merchantId: process.env.HB_MERCHANT_ID!,   // the GUID from the merchant panel
  password: process.env.HB_SERVICE_KEY!,     // servis anahtarı
  userAgent: process.env.HB_INTEGRATOR!,     // your registered integrator name, exactly
});

const orders = await client.orders.list({ begindate: new Date(Date.now() - 3_600_000) });
```

---

## Read this before your first call

Two mistakes account for nearly every failed Hepsiburada integration, and both look like
something else when they happen.

### 1. The `User-Agent` is a credential

It is mandatory, it is validated, and it must be **exactly** the integrator name registered in
your merchant panel. Every decorated variant is refused with a `401` that reads like a bad
password:

| Value | Result |
|---|---|
| `acme_dev` | 200 |
| `<merchantId> - acme_dev` | **401** |
| `<merchantId> - SelfIntegration` | **401** |
| `acme_dev/1.0` | **401** |

The `{merchantId} - {AppName}` form is the one most widely published online. It does not work.
Because only you can know your registered name, this SDK requires `userAgent` and never invents a
default — a synthesised one would guarantee a 401 that looks like a credentials problem.

Find it in **Bilgilerim → Entegrasyon → Entegratör Bilgileri**.

### 2. The Basic-auth username is your merchant id

```
Authorization: Basic base64(merchantId + ':' + serviceKey)
```

Hepsiburada's own FAQ describes a separate developer username, and the merchant panel displays a
`Username` field. Neither is what the OMS External API wants: live testing shows `merchantId:key`
returns 200 where `username:key` returns 401. That panel field is for something else, and
mistaking it for this one is a documented cause of production outages.

If your account is provisioned the other way, pass `username` explicitly and it takes the slot
instead:

```ts
new HepsiburadaClient({ merchantId, username: 'acme_dev', password, userAgent: 'acme_dev' });
```

---

## Dates: the trap that returns 200

Order filters take `yyyy-MM-dd HH:mm` — a space, no seconds, no zone — and read it as **Turkey
local time** (UTC+3, no daylight saving). Neither fact is documented, and getting it wrong does
not raise:

- an **ISO-8601** value is accepted by the parameter parser and matches no records — 200, empty page;
- a **UTC** value shifts the window three hours early and quietly drops the newest orders on every sync.

So pass a `Date` and let the SDK format it:

```ts
await client.orders.list({ begindate: new Date(Date.now() - 3_600_000) });
// → ?begindate=2026-08-25%2012%3A00
```

**Four endpoints declare a date filter and reject every value** with `400 WrongDateFormat` —
`/orders/…/cancelled` and the three `/packages/{shipped,delivered,undelivered}` feeds. Their
methods take a `PageWindow` instead of a `DateWindow`, so the filter is not offered and is dropped
at run time even if it slips through from JavaScript. The list is generated from
`openapi/overlays/order.json` and exported as `REJECTS_DATE_FILTER`.

---

## Twelve products, not one API

Written by three teams in three languages, and they do not agree with each other. The SDK does
not pretend otherwise — every difference below is data or a type, never a convention you have to
remember.

| Product | `client.…` | Host | Ops |
|---|---|---|---|
| Katalog Ürün | `products` | `mpop.hepsiburada.com/product` | 14 |
| Ürün Güncelleme | `productUpdates` | `mpop.hepsiburada.com/ticket-api` | 3 |
| Listeleme | `listings` | `listing-external` | 18 |
| Satıcı Promosyonu | `promotions` | `diskonto-external` | 9 |
| Sipariş | `orders` | `oms-external` | 28 |
| Shipping | `shipping` | `shipping-external` | 4 |
| Muhasebe | `finance` | `mpfinance-external` | 2 |
| Satıcıya Sor | `questions` | `api-asktoseller-merchant` | 6 |
| Talep Listeleme | `claims` | `oms-external` | 5 |
| Tedarikçi | `suppliers` | `supplier-api-external` | 5 |
| Test Siparişi | `testOrders` | *sandbox only* | 1 |
| Talep Oluşturma | `claims.create` | *sandbox only* | 1 |

### Paging: six dialects, three envelopes

```ts
import { PAGINATION, paginate } from 'hepsiburada-sdk';

for await (const page of paginate(PAGINATION['order.getOrders'], (query) => client.orders.list(query))) {
  for (const line of page.items) process(line);
}
```

| Product | Request | Rows |
|---|---|---|
| catalog, product-update | `page`/`size`, **0-based** | `data` |
| listing | `offset`/`limit` | `listings` |
| order, claim-list | `offset`/`limit` | `items` |
| order — `/packages`, `/packages/status/unpacked` | **`Offset`**/`limit` | `items` |
| finance | **`Offset`/`Limit`** | `items` |
| question | `page`/`size`, **1-based** | `data` |
| promotion | `page`/**`pagesize`** | `data` |

The casing is not even consistent within one product: `/packages` wants `Offset` and
`/packages/shipped`, on the same host, wants `offset`. Send the wrong one and you get page one
forever, with no error. The descriptors are generated from each document's own parameter names,
so a rename shows up as a diff rather than as a silent regression.

### Naming a type

Every resource method is already typed, so you rarely need to. When you do, they live behind their
own entry point, one namespace per product:

```ts
import type { order, listing } from 'hepsiburada-sdk/types';

function summarise(line: order.LineRepresentation): string { /* … */ }
```

Namespaced because several products define a `Money` and several define a `Claim`, and no two
agree — `order.Money` and `finance.Money` are different shapes. Behind their own entry point so
that `order` and `listing` are not names every consumer has to avoid.

### Path casing

`oms-external` and `listing-external` spell the segment `/merchantid/`, all lower case — the
listing service answers `/merchantId/` with a **400**. But `claim-list` and `test-order` spell
their own segment `/merchantId/`, with a capital I, in their published documents. There is no
house style to apply. Templates are copied from each spec verbatim and a test enforces it.

### The tracking feeds are PascalCase, and thin

`/packages/{shipped,delivered,undelivered}` return `Id`, `OrderNumber`, `Barcode`,
`PackageNumber`, `ShippedDate`, `Deci`, `EtgbNo` — capitalised, with no customer, line items,
amounts or addresses. Every detail endpoint on the same host is camelCase. The types say so
rather than normalising, because assuming camelCase once collapsed 58 package records into a
single empty-keyed row.

### No feed is a snapshot

A line item that has been packed **leaves** `orders.list()` and appears under
`orders.listPackages()`. It was not deleted. Reconciling your database against any single feed
deletes real data — this once stripped line items from 67 of 69 orders. Merge, never replace.

---

## Bulk writes: partial failure inside a 200

Two idioms, both asynchronous, and neither fails the HTTP request when rows are rejected.

```ts
import { pollBatch } from 'hepsiburada-sdk';

// Catalog: multipart, returns data.trackingId
const { data } = await client.products.importProducts([
  { categoryId: 18021982, merchant: merchantId, attributes: { merchantSku: 'ABC', price: '130,50' } },
]);
const result = await pollBatch(() => client.products.importStatus(data.trackingId));

// Listing: bare JSON array, returns { id }
const { id } = await client.listings.updateInventory([{ hepsiburadaSku: 'HBV1', price: 120.5, availableStock: 4 }]);
const inventory = await pollBatch(() => client.listings.inventoryUploadResult(id));

if (!inventory.ok) {
  for (const row of inventory.failed) console.warn(`row ${row.elementNo}: ${row.messages.join(', ')}`);
}
```

`pollBatch` **resolves** when rows are rejected — it does not throw. Throwing would discard the
rows that succeeded and make a few bad SKUs indistinguishable from an outage.

Note the decimals: **product import wants `"130,50"`** — a string with a comma — while **listing
price wants `120.50`**, a number with a dot. Same seller, same product, two surfaces.

---

## Errors

```ts
import { HepsiburadaApiError, HepsiburadaRateLimitError } from 'hepsiburada-sdk';

try {
  await client.orders.list();
} catch (error) {
  if (error instanceof HepsiburadaRateLimitError) await wait(error.retryAfterMs ?? 60_000);
  else if (error instanceof HepsiburadaApiError) {
    console.error(error.status, error.details, error.context.correlationId);
  }
}
```

Three body shapes, and one of them is not JSON:

- `listing-external` answers 401 with `text/plain: Missing Credentials!`
- `oms-external` answers 401 with an **empty** body and a JSON content type
- the Go services declare their 400/401/500 bodies as a bare string
- `mpop` wraps everything in `{ success, code, message, data }`, where `code: 0` means success —
  and the schema permits a failure inside an HTTP 200, so the SDK checks the envelope on every
  catalog response

`error.details` flattens all of them. `error.context.correlationId` is the `x-correlation-id`
Hepsiburada support asks for; they retain it for seven days.

---

## Rate limits

180 requests/minute per IP, 240/minute on commissions, **five** concurrent listing uploads, 4000
SKUs per request. Opt in to the enforcer:

```ts
import { RateLimitMiddleware } from 'hepsiburada-sdk';

const client = new HepsiburadaClient({ ...credentials, middleware: [new RateLimitMiddleware()] });
```

The upload cap is the one worth having: a sixth in-flight upload is not refused with a 429 — the
service returns a **message inside a successful response**, so nothing downstream would recognise
it as a failure. Queueing locally is the only reliable fix.

---

## Traps worth knowing

- **`isFulfilledByHB` listings must be excluded from stock sync.** Pushing your own stock at a
  Hepsiburada-warehouse listing oversells it or zeroes it.
- **A price outside the category band locks the SKU** rather than rejecting the update. Recover
  with `client.listings.bulkUnlock()`.
- **There is no product delete.** Deactivate by setting stock and price to zero.
- **`hbSku` is immutable**; `merchantSku` is yours. Both are strings, always — a merchant SKU with
  a leading zero is not a number.

---

## Webhooks

Inbound only. There is no subscription API: you build eight endpoints under a base URL of your
own, e-mail that URL to Hepsiburada with a Basic username and password of your choosing, and they
call you. There is no signature header and no HMAC.

So this package ships the payload types and nothing else:

```ts
import { webhooks } from 'hepsiburada-sdk';

app.post('/orders', (req: { body: webhooks.CreateOrderWebhook }) => { /* … */ });
```

Two things the documentation says that are easy to miss: **your own API-driven actions are not
echoed back** — shipping through `client.orders.ship()` produces no `intransit` webhook — and
**deliveries can repeat**, so handle them idempotently.

---

## Sandbox

```ts
new HepsiburadaClient({ ...credentials, environment: 'sandbox' });
```

Every product switches to its `-sit` host. Two products exist **only** there —
`testOrders` and `claims.create` — and their production names do not resolve. Calling one against
production raises an error that says so, rather than failing at DNS three layers down.

---

## Drift detection

The published documents describe the sandbox and lag the running service. This is how the gaps
get found:

```ts
import { createDriftMiddleware, loadSpecDocuments } from 'hepsiburada-sdk/drift';

const client = new HepsiburadaClient({
  ...credentials,
  middleware: [createDriftMiddleware({ documents: loadSpecDocuments(), logger: console })],
});
```

Findings carry **field names and types only, never values**, so they are safe to log in staging.
Keep it off in production: it parses every response body twice.

Known gaps are recorded in `openapi/overlays/` as RFC 7386 merge patches, and every entry carries
`x-observed` (when) and `x-observed-evidence` (how) — enforced by a test. An entry becomes a no-op
the day Hepsiburada publishes the same thing.

---

## Not included

**e-Faturam** is a different product on a different host
(`api.hepsiburadaefaturam.com`) with different credentials and a different protocol — one
`POST /api/BasicIntegrationApi` dispatched by an `Action` name in the body. It shares a brand and
nothing else. This is deliberate, not a gap.

---

## Development

```bash
npm run specs:fetch      # refresh openapi/*.json from the developer portal
npm run generate         # regenerate src/generated/ from them
npm run typecheck && npm test && npm run build
npm run observe          # read-only probe against a live account (see below)
```

The specs are committed, so a Hepsiburada change arrives as a reviewable diff. The **types** are
generated; the **resource classes are hand-written**, which is what lets the coverage test mean
something — it greps the resource files and fails when the catalog moves.

`tools/observe.mjs` runs against real credentials, so it is read-only by construction: a
middleware refuses anything that is not an allowlisted GET before it reaches the network, and
every response is reduced to field names, types and counts before it is printed or written. It
needs `HB_MERCHANT_ID`, `HB_SERVICE_KEY` and `HB_USER_AGENT` in the environment.

## License

MIT
