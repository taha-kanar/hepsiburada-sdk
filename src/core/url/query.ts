/** Values a query parameter may hold before serialisation. */
export type QueryValue = string | number | boolean | Date | null | undefined | ReadonlyArray<string | number | boolean>;
export type QueryParams = Record<string, QueryValue>;

/**
 * How array-valued query parameters are encoded.
 *
 * - `comma` — `?skuList=a,b,c`, which is what the listing service's `skuList` expects
 * - `repeat` — `?skuList=a&skuList=b`, the OpenAPI default, kept as an escape hatch
 */
export type ArrayFormat = 'comma' | 'repeat';

function encodeScalar(value: string | number | boolean | Date): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

/**
 * Serialise query parameters, dropping `undefined` and `null` entries.
 *
 * Dropping empties is not a tidiness preference. Several Hepsiburada endpoints reject a blank
 * filter outright, and — worse — the order endpoints accept a date they cannot parse and return
 * an empty page rather than an error, so a parameter that should not be sent must not be sent.
 */
export function serializeQuery(params: QueryParams = {}, arrayFormat: ArrayFormat = 'comma'): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;

    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      if (arrayFormat === 'comma') {
        search.append(key, value.map(encodeScalar).join(','));
      } else {
        for (const item of value) search.append(key, encodeScalar(item));
      }
      continue;
    }

    search.append(key, encodeScalar(value as string | number | boolean | Date));
  }

  return search.toString();
}
