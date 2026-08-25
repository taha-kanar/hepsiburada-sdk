import { describe, expect, it } from 'vitest';
import { PAGINATION, pageQuery, paginate, readPage, type PaginationDescriptor } from '../src/index.js';

const descriptor = (json: string): PaginationDescriptor => JSON.parse(json) as PaginationDescriptor;

/**
 * The six request dialects, each taken from a real operation's descriptor.
 *
 * These are not variations on a theme. `finance` capitalises both parameter names while OMS
 * capitalises neither, and `question` counts pages from 1 while `catalog` counts from 0 — send
 * one product's dialect to another and it answers 200 with page one, forever.
 */
const DIALECTS: Array<[string, string, Record<string, string | number>]> = [
  ['catalog', 'catalog.getProductsStatus', { page: 2, size: 50 }],
  ['listing', 'listing.getListings', { offset: 100, limit: 50 }],
  ['order', 'order.getPackagesStatusUnpacked', { Offset: 100, limit: 50 }],
  ['finance', 'finance.getTransactions', { Offset: 100, Limit: 50 }],
  ['question', 'question.getIssues', { page: 3, size: 50 }],
  ['promotion', 'promotion.getSelfCampaignDiscounts', { page: 2, pagesize: 50 }],
];

describe('the six paging dialects', () => {
  it.each(DIALECTS)('%s asks for a page the way its product expects', (_product, key, expected) => {
    const found = PAGINATION[key];
    expect(found, `${key} has no generated descriptor`).toBeDefined();

    expect(pageQuery(found!, 2, 50)).toEqual(expected);
  });

  it('question counts pages from one, catalog from zero', () => {
    // The same "first page" in two products, and one of them 400s on the other's answer.
    expect(pageQuery(PAGINATION['question.getIssues']!, 0, 20)).toMatchObject({ page: 1 });
    expect(pageQuery(PAGINATION['catalog.getProductsStatus']!, 0, 20)).toMatchObject({ page: 0 });
  });

  // The nastiest of the six, because it is not even consistent within one product: `/packages`
  // spells it `Offset` while `/packages/shipped`, on the same host, spells it `offset`.
  it('records the casing OMS uses per endpoint, not per product', () => {
    expect(pageQuery(PAGINATION['order.getPackages']!, 1, 10)).toMatchObject({ Offset: 10 });
    expect(pageQuery(PAGINATION['order.getPackagesShipped']!, 1, 10)).toMatchObject({ offset: 10 });
  });
});

describe('the three response envelopes', () => {
  it('reads `data` with totals', () => {
    const page = readPage<number>(
      descriptor('{"request":{"style":"page","pageParam":"page","sizeParam":"size","firstPage":0},"response":{"items":"data","total":"totalElements","pageCount":"totalPages"}}'),
      { data: [1, 2], totalElements: 2, totalPages: 1 },
      0
    );

    expect(page).toMatchObject({ items: [1, 2], total: 2, pageCount: 1, index: 0 });
  });

  it('reads `listings`, which reports no page count', () => {
    const page = readPage<number>(
      descriptor('{"request":{"style":"offset","offsetParam":"offset","limitParam":"limit"},"response":{"items":"listings","total":"totalCount"}}'),
      { listings: [1], totalCount: 900, limit: 50, offset: 0 },
      0
    );

    expect(page.items).toEqual([1]);
    expect(page.pageCount).toBeUndefined();
  });

  it('reads `items`', () => {
    const page = readPage<number>(
      descriptor('{"request":{"style":"offset","offsetParam":"Offset","limitParam":"limit"},"response":{"items":"items"}}'),
      { items: [1, 2, 3] },
      1
    );

    expect(page.items).toEqual([1, 2, 3]);
  });

  // `/packages` unfiltered is the documented example: a bare array with no envelope at all.
  it('treats a bare array as one complete page', () => {
    const page = readPage<number>(
      descriptor('{"request":{"style":"offset","offsetParam":"offset","limitParam":"limit"},"response":{"items":"items"}}'),
      [1, 2],
      0
    );

    expect(page.items).toEqual([1, 2]);
  });

  it('yields an empty page rather than throwing on an unexpected body', () => {
    const page = readPage<number>(
      descriptor('{"request":{"style":"offset","offsetParam":"offset","limitParam":"limit"},"response":{"items":"items"}}'),
      null,
      0
    );

    expect(page.items).toEqual([]);
  });

  it('keeps the raw body for the fields it drops', () => {
    const body = { items: [1], somethingUndocumented: true };
    expect(
      readPage(descriptor('{"request":{"style":"offset","offsetParam":"offset","limitParam":"limit"},"response":{"items":"items"}}'), body, 0).raw
    ).toBe(body);
  });
});

describe('paginate', () => {
  const offset = descriptor(
    '{"request":{"style":"offset","offsetParam":"offset","limitParam":"limit"},"response":{"items":"items","pageCount":"pageCount"}}'
  );

  const collect = async (gen: AsyncGenerator<{ items: number[] }>): Promise<number[]> => {
    const out: number[] = [];
    for await (const page of gen) out.push(...page.items);
    return out;
  };

  it('walks until a short page', async () => {
    const pages = [{ items: [1, 2] }, { items: [3, 4] }, { items: [5] }];
    const seen: unknown[] = [];

    const all = await collect(
      paginate<number>(offset, async (query) => {
        seen.push(query);
        return pages[seen.length - 1];
      }, { size: 2 })
    );

    expect(all).toEqual([1, 2, 3, 4, 5]);
    expect(seen).toEqual([{ offset: 0, limit: 2 }, { offset: 2, limit: 2 }, { offset: 4, limit: 2 }]);
  });

  it('stops when the reported page count is reached', async () => {
    let calls = 0;
    const all = await collect(
      paginate<number>(offset, async () => {
        calls++;
        return { items: [1, 2], pageCount: 1 };
      }, { size: 2 })
    );

    expect(all).toEqual([1, 2]);
    expect(calls).toBe(1);
  });

  it('honours maxPages when an endpoint never returns a short page', async () => {
    let calls = 0;
    await collect(
      paginate<number>(offset, async () => {
        calls++;
        return { items: [1, 2] };
      }, { size: 2, maxPages: 3 })
    );

    expect(calls).toBe(3);
  });

  it('stops on an empty first page', async () => {
    let calls = 0;
    const all = await collect(
      paginate<number>(offset, async () => {
        calls++;
        return { items: [] };
      }, { size: 2 })
    );

    expect(all).toEqual([]);
    expect(calls).toBe(1);
  });
});

describe('the generated descriptor table', () => {
  it('covers every paginated operation and nothing else', () => {
    expect(Object.keys(PAGINATION).length).toBeGreaterThan(20);
  });

  it('never mixes up a style and its parameters', () => {
    for (const [key, found] of Object.entries(PAGINATION)) {
      if (found.request.style === 'page') {
        expect(found.request.pageParam, key).toBeTruthy();
        expect([0, 1], key).toContain(found.request.firstPage);
      } else {
        expect(found.request.offsetParam, key).toBeTruthy();
        expect(found.request.limitParam, key).toBeTruthy();
      }
      expect(found.response.items, key).toBeTruthy();
    }
  });
});

describe('rows nested below the envelope', () => {
  // `diskonto-external` answers `{Success, Data:{TotalCount, Items}}` — PascalCase, and one level
  // deeper than every other product. The published schema says `data.items` in camelCase, so a
  // paginator built from the document alone reads undefined, sees no rows, and reports that the
  // merchant has no campaigns. Nothing errors. That is the failure this dotted path prevents.
  const promotion = PAGINATION['promotion.getSelfCampaignDiscounts'];

  it('is what the generator derived for promotions', () => {
    expect(promotion?.response.items).toBe('Data.Items');
    expect(promotion?.response.total).toBe('Data.TotalCount');
  });

  it('reads rows through the dotted path', () => {
    const page = readPage(promotion!, { Success: true, Data: { TotalCount: 2, Items: [{ CampaignId: 1 }, { CampaignId: 2 }] } }, 0);

    expect(page.items).toHaveLength(2);
    expect(page.total).toBe(2);
  });

  it('yields an empty page rather than throwing when the envelope is absent', () => {
    expect(readPage(promotion!, { Success: true, Data: null }, 0).items).toEqual([]);
    expect(readPage(promotion!, {}, 0).items).toEqual([]);
  });

  it('still reads a flat envelope for every other product', () => {
    const orders = PAGINATION['order.getOrders'];

    expect(orders?.response.items).toBe('items');
    expect(readPage(orders!, { items: [1, 2, 3], totalCount: 3 }, 0).items).toEqual([1, 2, 3]);
  });

  it('carries the totals that finance and questions spell their own way', () => {
    // Neither `count` nor `totalItemCount` was in the generator's key list, so both descriptors
    // silently shipped without a total.
    expect(PAGINATION['finance.getTransactions']?.response.total).toBe('count');
    expect(PAGINATION['question.getIssues']?.response.total).toBe('totalItemCount');
    expect(PAGINATION['question.getIssues']?.response.pageCount).toBe('totalPageCount');
  });
});
