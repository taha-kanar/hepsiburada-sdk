import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REJECTS_DATE_FILTER } from '../src/index.js';

const ROOT = new URL('..', import.meta.url).pathname;

interface Operation {
  module: string;
  operationId: string;
  method: string;
  path: string;
}

/** Every operation the twelve published documents describe. */
const published = JSON.parse(readFileSync(join(ROOT, 'openapi/operations.json'), 'utf8')) as Operation[];

/**
 * Every operation the resource layer actually calls.
 *
 * Read out of the source rather than by walking the client, because a method that exists is not
 * evidence a method is reachable: this catches a resource class that was written and never wired
 * into {@link HepsiburadaClient}, which a runtime walk over `client.orders` would not.
 *
 * It is also the reason the resources are hand-written while the types are generated. A generated
 * resource layer would make this test tautological — it would only prove the generator ran.
 */
function implemented(): Operation[] {
  const directory = join(ROOT, 'src/resources');
  const found: Operation[] = [];

  for (const file of readdirSync(directory).filter((name) => name.endsWith('.resource.ts'))) {
    const source = readFileSync(join(directory, file), 'utf8');

    // Most resources name their product `MODULE`; `claims.resource.ts` spans two of them and so
    // declares `LIST` and `CREATE`. Resolve whatever the file called it.
    const constants = new Map(
      [...source.matchAll(/^const (\w+) = '([^']+)';$/gm)].map((match) => [match[1]!, match[2]!])
    );

    for (const match of source.matchAll(
      /operationId:\s*'([^']+)',\s*\n\s*module:\s*(\w+|'[^']+'),\s*\n\s*method:\s*'([^']+)',\s*\n\s*path:\s*'([^']+)'/g
    )) {
      const reference = match[2]!;
      const declared = reference.startsWith("'") ? reference.slice(1, -1) : constants.get(reference);
      expect(declared, `${file} references an unknown module constant ${reference}`).toBeDefined();
      found.push({ module: declared!, operationId: match[1]!, method: match[3]!, path: match[4]! });
    }
  }
  return found;
}

const key = (op: Operation): string => `${op.module}.${op.operationId}`;

describe('spec coverage', () => {
  const covered = implemented();
  const byKey = new Map(covered.map((op) => [key(op), op]));

  it('finds every resource method the grep expects', () => {
    // A guard on the guard: if the resource files are reformatted so the regex stops matching,
    // this fails loudly instead of silently reporting perfect coverage of nothing.
    expect(covered.length).toBe(published.length);
  });

  it('implements every published operation', () => {
    const missing = published.filter((op) => !byKey.has(key(op))).map(key);

    expect(missing).toEqual([]);
  });

  it('implements nothing the documents do not describe', () => {
    const publishedKeys = new Set(published.map(key));
    const extra = covered.filter((op) => !publishedKeys.has(key(op))).map(key);

    expect(extra).toEqual([]);
  });

  it('calls each one with the method and path the document gives', () => {
    const wrong = published
      .map((op) => ({ op, found: byKey.get(key(op)) }))
      .filter(({ op, found }) => found && (found.method !== op.method || found.path !== op.path))
      .map(({ op, found }) => `${key(op)}: ${found!.method} ${found!.path} ≠ ${op.method} ${op.path}`);

    expect(wrong).toEqual([]);
  });

  it('covers all twelve products', () => {
    expect(new Set(covered.map((op) => op.module)).size).toBe(12);
  });
});

/**
 * Path casing is copied from each document and never normalised.
 *
 * It is tempting to pick one spelling, and it would break the SDK. `oms-external` and
 * `listing-external` spell the segment `/merchantid/` — all lower case — and `listing-external`
 * answers `/merchantId/` with a 400. But `claim-list` and `test-order` spell their own segment
 * `/merchantId/`, with a capital I, in their own published documents. There is no house style to
 * apply; there are twelve documents, and the only safe rule is to copy each one verbatim.
 */
describe('path casing', () => {
  const covered = implemented();

  it('uses lower case on the two hosts where a capital I is refused', () => {
    const wrong = covered
      .filter((op) => (op.module === 'order' || op.module === 'listing') && /\/merchantId\//.test(op.path))
      .map((op) => `${key(op)} ${op.path}`);

    expect(wrong).toEqual([]);
  });

  it('keeps the capital I where the document uses one', () => {
    // Not an oversight to fix — `claim-list` really does publish it this way.
    expect(covered.find((op) => op.operationId === 'getClaims')?.path).toBe('/claims/merchantId/{merchantId}');
  });

  it('keeps the placeholder name camelCase, which is only a variable', () => {
    // `{merchantId}` inside `/merchantid/` looks wrong and is correct: the segment is the wire
    // format, the braces are ours.
    expect(covered.find((op) => op.operationId === 'getOrders')?.path).toBe('/orders/merchantid/{merchantId}');
  });
});

/**
 * Four OMS endpoints declare `begindate`/`enddate` and answer 400 WrongDateFormat for every value
 * ever tried. The generated blocklist records them, and the resource layer types the parameters
 * away rather than offering a filter that cannot work.
 */
describe('the endpoints that reject a date filter', () => {
  const source = readFileSync(join(ROOT, 'src/resources/orders.resource.ts'), 'utf8');

  it('lists exactly the four found in production', () => {
    expect([...REJECTS_DATE_FILTER].sort()).toEqual([
      'order.getOrdersCancelled',
      'order.getPackagesDelivered',
      'order.getPackagesShipped',
      'order.getPackagesUndelivered',
    ]);
  });

  it.each([...REJECTS_DATE_FILTER])('%s takes a PageWindow, not a DateWindow', (entry) => {
    const operationId = entry.split('.')[1]!;
    // The method whose body declares this operationId — find its signature above it.
    const index = source.indexOf(`operationId: '${operationId}'`);
    expect(index, `${operationId} is not implemented`).toBeGreaterThan(-1);

    const signature = source.slice(0, index).split('\n').reverse().find((line) => /^\s{2}\w+\(/.test(line));
    const declaration = source.slice(source.indexOf(signature!), index);

    expect(declaration, operationId).not.toMatch(/DateWindow/);
    expect(declaration, operationId).toMatch(/PageWindow/);
  });
});
