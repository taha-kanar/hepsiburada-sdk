#!/usr/bin/env node
/**
 * Ask production what it actually returns, and record only what is safe to record.
 *
 *   HB_MERCHANT_ID=… HB_SERVICE_KEY=… HB_USER_AGENT=… npm run observe
 *   npm run observe -- --module order            # one product
 *   npm run observe -- --write                   # persist openapi/verification.json
 *   npm run observe -- --environment sandbox     # against SIT instead
 *
 * The published documents describe the sandbox. Production hosts are unpublished, granted per
 * merchant through a support ticket, and the specs lag the running service — so the only way to
 * learn what a response really contains is to make one and look. That is what this does.
 *
 * Two constraints govern it, and both are enforced in code rather than by care:
 *
 * **Read-only.** The credentials this runs with belong to a live seller with real orders. A
 * middleware refuses anything that is not a GET on the allowlist below, before it reaches the
 * network — so a typo cannot ship a package, and adding a probe for a write endpoint fails rather
 * than firing.
 *
 * **No values, ever.** A response is reduced to field names, types and counts before anything is
 * printed or written. Buyer names, addresses, phone numbers, e-mails, TC kimlik and tax numbers
 * exist in these payloads; none of them reaches the terminal, the report, or the repository.
 *
 * What it answers:
 *   - do the production hosts match the manifest, for every product?
 *   - does the Basic-auth username slot want the merchant id, on each host?
 *   - does `mpop` report a business failure as 200 + `success:false`, or as a 4xx?
 *   - which fields do the live responses carry that the documents do not?
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const { HepsiburadaClient, HepsiburadaApiError, HepsiburadaError } = await import(join(ROOT, 'dist/index.js'));
const { findResponseSchema, findSchemaDrift, loadSpecDocuments } = await import(join(ROOT, 'dist/drift.js'));

/**
 * A recent 7-day window, for the endpoints that refuse an unfiltered query.
 *
 * `mpfinance-external` answers a bare `/transactions` with a 400 saying that one of OrderNumber,
 * PackageNumber, ReferenceDocument or Sku must be given, or else a date-range pair — even though
 * its own document marks every one of those parameters optional.
 */
const DAY = 86_400_000;
const stamp = (at) => new Date(at).toISOString().slice(0, 19);
const WINDOW = { start: stamp(Date.now() - 7 * DAY), end: stamp(Date.now()) };

/**
 * The only operations this tool may call.
 *
 * Every one is a GET that lists or looks up. Nothing here creates, transitions, cancels or
 * uploads. A probe is a `{ module, operationId, method, path }` plus the query it needs — the
 * same shape `client.request()` takes, so the allowlist is checked against the request that will
 * actually go out rather than against a label.
 */
const PROBES = [
  { module: 'order', operationId: 'getOrders', path: '/orders/merchantid/{merchantId}', query: { offset: 0, limit: 5 },
    asks: 'the main order feed, and whether begindate is honoured here' },
  { module: 'order', operationId: 'getOrdersCancelled', path: '/orders/merchantid/{merchantId}/cancelled', query: { offset: 0, limit: 5 },
    asks: 'cancelled orders' },
  { module: 'order', operationId: 'getPackages', path: '/packages/merchantid/{merchantId}', query: { Offset: 0, limit: 5 },
    asks: 'whether this endpoint really wants a capital Offset' },
  { module: 'order', operationId: 'getPackagesShipped', path: '/packages/merchantid/{merchantId}/shipped', query: { offset: 0, limit: 5 },
    asks: 'the PascalCase tracking feed' },
  { module: 'listing', operationId: 'getListings', path: '/listings/merchantid/{merchantId}', query: { offset: 0, limit: 5 },
    asks: 'listings, and whether this host accepts the same auth as OMS' },
  { module: 'catalog', operationId: 'getCategoriesGetAllCategories', path: '/api/categories/get-all-categories', query: { page: 0, size: 5, version: 1, leaf: true, status: 'ACTIVE', available: true },
    asks: 'whether mpop reports failure as 200 + success:false or as a 4xx' },
  { module: 'finance', operationId: 'getTransactions', path: '/transactions/merchantid/{merchantId}',
    query: { Offset: 0, Limit: 5, RecordDateStart: WINDOW.start, RecordDateEnd: WINDOW.end },
    asks: 'whether finance really capitalises both parameters, and which date format it takes' },
  { module: 'question', operationId: 'getIssues', path: '/api/v1.0/issues', query: { page: 1, size: 5 },
    headers: { merchantId: process.env.HB_MERCHANT_ID },
    asks: 'whether questions really count pages from one — and it needs merchantId as a header' },
  { module: 'claim-list', operationId: 'getClaims', path: '/claims/merchantId/{merchantId}', query: { offset: 0, limit: 5 },
    asks: 'claims, on the one path that spells merchantId with a capital I' },
  { module: 'shipping', operationId: 'getCargoFirms', path: '/cargoFirms/{merchantId}', query: {},
    asks: 'a reference list, to confirm the shipping host resolves and accepts the same auth' },
  { module: 'promotion', operationId: 'getSelfCampaignDiscounts', path: '/self-campaign/{merchantId}/discounts', query: { page: 0, pagesize: 5 },
    asks: 'whether promotions really spell it pagesize' },
];

const ALLOWED = new Set(PROBES.map((probe) => `${probe.module} GET ${probe.path}`));

/**
 * Refuse anything that is not an allowlisted GET.
 *
 * Middleware rather than a check at the call site, because a check at the call site is one a
 * future edit can route around. This one sees every request the transport builds, including from
 * `client.request()`.
 */
const readOnly = {
  name: 'read-only',
  async handle(request, next) {
    const { module, pathTemplate } = request.context;
    const key = `${module} ${request.method} ${pathTemplate}`;

    if (request.method !== 'GET' || !ALLOWED.has(key)) {
      throw new Error(
        `observe.mjs refused ${request.method} ${key}. This tool runs against a live seller ` +
          `account and may only issue allowlisted GETs. Add the probe to PROBES if it is a read.`
      );
    }
    return next(request);
  },
};

/** Field names that must never have their values read, printed or written. */
const SENSITIVE = /name|email|mail|phone|gsm|address|adres|identity|kimlik|tckn|taxnumber|vergi|iban|card|customer|recipient|receivedby/i;

/**
 * Reduce a payload to its shape: names, types, counts. Never a value.
 *
 * Enums are the one place a value would be useful, and it is still not taken — a status string
 * can carry an order number in some services' error paths, and the schema drift walk reports
 * unknown enum members by name anyway.
 */
function shapeOf(value, depth = 0) {
  if (value === null) return 'null';
  if (Array.isArray(value)) {
    if (!value.length) return 'array(0)';
    if (depth > 4) return `array(${value.length})`;
    // Merged across several elements, not read off the first. Optional fields are the norm in
    // these payloads -- `Deliveries` is present on some claims and absent from others -- so a
    // shape taken from element 0 alone reports a field as missing when it is merely optional.
    return { _array: value.length, _of: value.slice(0, 5).reduce((into, item) => unite(into, shapeOf(item, depth + 1)), undefined) };
  }
  if (typeof value !== 'object') return typeof value;
  if (depth > 4) return 'object';

  const shape = {};
  for (const [key, child] of Object.entries(value)) {
    shape[key] = SENSITIVE.test(key) ? `${typeof child} (redacted)` : shapeOf(child, depth + 1);
  }
  return shape;
}

/**
 * Combine two observed shapes into one that describes both.
 *
 * Disagreeing scalars become `"null | string"`, which is how a nullable field announces itself;
 * a key seen in only some elements is marked optional, because that is a different fact from a
 * key that is always present and the overlay written from it should say so.
 */
function unite(left, right) {
  if (left === undefined) return right;
  if (right === undefined) return left;
  // A nullable object or array: keep the structure and record that null was also seen, rather
  // than collapsing the structure into the string "null".
  if (left === 'null' && typeof right === 'object') return { ...right, _nullable: true };
  if (right === 'null' && typeof left === 'object') return { ...left, _nullable: true };
  if (typeof left === 'string' || typeof right === 'string') {
    if (left === right) return left;
    const parts = [...new Set([...String(left).split(' | '), ...String(right).split(' | ')])];
    return parts.sort().join(' | ');
  }
  if (left._array !== undefined || right._array !== undefined) {
    return { _array: Math.max(left._array ?? 0, right._array ?? 0), _of: unite(left._of, right._of) };
  }
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  const shape = {};
  for (const key of keys) {
    const seen = key in left && key in right;
    const merged = unite(left[key], right[key]);
    shape[key] = seen || typeof merged !== 'string' ? merged : `${merged} (optional)`;
  }
  return shape;
}

function argument(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

const credentials = {
  merchantId: process.env.HB_MERCHANT_ID,
  password: process.env.HB_SERVICE_KEY,
  userAgent: process.env.HB_USER_AGENT,
  username: process.env.HB_USERNAME,
};

for (const [key, value] of Object.entries(credentials)) {
  if (key !== 'username' && !value) {
    console.error(
      `Set HB_MERCHANT_ID, HB_SERVICE_KEY and HB_USER_AGENT in the environment.\n` +
        `HB_USER_AGENT is the integrator name registered in the merchant panel, matched exactly — ` +
        `any decorated variant is refused with a 401.\n` +
        `Missing: ${key}`
    );
    process.exit(1);
  }
}

const only = argument('module');
const environment = argument('environment', 'production');
const write = process.argv.includes('--write');

const client = new HepsiburadaClient({
  ...credentials,
  environment,
  middleware: [readOnly],
  timeoutMs: 30_000,
});

// Two views of the same documents. The published one is what the report records, because
// verification.json is the evidence an overlay entry is written from -- fold the overlays in and
// the trail disappears the moment it is used. The overlaid one answers the question that actually
// matters on a re-run: how much of what production sends is still unrecorded.
const published = loadSpecDocuments({ specsDir: join(ROOT, 'openapi'), overlays: false });
const corrected = loadSpecDocuments({ specsDir: join(ROOT, 'openapi'), overlays: true });
const selected = only ? PROBES.filter((probe) => probe.module === only) : PROBES;

console.log(`observing ${selected.length} read-only endpoint(s) against ${environment}\n`);

const report = {
  environment,
  probes: {},
  note: 'Field names, types and counts only. No values from any response are recorded here.',
};

for (const probe of selected) {
  const label = `${probe.module}.${probe.operationId}`;
  process.stdout.write(`  ${label.padEnd(42)} `);

  const entry = { asks: probe.asks, path: probe.path, host: client.config.baseUrls[probe.module] ?? null };

  try {
    const body = await client.request({
      operationId: probe.operationId,
      module: probe.module,
      method: 'GET',
      path: probe.path,
      pathParams: { merchantId: client.config.merchantId },
      query: probe.query,
      ...(probe.headers ? { headers: probe.headers } : {}),
    });

    entry.status = 200;
    entry.shape = shapeOf(body);

    const walk = (documents) => {
      const located = findResponseSchema(documents[probe.module], 'GET', probe.path);
      return located
        ? findSchemaDrift(documents[probe.module], located.schema, body, '', { schemaPath: located.schemaPath })
        : [{ kind: 'no-schema', path: '', actual: 'the document describes no response for this operation' }];
    };

    entry.drift = walk(published);
    entry.unrecorded = walk(corrected).length;

    console.log(
      `200  ${String(entry.drift.length).padStart(2)} vs published, ` +
        `${entry.unrecorded} still unrecorded`
    );
  } catch (error) {
    if (error instanceof HepsiburadaApiError) {
      entry.status = error.status;
      entry.details = error.details;
      entry.correlationId = error.context.correlationId ?? null;
      console.log(`${error.status}  ${error.details.join('; ') || '(no message)'}`);
    } else if (error instanceof HepsiburadaError) {
      entry.error = error.message;
      console.log(`—    ${error.message}`);
    } else {
      entry.error = String(error?.message ?? error);
      console.log(`—    ${entry.error}`);
    }
  }

  report.probes[label] = entry;
}

const statuses = Object.values(report.probes).map((entry) => entry.status);
const unrecorded = Object.values(report.probes).reduce((sum, entry) => sum + (entry.unrecorded ?? 0), 0);
console.log(
  `\n${statuses.filter((status) => status === 200).length}/${selected.length} answered 200` +
    (statuses.includes(401) ? '  — a 401 usually means the User-Agent is not an exact match' : '')
);
console.log(
  unrecorded === 0
    ? 'every difference from the published documents is already recorded in openapi/overlays/'
    : `${unrecorded} finding(s) not yet in openapi/overlays/ — write them up before trusting the types`
);

if (write) {
  const target = join(ROOT, 'openapi/verification.json');
  writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`wrote ${target}`);
} else {
  console.log('(pass --write to persist openapi/verification.json)');
}
