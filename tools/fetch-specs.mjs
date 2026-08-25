#!/usr/bin/env node
/**
 * Refresh `openapi/*.json` from Hepsiburada's developer portal.
 *
 *   npm run specs:fetch                       # all products
 *   npm run specs:fetch -- listing order      # just these modules
 *
 * The portal renders from an unauthenticated public JSON API, which is where these documents
 * come from. Two things about it are worth knowing before you debug a failure here.
 *
 * The host sits behind Akamai Bot Manager, and the bot check keys off the TLS/HTTP2 handshake
 * rather than the headers: `curl` is refused with a 403 and an HTML page titled
 * "Hepsiburada | Güvenlik" no matter what `User-Agent` it claims, while Node's own fetch is
 * served normally. So this tool deliberately uses `fetch` and sends a browser-shaped header set.
 * If it starts returning 403, that is Akamai tightening, not the endpoint moving — check the URL
 * in a browser before rewriting anything.
 *
 * The version segment is not uniform: `listeleme` is published as `v1` and everything else as
 * `v1.0`. It is read from the manifest, never guessed.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SPEC_DIR = join(ROOT, 'openapi');
const MANIFEST = join(SPEC_DIR, 'manifest.json');

const url = (product) =>
  `https://developers.hepsiburada.com/api/v1/public/docs/hepsiburada/${product.slug}/${product.version}/openapi`;

/**
 * Headers a browser would send on this request.
 *
 * `sec-fetch-site: same-origin` and the referer matter: the portal fetches its own API, and a
 * request that does not look like it came from the page is likelier to be challenged.
 */
const HEADERS = {
  accept: 'application/json, text/plain, */*',
  'accept-language': 'tr-TR,tr;q=0.9,en;q=0.8',
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
  referer: 'https://developers.hepsiburada.com/tr/companies/hepsiburada',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin',
};

/** Operations in a document, counting methods rather than paths — some paths carry several. */
const METHODS = new Set(['get', 'post', 'put', 'delete', 'patch']);
function countOperations(spec) {
  return Object.values(spec.paths ?? {}).reduce(
    (total, item) => total + Object.keys(item).filter((key) => METHODS.has(key)).length,
    0
  );
}

/** The host a document declares, whichever dialect it is written in. */
function declaredServer(spec) {
  if (spec.servers?.[0]?.url) return spec.servers[0].url;
  const scheme = spec.schemes?.[0] ?? 'https';
  return `${scheme}://${spec.host ?? '?'}${spec.basePath && spec.basePath !== '/' ? spec.basePath : ''}`;
}

async function main() {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  const filter = new Set(process.argv.slice(2));
  const products = filter.size
    ? manifest.products.filter((p) => filter.has(p.module) || filter.has(p.slug))
    : manifest.products;

  if (!products.length) {
    console.error(`No product matched ${[...filter].join(', ')}.`);
    process.exit(1);
  }

  let changed = 0;
  let blocked = 0;

  for (const product of products) {
    const file = join(SPEC_DIR, `${product.module}.json`);
    let response;
    try {
      response = await fetch(url(product), { headers: HEADERS });
    } catch (cause) {
      console.error(`${product.module.padEnd(16)} network error: ${cause.message}`);
      process.exitCode = 1;
      continue;
    }

    const body = await response.text();

    if (!response.ok) {
      const isBotBlock = body.includes('Güvenlik') || body.includes('AkamaiGHost');
      console.error(
        `${product.module.padEnd(16)} HTTP ${response.status}` + (isBotBlock ? ' — refused by bot protection' : '')
      );
      if (isBotBlock) blocked++;
      process.exitCode = 1;
      continue;
    }

    let spec;
    try {
      spec = JSON.parse(body);
    } catch {
      console.error(`${product.module.padEnd(16)} response was not JSON (${body.length} bytes)`);
      process.exitCode = 1;
      continue;
    }

    if (!spec.paths || (!spec.openapi && !spec.swagger)) {
      console.error(`${product.module.padEnd(16)} not an OpenAPI document`);
      process.exitCode = 1;
      continue;
    }

    const formatted = JSON.stringify(spec, null, 2) + '\n';
    const before = existsSync(file) ? readFileSync(file, 'utf8') : null;
    const operations = countOperations(spec);
    const dialect = spec.openapi ? `OpenAPI ${spec.openapi}` : `Swagger ${spec.swagger}`;

    if (before === formatted) {
      console.log(`${product.module.padEnd(16)} unchanged  ${String(operations).padStart(2)} ops  ${dialect}`);
      continue;
    }

    writeFileSync(file, formatted);
    changed++;
    console.log(
      `${product.module.padEnd(16)} ${before === null ? 'new      ' : 'updated  '} ${String(operations).padStart(2)} ops  ${dialect}  ${declaredServer(spec)}`
    );

    if (product.operations !== undefined && product.operations !== operations) {
      console.log(
        `${''.padEnd(16)} ↳ manifest says ${product.operations} operations, the document has ${operations} — update manifest.json`
      );
    }
  }

  if (blocked) {
    console.error(
      `\n${blocked} request(s) were refused by bot protection. This tool uses Node's fetch precisely\n` +
        `because curl is refused and Node is not; if Node is now refused too, open the URL in a browser\n` +
        `and confirm the portal still serves it before changing this tool.`
    );
  }
  console.log(`\n${changed} spec(s) changed — run \`npm run generate\` and check the diff.`);
}

await main();
