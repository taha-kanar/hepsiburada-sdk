import { HepsiburadaError } from '../errors/errors.js';

/** Values allowed in a path template. */
export type PathParams = Record<string, string | number | undefined>;

/**
 * Expand `{placeholders}` in a path template.
 *
 * Templates are copied verbatim from the specs, casing included. That matters more here than it
 * looks. `oms-external` and `listing-external` spell the segment `merchantid`, all lower case,
 * and while OMS tolerates `merchantId`, the listing service answers it with a 400 — but
 * `claim-list` and `test-order` spell their own segment `merchantId`, with a capital I, in their
 * own documents. There is no house style to normalise towards. Copying each template as published
 * is what keeps twelve independently-authored products working from one code path.
 *
 * @throws {HepsiburadaError} when a placeholder has no value — a missing id must fail here
 *   rather than produce a request against `/merchantid/undefined`.
 */
export function expandPath(template: string, params: PathParams = {}, operationId = 'unknown', module = 'unknown'): string {
  return template.replace(/\{([^}]+)\}/g, (_match, name: string) => {
    const value = params[name];
    if (value === undefined || value === null || value === '') {
      throw new HepsiburadaError(`Missing path parameter "${name}" for ${operationId} (${template})`, {
        operationId,
        module,
        method: 'UNKNOWN',
        url: template,
      });
    }
    return encodeURIComponent(String(value));
  });
}

/** Join a base URL and a path without doubling or dropping the separator. */
export function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}
