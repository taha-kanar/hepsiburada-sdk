#!/usr/bin/env node
/**
 * Generate `src/generated/*` from the documents in `openapi/`.
 *
 *   npm run generate
 *
 * Output is never hand-edited. When production disagrees with a document, the correction goes in
 * `openapi/overlays/<module>.json` and is folded in here, so the next `npm run specs:fetch`
 * cannot silently revert it.
 *
 * Three things about Hepsiburada's documents shape this tool.
 *
 * **Two dialects.** The .NET and Java services publish OpenAPI 3.0.x; the five Go services
 * publish Swagger 2.0, with `definitions` instead of `components.schemas`, `host`/`basePath`
 * instead of `servers`, and body parameters instead of `requestBody`. Everything is normalised to
 * the OpenAPI 3 shape on the way in, so the emitters see one form.
 *
 * **No usable operation names.** Forty of the ninety-six operations declare no `operationId`, and
 * the fifty-six that do declare it as Turkish prose with spaces — `"Buybox Sıralama Sorgulama"`.
 * Neither can name a type or a method, so names are derived from the method and path instead, by
 * a rule that is stable across regeneration. The document's own `operationId` and `summary` are
 * preserved in the JSDoc and in `operations.json`, so the mapping back to the portal is never lost.
 *
 * **Names that carry their package path.** swaggo emits definitions called
 * `git_hepsiburada_com_oms_fulfilment-projections_application_api_external_model.OrderLine`.
 * Everything up to the last separator is stripped.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SPEC_DIR = join(ROOT, 'openapi');
const OVERLAY_DIR = join(SPEC_DIR, 'overlays');
const OUT_DIR = join(ROOT, 'src', 'generated');

const METHODS = ['get', 'post', 'put', 'delete', 'patch'];

// ---- helpers ----

const pascal = (input) =>
  String(input)
    .replace(/[^A-Za-z0-9]+(.)?/g, (_, chr) => (chr ? chr.toUpperCase() : ''))
    .replace(/^(.)/, (chr) => chr.toUpperCase());

const camel = (input) => pascal(input).replace(/^(.)/, (chr) => chr.toLowerCase());

/** `model.OrderLine` and `git_..._model.OrderLine` both become `OrderLine`. */
const localName = (name) => String(name).replace(/^.*[.]/, '').replace(/[^A-Za-z0-9_]/g, '');

const isIdent = (name) => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name);
const propKey = (name) => (isIdent(name) ? name : JSON.stringify(name));

/** Escape a comment terminator in vendor prose, so a description cannot end the JSDoc early. */
const safeComment = (text) => String(text).replace(/\*\//g, '*\\/').replace(/\r?\n/g, ' ').trim();

// ---- normalisation: Swagger 2.0 -> OpenAPI 3 ----

/**
 * Rewrite a document into the OpenAPI 3 shape.
 *
 * Only the parts this generator reads are converted; the goal is one internal form, not a
 * faithful upgrade.
 */
function normalise(spec) {
  if (spec.openapi) return { ...spec, schemas: spec.components?.schemas ?? {} };

  const schemas = spec.definitions ?? {};
  const paths = {};

  for (const [path, item] of Object.entries(spec.paths ?? {})) {
    paths[path] = {};
    for (const [key, operation] of Object.entries(item)) {
      if (!METHODS.includes(key)) {
        paths[path][key] = operation;
        continue;
      }

      const parameters = [];
      let requestBody;

      for (const parameter of operation.parameters ?? []) {
        if (parameter.in === 'body') {
          requestBody = {
            required: parameter.required === true,
            content: { 'application/json': { schema: parameter.schema } },
            ...(parameter.description ? { description: parameter.description } : {}),
          };
          continue;
        }
        if (parameter.in === 'formData') {
          requestBody = requestBody ?? { required: false, content: { 'multipart/form-data': { schema: { type: 'object', properties: {} } } } };
          const target = requestBody.content['multipart/form-data'].schema;
          target.properties[parameter.name] = { type: parameter.type === 'file' ? 'string' : parameter.type, ...(parameter.type === 'file' ? { format: 'binary' } : {}) };
          continue;
        }
        parameters.push(parameter);
      }

      const responses = {};
      for (const [code, response] of Object.entries(operation.responses ?? {})) {
        responses[code] = response.schema
          ? { ...response, content: { 'application/json': { schema: response.schema } } }
          : response;
      }

      paths[path][key] = { ...operation, parameters, ...(requestBody ? { requestBody } : {}), responses };
    }
  }

  return { ...spec, paths, schemas };
}

// ---- operation naming ----

const normaliseWord = (word) => word.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Is `segment` merely the label for the placeholder that follows it?
 *
 * `/orders/merchantid/{merchantId}` spends two segments saying one thing, and only the value
 * matters to a caller. But `/issues/{number}` does not: `issues` is the resource. Telling them
 * apart by name similarity rather than by position is what keeps `getIssues` from collapsing into
 * the meaningless `getApiV10`.
 */
function labelsPlaceholder(segment, placeholder) {
  const a = normaliseWord(segment);
  const b = normaliseWord(placeholder);
  if (!a || !b) return false;
  return a === b || a.endsWith(b) || b.endsWith(a);
}

/** Segments that say nothing about which operation this is. */
const NOISE = (segment) => segment === 'api' || /^v\d+(\.\d+)*$/i.test(segment);

/**
 * A stable method name for an operation, derived from its verb and path.
 *
 * Placeholders drop out, along with the segment that merely labels one, and so do the `api` and
 * version prefixes. What survives is the resource and the action:
 * `GET /orders/merchantid/{merchantId}` is `getOrders`, and
 * `POST /packages/merchantid/{m}/packagenumber/{p}/intransit` is `postPackagesIntransit`.
 */
function baseName(method, path) {
  const segments = path.split('/').filter(Boolean);
  const kept = [];
  let lastKey;

  for (let index = 0; index < segments.length; index++) {
    const segment = segments[index];
    if (segment.startsWith('{')) continue;
    if (NOISE(segment)) continue;

    const next = segments[index + 1];
    if (next?.startsWith('{')) {
      const placeholder = next.slice(1, -1);
      if (labelsPlaceholder(segment, placeholder)) {
        // `merchantid` is in nearly every path; it can never distinguish two operations.
        if (normaliseWord(segment) !== 'merchantid') lastKey = segment;
        continue;
      }
      // Not a label — the resource itself. Remember the placeholder in case we need to qualify.
      lastKey = lastKey ?? placeholder;
    }
    kept.push(segment);
  }

  const tail = segments[segments.length - 1] ?? '';
  const qualifier = tail.startsWith('{') ? (lastKey ?? tail.slice(1, -1)) : undefined;

  return {
    name: camel(`${method} ${kept.map(pascal).join('')}`),
    qualifier,
    depth: segments.length,
  };
}

/**
 * Assign every operation in a document a unique name.
 *
 * Where two paths collapse to the same stem — `/orders/merchantid/{m}` and
 * `/orders/merchantid/{m}/ordernumber/{orderNumber}` both reduce to `orders` — the shorter path
 * keeps the plain name and the longer one is qualified by what it is fetched by, giving
 * `getOrders` and `getOrdersByOrdernumber`. Sorting by depth first makes that assignment stable
 * no matter what order the document lists its paths in.
 */
function nameOperations(spec) {
  const draft = [];

  for (const [path, item] of Object.entries(spec.paths ?? {})) {
    for (const method of METHODS) {
      const operation = item[method];
      if (!operation) continue;
      draft.push({ path, method, operation, ...baseName(method, path), inherited: item.parameters ?? [] });
    }
  }

  const counts = new Map();
  for (const entry of draft) counts.set(entry.name, (counts.get(entry.name) ?? 0) + 1);

  const used = new Set();
  const order = [...draft].sort((a, b) => a.depth - b.depth || a.path.localeCompare(b.path));

  for (const entry of order) {
    let name = entry.name;
    if ((counts.get(entry.name) > 1 && used.has(name)) || !name.replace(entry.method, '')) {
      if (entry.qualifier) name = `${entry.name}By${pascal(entry.qualifier)}`;
    }
    // Deterministic last resort, so regeneration never shuffles names.
    let suffix = 2;
    let unique = name;
    while (used.has(unique)) unique = `${name}${suffix++}`;
    used.add(unique);
    entry.name = unique;
  }

  return draft;
}

// ---- types ----

function refName(ref) {
  return localName(String(ref).replace(/^#\/(components\/schemas|definitions)\//, ''));
}

function tsType(schema, spec, depth = 0) {
  if (!schema || depth > 12) return 'unknown';
  if (schema.$ref) return refName(schema.$ref);

  if (schema.enum?.length && (schema.type === 'string' || schema.type === undefined)) {
    return schema.enum.map((value) => JSON.stringify(String(value))).join(' | ');
  }

  switch (schema.type) {
    case 'string':
      return schema.format === 'binary' ? 'FileInput' : 'string';
    case 'integer':
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'array':
      return `${tsType(schema.items ?? {}, spec, depth + 1)}[]`;
    case 'object':
    case undefined: {
      if (schema.properties) return objectBody(schema, spec, depth);
      if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
        return `Record<string, ${tsType(schema.additionalProperties, spec, depth + 1)}>`;
      }
      if (schema.allOf?.length) return schema.allOf.map((part) => tsType(part, spec, depth + 1)).join(' & ');
      if (schema.oneOf?.length || schema.anyOf?.length) {
        return (schema.oneOf ?? schema.anyOf).map((part) => tsType(part, spec, depth + 1)).join(' | ');
      }
      return schema.type === 'object' ? 'Record<string, unknown>' : 'unknown';
    }
    default:
      return 'unknown';
  }
}

function objectBody(schema, spec, depth = 0, indent = '  ') {
  const required = new Set(schema.required ?? []);
  const lines = ['{'];

  for (const [name, property] of Object.entries(schema.properties ?? {})) {
    const doc = docFor(property, indent);
    if (doc) lines.push(doc);
    const optional = required.has(name) ? '' : '?';
    lines.push(`${indent}${propKey(name)}${optional}: ${tsType(property, spec, depth + 1)};`);
  }

  lines.push(`${indent.slice(2)}}`);
  return lines.join('\n');
}

/** A JSDoc block for a property, when the document says anything worth repeating. */
function docFor(schema, indent) {
  const parts = [];
  if (schema.description) parts.push(safeComment(schema.description));
  if (schema['x-observed']) {
    parts.push(
      // Not "absent from the document": a correction is as often a field the document names
      // differently as one it omits entirely, and the remark has to be true of both.
      `@remarks Taken from a live response on ${schema['x-observed']}, which the published document contradicts. See openapi/overlays/.`
    );
  }
  if (schema['x-observed-note']) parts.push(safeComment(schema['x-observed-note']));
  if (!parts.length) return '';
  if (parts.length === 1 && parts[0].length < 100) return `${indent}/** ${parts[0]} */`;
  return [`${indent}/**`, ...parts.map((part) => `${indent} * ${part}`), `${indent} */`].join('\n');
}

function declare(name, schema, spec) {
  const doc = docFor(schema, '');
  const head = doc ? `${doc}\n` : '';

  if (schema.type === 'object' || schema.properties) {
    return `${head}export interface ${name} ${objectBody(schema, spec, 0, '  ')}\n`;
  }
  return `${head}export type ${name} = ${tsType(schema, spec)};\n`;
}

// ---- per-operation shapes ----

function paramsOf(entry) {
  const all = [...entry.inherited, ...(entry.operation.parameters ?? [])];
  return {
    path: all.filter((p) => p.in === 'path'),
    query: all.filter((p) => p.in === 'query'),
    header: all.filter((p) => p.in === 'header'),
  };
}

/** A parameter's schema, in either dialect. */
const paramSchema = (parameter) => parameter.schema ?? { type: parameter.type, items: parameter.items, enum: parameter.enum, format: parameter.format };

function parameterInterface(name, parameters, spec) {
  if (!parameters.length) return null;
  const schema = {
    type: 'object',
    properties: Object.fromEntries(
      parameters.map((parameter) => [
        parameter.name,
        { ...paramSchema(parameter), ...(parameter.description ? { description: parameter.description } : {}) },
      ])
    ),
    required: parameters.filter((parameter) => parameter.required).map((parameter) => parameter.name),
  };
  return `export interface ${name} ${objectBody(schema, spec, 0, '  ')}\n`;
}

/** The 2xx response body schema, and whether it is JSON. */
function successResponse(operation) {
  for (const code of Object.keys(operation.responses ?? {})) {
    if (!/^2\d\d$/.test(code)) continue;
    const response = operation.responses[code];
    const content = response.content ?? {};
    const json = content['application/json'] ?? content['text/json'] ?? content['*/*'];
    if (json?.schema) return { code, schema: json.schema };
    // A 2xx with content declared but no JSON member, or none at all.
    return { code, schema: undefined };
  }
  return undefined;
}

function requestBodyOf(operation) {
  const content = operation.requestBody?.content ?? {};
  const multipart = content['multipart/form-data'];
  if (multipart?.schema) return { schema: multipart.schema, multipart: true, required: operation.requestBody.required === true };
  const json = content['application/json'] ?? content['text/json'] ?? content['*/*'];
  if (json?.schema) return { schema: json.schema, multipart: false, required: operation.requestBody.required === true };
  return undefined;
}

// ---- pagination ----

const PAGE_PARAMS = [
  ['page', 'size'],
  ['page', 'pagesize'],
  ['page', 'pageSize'],
];

/**
 * Read a paging dialect off an operation's own query parameters.
 *
 * Derived rather than configured, so a renamed parameter surfaces as a diff. The one thing that
 * cannot be read from the document is where page numbering starts: `catalog` counts from 0 and
 * `question` counts from 1, and both simply say `integer`. That comes from the parameter's
 * documented default, and falls back to 0.
 */
function paginationOf(entry, spec) {
  const { query } = paramsOf(entry);
  const byName = new Map(query.map((parameter) => [parameter.name, parameter]));
  const has = (name) => byName.has(name);

  for (const [pageParam, sizeParam] of PAGE_PARAMS) {
    if (has(pageParam) && has(sizeParam)) {
      const schema = paramSchema(byName.get(pageParam));
      const fallback = byName.get(pageParam).default ?? schema?.default;
      const firstPage = Number(fallback) === 1 ? 1 : 0;
      return { request: { style: 'page', pageParam, sizeParam, firstPage }, response: envelopeOf(entry, spec) };
    }
  }

  for (const [offsetParam, limitParam] of [
    ['offset', 'limit'],
    ['Offset', 'Limit'],
    ['Offset', 'limit'],
    ['offset', 'Limit'],
  ]) {
    if (has(offsetParam) && has(limitParam)) {
      return { request: { style: 'offset', offsetParam, limitParam }, response: envelopeOf(entry, spec) };
    }
  }

  return undefined;
}

const deref = (schema, spec) =>
  schema?.$ref ? spec.schemas?.[schema.$ref.replace(/^#\/(components\/schemas|definitions)\//, '')] : schema;

/** First property whose name matches one of `names`, compared without regard to case. */
function pick(properties, names) {
  const byLower = new Map(Object.keys(properties).map((key) => [key.toLowerCase(), key]));
  for (const name of names) {
    const hit = byLower.get(name);
    if (hit) return hit;
  }
  return undefined;
}

const ROWS = ['data', 'listings', 'items', 'content'];
// Five spellings of "how many rows are there", and three of "how many pages". `count` is last
// because it is the loosest; `mpfinance-external` is the one product that uses it bare.
const TOTAL = ['totalcount', 'totalelements', 'totalitemcount', 'total', 'count'];
const PAGES = ['pagecount', 'totalpages', 'totalpagecount'];

/**
 * Which envelope the 2xx body uses, by looking for the row-carrying property.
 *
 * Matching is case-insensitive and descends one level, because neither assumption held against
 * production. `diskonto-external` answers `{Success, Data:{TotalCount, Items}}`: the rows are
 * PascalCase *and* nested one level below the property a case-sensitive top-level search finds.
 * Reading `data` off that response yields undefined, and a paginator that believes it reports the
 * merchant has no campaigns — no error, no empty-page warning, just silence.
 *
 * A nested carrier is emitted as a dotted path, which `readPage` resolves.
 */
function envelopeOf(entry, spec) {
  const schema = deref(successResponse(entry.operation)?.schema, spec);
  const properties = schema?.properties ?? {};

  let items = pick(properties, ROWS);
  let total = pick(properties, TOTAL);
  let pageCount = pick(properties, PAGES);

  // The rows may sit inside the carrier rather than being it.
  const carrier = items ? deref(properties[items], spec) : undefined;
  if (carrier && carrier.type !== 'array' && carrier.properties) {
    const inner = carrier.properties;
    const innerItems = pick(inner, ROWS);
    if (innerItems) {
      const innerTotal = pick(inner, TOTAL);
      const innerPages = pick(inner, PAGES);
      const prefix = items;
      items = `${prefix}.${innerItems}`;
      if (innerTotal) total = `${prefix}.${innerTotal}`;
      if (innerPages) pageCount = `${prefix}.${innerPages}`;
    }
  }

  return { items: items ?? 'items', ...(total ? { total } : {}), ...(pageCount ? { pageCount } : {}) };
}

// ---- overlays ----

/** RFC 7386 JSON Merge Patch: `null` deletes, objects merge, everything else replaces. */
function merge(base, patch) {
  if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) return patch;
  const target = base && typeof base === 'object' && !Array.isArray(base) ? { ...base } : {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) delete target[key];
    else target[key] = merge(target[key], value);
  }
  return target;
}

function countObserved(node) {
  if (!node || typeof node !== 'object') return 0;
  let total = 'x-observed' in node ? 1 : 0;
  for (const value of Object.values(node)) total += countObserved(value);
  return total;
}

/**
 * Fold `openapi/overlays/<module>.json` into a document.
 *
 * Overlay entries are ordinary OpenAPI fragments carrying provenance keys, so an entry stops
 * being a patch and becomes a no-op the day Hepsiburada publishes the same field.
 */
function applyOverlay(module, spec) {
  const file = join(OVERLAY_DIR, `${module}.json`);
  if (!existsSync(file)) return { spec, applied: 0 };
  const overlay = JSON.parse(readFileSync(file, 'utf8'));
  return { spec: merge(spec, overlay), applied: countObserved(overlay) };
}

// ---- emit ----

function generateModule(product, spec) {
  const entries = nameOperations(spec);
  const lines = [
    '/* eslint-disable */',
    '/**',
    ` * ${product.title} — generated from openapi/${product.module}.json. Do not edit.`,
    ' *',
    ` * Source: ${product.slug} ${product.version}, refreshed with \`npm run specs:fetch\`.`,
    ' * Corrections belong in openapi/overlays/, not here.',
    ' */',
    '',
  ];

  let usesFileInput = false;
  const body = [];

  for (const [rawName, schema] of Object.entries(spec.schemas ?? {})) {
    const declaration = declare(localName(rawName), schema, spec);
    if (declaration.includes('FileInput')) usesFileInput = true;
    body.push(declaration);
  }

  const catalog = [];

  for (const entry of entries) {
    const Name = pascal(entry.name);
    const { path: pathParams, query } = paramsOf(entry);
    const request = requestBodyOf(entry.operation);
    const success = successResponse(entry.operation);
    const pagination = paginationOf(entry, spec);

    const doc = [
      '/**',
      ` * ${safeComment(entry.operation.summary ?? entry.operation.description ?? entry.name)}`,
      ' *',
      ` * \`${entry.method.toUpperCase()} ${entry.path}\``,
    ];
    if (entry.operation.operationId) doc.push(` * Published as "${safeComment(entry.operation.operationId)}".`);
    doc.push(' */');
    body.push(doc.join('\n'));

    const queryInterface = parameterInterface(`${Name}Query`, query, spec);
    if (queryInterface) body.push(queryInterface);

    const pathInterface = parameterInterface(`${Name}Params`, pathParams, spec);
    if (pathInterface) body.push(pathInterface);

    if (request) {
      if (request.multipart) usesFileInput = true;
      const declaration = request.schema.$ref
        ? `export type ${Name}Body = ${refName(request.schema.$ref)};\n`
        : declare(`${Name}Body`, request.schema, spec);
      if (declaration.includes('FileInput')) usesFileInput = true;
      body.push(declaration);
    }

    const responseType = success?.schema ? tsType(success.schema, spec) : 'void';
    body.push(`export type ${Name}Response = ${responseType};\n`);

    catalog.push({
      module: product.module,
      operationId: entry.name,
      method: entry.method.toUpperCase(),
      path: entry.path,
      summary: entry.operation.summary ?? entry.operation.description ?? null,
      publishedAs: entry.operation.operationId ?? null,
      ...(pagination ? { pagination } : {}),
      ...(request?.multipart ? { multipart: true } : {}),
      ...(entry.operation['x-supports-date-filter'] ? { supportsDateFilter: true } : {}),
      ...(entry.operation['x-rejects-date-filter'] ? { rejectsDateFilter: true } : {}),
    });
  }

  if (usesFileInput) {
    lines.push("import type { FileInput } from '../core/http/form-data.js';", '');
  }

  return { source: lines.concat(body).join('\n'), catalog };
}

// ---- main ----

function main() {
  const manifest = JSON.parse(readFileSync(join(SPEC_DIR, 'manifest.json'), 'utf8'));
  const catalog = [];
  const pagination = {};
  const barrel = [
    '/* eslint-disable */',
    '/** Generated from openapi/. Do not edit. */',
    '',
  ];
  /** The type-only half, emitted separately as `types.ts`. */
  const typeBarrel = [];

  let overlaysApplied = 0;

  for (const product of manifest.products) {
    const file = join(SPEC_DIR, `${product.module}.json`);
    if (!existsSync(file)) {
      console.error(`${product.module.padEnd(16)} openapi/${product.module}.json is missing — run \`npm run specs:fetch\``);
      process.exitCode = 1;
      continue;
    }

    // Patch first, normalise second. The overlay is written against the document as Hepsiburada
    // publishes it -- that is what lets a drift finding's schemaPath be pasted straight in -- and
    // `normalise` copies `components.schemas`/`definitions` into one internal `schemas` key.
    // Merging after it patched the copy the generator no longer reads, so every schema correction
    // was silently counted and dropped.
    const { spec: patched, applied } = applyOverlay(product.module, JSON.parse(readFileSync(file, 'utf8')));
    const spec = normalise(patched);
    overlaysApplied += applied;

    const { source, catalog: entries } = generateModule(product, spec);
    writeFileSync(join(OUT_DIR, `${product.module}.ts`), source);

    catalog.push(...entries);
    for (const entry of entries) {
      if (entry.pagination) pagination[`${entry.module}.${entry.operationId}`] = entry.pagination;
    }

    // Namespaced rather than flat: these are twelve independently-authored APIs and they reuse
    // names freely. `Money`, `Claim`, `Property` and `GetOrdersResponse` each mean different
    // things in different products, and flattening them would silently pick a winner.
    typeBarrel.push(`export type * as ${camel(product.module)} from './${product.module}.js';`);

    console.log(
      `${product.module.padEnd(16)} ${String(entries.length).padStart(2)} operations, ` +
        `${String(Object.keys(spec.schemas ?? {}).length).padStart(3)} schemas` +
        (applied ? `, ${applied} overlay field(s)` : '')
    );
  }

  // The type namespaces live in their own barrel, and it must stay free of runtime values.
  //
  // Mixing the two here produces a package that typechecks from source and is broken once
  // published: a bundler rolling declarations up flattens the barrel into one namespace and emits
  // `declare const index_order: typeof order` for each entry — which is not legal TypeScript when
  // `order` is a type-only namespace, and every consumer sees TS2708 from inside `index.d.ts`.
  // Keeping the type-only barrel separate is what makes the published `.d.ts` valid.
  writeFileSync(
    join(OUT_DIR, 'types.ts'),
    [
      '/* eslint-disable */',
      '/**',
      ' * Request and response types, one namespace per product. Generated from openapi/.',
      ' *',
      ' * Type-only by construction — see tools/generate.mjs for why nothing runtime may join it.',
      ' */',
      '',
      ...typeBarrel,
      '',
    ].join('\n')
  );

  barrel.push("export type * from './types.js';");
  barrel.push("export { PAGINATION } from './pagination.js';");
  barrel.push("export { REJECTS_DATE_FILTER } from './quirks.js';");
  barrel.push("export { HOSTS, type ProductHosts } from './hosts.js';", '');
  writeFileSync(join(OUT_DIR, 'index.ts'), barrel.join('\n'));

  writeFileSync(
    join(OUT_DIR, 'pagination.ts'),
    [
      '/* eslint-disable */',
      '/**',
      ' * Paging dialect per operation — generated from each document\'s own query parameters.',
      ' *',
      ' * Keyed `<module>.<operationId>`. Read the table in src/core/pagination.ts for why this is',
      ' * data rather than a convention.',
      ' */',
      "import type { PaginationDescriptor } from '../core/pagination.js';",
      '',
      `export const PAGINATION: Record<string, PaginationDescriptor> = ${JSON.stringify(pagination, null, 2)};`,
      '',
    ].join('\n')
  );

  const hosts = Object.fromEntries(
    manifest.products.map((product) => [
      product.module,
      { sit: product.sit, prod: product.prod ?? null, ...(product.sitOnly ? { sitOnly: true } : {}) },
    ])
  );
  writeFileSync(
    join(OUT_DIR, 'hosts.ts'),
    [
      '/* eslint-disable */',
      '/**',
      ' * Where each product lives, generated from openapi/manifest.json.',
      ' *',
      " * The documents' own `servers` blocks all name the sandbox; production hostnames are not",
      ' * published anywhere, because access is granted per merchant through a support ticket. Both',
      ' * are recorded in the manifest so neither is derived at runtime from the other.',
      ' *',
      ' * `sitOnly` marks the two sandbox stubs. Their production names do not resolve, so the client',
      ' * refuses to build one rather than failing later at DNS with nothing to explain it.',
      ' */',
      '',
      'export interface ProductHosts {',
      '  readonly sit: string;',
      '  readonly prod: string | null;',
      '  readonly sitOnly?: boolean;',
      '}',
      '',
      `export const HOSTS: Readonly<Record<string, ProductHosts>> = ${JSON.stringify(hosts, null, 2)};`,
      '',
    ].join('\n')
  );

  const rejects = catalog.filter((entry) => entry.rejectsDateFilter).map((entry) => `${entry.module}.${entry.operationId}`);
  writeFileSync(
    join(OUT_DIR, 'quirks.ts'),
    [
      '/* eslint-disable */',
      '/**',
      ' * Operations whose published parameters production does not honour.',
      ' *',
      ' * Generated from the `x-rejects-date-filter` markers in openapi/overlays/. These endpoints',
      ' * declare `begindate`/`enddate` and answer 400 WrongDateFormat for every value; the resource',
      ' * layer drops the parameters rather than sending a request that cannot succeed.',
      ' */',
      '',
      `export const REJECTS_DATE_FILTER: ReadonlySet<string> = new Set(${JSON.stringify(rejects, null, 2)});`,
      '',
    ].join('\n')
  );

  writeFileSync(join(SPEC_DIR, 'operations.json'), JSON.stringify(catalog, null, 2) + '\n');

  const paged = Object.keys(pagination).length;
  console.log(
    `\n${catalog.length} operations across ${manifest.products.length} products; ` +
      `${paged} paginated; ${overlaysApplied} overlay field(s) applied.`
  );

  const stale = readdirSync(OVERLAY_DIR)
    .filter((name) => name.endsWith('.json'))
    .map((name) => name.replace(/\.json$/, ''))
    .filter((module) => !manifest.products.some((product) => product.module === module));
  if (stale.length) console.log(`Overlays with no product: ${stale.join(', ')}`);
}

main();
