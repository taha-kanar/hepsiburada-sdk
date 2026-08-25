import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { testClient } from './helpers.js';

const GENERATED = readFileSync(new URL('../src/generated/order.ts', import.meta.url).pathname, 'utf8');

/**
 * The tracking feeds return PascalCase, and the types say so.
 *
 * `/packages/{shipped,delivered,undelivered}` answer with a minimal shipment summary whose keys
 * are capitalised — `Id`, `OrderNumber`, `Barcode`, `PackageNumber` — while every detail endpoint
 * on the same host is camelCase. Normalising it would be a kindness that hides a real difference;
 * assuming camelCase instead once collapsed 58 package records into one empty-keyed row.
 */
describe('the PascalCase tracking feeds', () => {
  it.each(['Barcode', 'DeliveredDate', 'EtgbNo', 'Id', 'MerchantId', 'OrderNumber', 'PackageNumber'])(
    'types %s as the service spells it',
    (field) => {
      const block = GENERATED.slice(GENERATED.indexOf('export interface DeliveredDeliveriesRepresentation {'));
      expect(block.slice(0, block.indexOf('\n}'))).toContain(`${field}?:`);
    }
  );

  it('keeps the envelope around them lower case, because that is what the service sends', () => {
    const block = GENERATED.slice(GENERATED.indexOf('export interface DeliveredDeliveriesRepresentationWithPaging {'));
    const body = block.slice(0, block.indexOf('\n}'));

    expect(body).toContain('items?:');
    expect(body).toContain('totalCount?:');
  });

  it('decodes a real tracking page without renaming anything', async () => {
    const { client } = testClient({
      body: { items: [{ Id: 'p1', PackageNumber: 'PK-1', Barcode: 'BC-1' }], totalCount: 1, limit: 50, offset: 0 },
    });

    const page = await client.orders.listDeliveredPackages();

    expect(page.items?.[0]).toEqual({ Id: 'p1', PackageNumber: 'PK-1', Barcode: 'BC-1' });
  });
});

/**
 * No feed here is a snapshot.
 *
 * A line item that has been packed leaves `list()` and appears under `listPackages()`. Treating
 * any one feed as the complete picture and reconciling against it deletes real data — the mistake
 * that once stripped line items from 67 of 69 orders. The SDK cannot prevent it, so it documents
 * it where a reader will hit it, and this test keeps that documentation from being dropped.
 */
describe('partial-feed semantics', () => {
  const source = readFileSync(new URL('../src/resources/orders.resource.ts', import.meta.url).pathname, 'utf8');

  it('warns, in the class doc, that a feed is not a snapshot', () => {
    expect(source).toMatch(/No feed here is a snapshot/i);
    expect(source).toMatch(/Merge, never replace/i);
  });

  it('says which of the feeds honours a date filter', () => {
    expect(source).toMatch(/only operation in this product that honours `begindate`/i);
  });
});

describe('the date filter, end to end', () => {
  it('sends one on the endpoint that accepts it', async () => {
    const { client, http } = testClient({ body: { items: [] } });

    await client.orders.list({ begindate: new Date('2026-08-25T09:00:00Z'), limit: 10 });

    expect(http.query.get('begindate')).toBe('2026-08-25 12:00');
    expect(http.query.get('limit')).toBe('10');
  });

  it('offers no way to send one on the four that reject it', async () => {
    const { client, http } = testClient({ body: { items: [] } });

    // `begindate` is not in PageWindow, so this does not compile without the cast — and even with
    // it, the resource never forwards the field.
    await client.orders.listCancelled({ begindate: new Date() } as never);

    expect(http.query.has('begindate')).toBe(false);
  });
});
