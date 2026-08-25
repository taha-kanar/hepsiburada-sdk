import type { HttpRequest, HttpResponse } from './types.js';

/**
 * The single seam between the SDK and the outside world.
 *
 * Everything above this interface (resources, transport, errors) is pure logic and can be
 * unit-tested by substituting an implementation — no network, no global patching. See
 * `FetchHttpClient` for the default and `tests/support/mock-http-client.ts` for the test double.
 */
export interface HttpClient {
  /**
   * Perform the request and buffer the response.
   *
   * Implementations must throw only for transport-level failures (DNS, TLS, connection reset,
   * abort). Any HTTP status — 4xx and 5xx included — is a successful `send` and must be returned
   * as an {@link HttpResponse}; turning statuses into errors is the transport's job, not the
   * client's.
   */
  send(request: HttpRequest): Promise<HttpResponse>;
}
