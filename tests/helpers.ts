import { HepsiburadaClient, type HepsiburadaClientOptions } from '../src/index.js';
import type { HttpClient, HttpRequest, HttpResponse } from '../src/core/http/index.js';

/** A response the stub client should return, described as loosely as a test needs. */
export interface StubResponse {
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  /** Objects are JSON-encoded; strings are sent verbatim. */
  body?: unknown;
}

/**
 * An {@link HttpClient} that records what it was asked and answers from a script.
 *
 * The whole point of the transport taking an `HttpClient` rather than calling `fetch` directly:
 * every test below asserts on the request that *would* have gone out, without a network.
 */
export class StubHttpClient implements HttpClient {
  readonly requests: HttpRequest[] = [];
  private readonly script: StubResponse[];

  constructor(script: StubResponse | StubResponse[] = {}) {
    this.script = Array.isArray(script) ? [...script] : [script];
  }

  /** The single request made, for the common case of a test that makes one. */
  get last(): HttpRequest {
    const request = this.requests.at(-1);
    if (!request) throw new Error('StubHttpClient: no request was made');
    return request;
  }

  /** Parsed query string of the last request. */
  get query(): URLSearchParams {
    return new URL(this.last.url).searchParams;
  }

  async send(request: HttpRequest): Promise<HttpResponse> {
    this.requests.push(request);
    const next = this.script.length > 1 ? this.script.shift()! : (this.script[0] ?? {});

    const body = typeof next.body === 'string' ? next.body : next.body === undefined ? '' : JSON.stringify(next.body);
    const headers = { 'content-type': 'application/json', ...(next.headers ?? {}) };

    return {
      status: next.status ?? 200,
      statusText: next.statusText ?? 'OK',
      headers,
      body,
    };
  }
}

export const MERCHANT_ID = '00000000-0000-4000-8000-000000000001';

/** A client wired to a stub, with credentials that are obviously fake. */
export function testClient(
  script: StubResponse | StubResponse[] = {},
  options: Partial<HepsiburadaClientOptions> = {}
): { client: HepsiburadaClient; http: StubHttpClient } {
  const http = new StubHttpClient(script);
  const client = new HepsiburadaClient({
    merchantId: MERCHANT_ID,
    password: 'test-service-key',
    userAgent: 'testintegrator_dev',
    httpClient: http,
    ...options,
  });
  return { client, http };
}
