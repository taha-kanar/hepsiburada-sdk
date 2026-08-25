import type { HttpRequest, HttpResponse } from '../http/types.js';

/** Hands the request to the next middleware, ending at the {@link HttpClient}. */
export type Next = (request: HttpRequest) => Promise<HttpResponse>;

/**
 * A step in the request pipeline.
 *
 * This is the extension point: retries, logging, metrics, caching and rate limiting are all
 * "add a middleware", never "edit the transport". The first entry is outermost.
 */
export interface Middleware {
  /** Shown in debug logs. Keep it short, e.g. `retry`. */
  readonly name: string;
  handle(request: HttpRequest, next: Next): Promise<HttpResponse>;
}
