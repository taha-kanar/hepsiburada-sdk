import type { QueryParams } from './url/query.js';

/**
 * How one Hepsiburada product asks for a slice, and where it puts the rows.
 *
 * There is no single answer, which is why this is data rather than a convention. Across the
 * twelve published products there are **six** request dialects and **three** response envelopes,
 * because the products were built by different teams in different languages:
 *
 * | Product            | Request                   | Rows              |
 * |--------------------|---------------------------|-------------------|
 * | catalog            | `page`/`size`, 0-based    | `data`            |
 * | product-update     | `page`/`size`, 0-based    | `data`            |
 * | listing            | `offset`/`limit`          | `listings`        |
 * | order (OMS)        | `offset`/`limit`          | `items`           |
 * | claim-list         | `offset`/`limit`          | `items`           |
 * | finance            | `Offset`/`Limit`          | `items`           |
 * | question           | `page`/`size`, **1-based**| `data`            |
 * | promotion          | `page`/`pagesize`         | `data`            |
 *
 * Two of those rows are traps rather than variations. `finance` capitalises both parameter names
 * while OMS capitalises neither — send `offset` to finance and it silently returns page one
 * forever. And `question` counts pages from 1 while `catalog` counts from 0, so the same
 * "page 0" means the first page in one product and an error in the other.
 *
 * The generator writes these descriptors from each spec's own parameter names, so none of it is
 * inferred and a rename shows up as a diff.
 */
export type PaginationDescriptor = {
  readonly request: PageRequest | OffsetRequest;
  readonly response: PaginationEnvelope;
};

/** Page-number paging. `firstPage` is 0 for the catalog services and 1 for questions. */
export interface PageRequest {
  readonly style: 'page';
  readonly pageParam: string;
  readonly sizeParam: string;
  readonly firstPage: 0 | 1;
}

/** Offset paging. The parameter names carry their own casing — see the table above. */
export interface OffsetRequest {
  readonly style: 'offset';
  readonly offsetParam: string;
  readonly limitParam: string;
}

/** Where a response keeps its rows and its totals. */
export interface PaginationEnvelope {
  /** Property holding the rows: `data`, `listings` or `items`. */
  readonly items: string;
  /** Property holding the total row count, when the product reports one. */
  readonly total?: string;
  /** Property holding the total page count, when the product reports one. */
  readonly pageCount?: string;
}

/** One decoded page, normalised across all three envelopes. */
export interface Page<T> {
  readonly items: T[];
  readonly total: number | undefined;
  readonly pageCount: number | undefined;
  /** Zero-based index of this page within the walk, regardless of the product's own numbering. */
  readonly index: number;
  /** The raw response, for the fields this normalisation drops. */
  readonly raw: unknown;
}

/** Query parameters selecting the `index`-th page (0-based) of `size` rows. */
export function pageQuery(descriptor: PaginationDescriptor, index: number, size: number): QueryParams {
  const { request } = descriptor;
  if (request.style === 'page') {
    return { [request.pageParam]: index + request.firstPage, [request.sizeParam]: size };
  }
  return { [request.offsetParam]: index * size, [request.limitParam]: size };
}

/**
 * Follow a descriptor key into a body.
 *
 * Keys are usually a single property name, but `diskonto-external` nests its rows a level down —
 * `Data.Items` — so a dotted path is resolved rather than looked up whole.
 */
function at(body: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((node, key) => {
    if (!node || typeof node !== 'object') return undefined;
    return (node as Record<string, unknown>)[key];
  }, body);
}

/** Pull the rows and totals out of a response, whichever envelope it uses. */
export function readPage<T>(descriptor: PaginationDescriptor, body: unknown, index: number): Page<T> {
  const { items, total, pageCount } = descriptor.response;

  // A few endpoints answer with a bare array rather than an envelope — `/packages` unfiltered is
  // the documented example. Treat that as a single complete page rather than as an empty one.
  const rows = Array.isArray(body) ? (body as T[]) : ((at(body, items) as T[] | undefined) ?? []);

  return {
    items: rows,
    total: total !== undefined ? asNumber(at(body, total)) : undefined,
    pageCount: pageCount !== undefined ? asNumber(at(body, pageCount)) : undefined,
    index,
    raw: body,
  };
}

function asNumber(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export interface PaginateOptions {
  /** Rows per request. Defaults to the product's own documented default. */
  size?: number;
  /** Stop after this many pages. Guards against a total the API reports wrongly. */
  maxPages?: number;
}

/**
 * Walk every page of a listing endpoint.
 *
 * Stops on the first short or empty page rather than trusting the reported total, because not
 * every Hepsiburada endpoint reports one and at least one (`listing`) omits `pageCount`
 * entirely. `maxPages` is the backstop for an endpoint that never returns a short page.
 *
 * ```ts
 * for await (const page of paginate(descriptor, (q) => client.orders.list({ ...q }))) {
 *   for (const line of page.items) process(line);
 * }
 * ```
 */
export async function* paginate<T>(
  descriptor: PaginationDescriptor,
  fetchPage: (query: QueryParams) => Promise<unknown>,
  options: PaginateOptions = {}
): AsyncGenerator<Page<T>, void, undefined> {
  const size = options.size ?? 100;
  const maxPages = options.maxPages ?? Number.POSITIVE_INFINITY;

  for (let index = 0; index < maxPages; index++) {
    const body = await fetchPage(pageQuery(descriptor, index, size));
    const page = readPage<T>(descriptor, body, index);

    yield page;

    if (page.items.length < size) return;
    if (page.pageCount !== undefined && index + 1 >= page.pageCount) return;
  }
}
