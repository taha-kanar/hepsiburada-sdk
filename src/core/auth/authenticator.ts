import type { HttpRequest } from '../http/types.js';

/**
 * Adds credentials to an outgoing request.
 *
 * Hepsiburada uses HTTP Basic plus a mandatory `User-Agent`. Keeping it behind an interface means
 * a future scheme is a new class rather than an edit to the transport.
 */
export interface Authenticator {
  authenticate(request: HttpRequest): HttpRequest | Promise<HttpRequest>;
}
