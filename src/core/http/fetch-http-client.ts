import { HepsiburadaConnectionError, HepsiburadaTimeoutError } from '../errors/errors.js';
import type { HttpClient } from './http-client.js';
import type { HttpHeaders, HttpRequest, HttpResponse } from './types.js';

/** The subset of `fetch` this client depends on. */
export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export interface FetchHttpClientOptions {
  /** Custom fetch implementation — a polyfill, an instrumented wrapper, undici. */
  fetch?: FetchLike | undefined;
  /** Per-request timeout in milliseconds. `0` disables it. Default: 30000. */
  timeoutMs?: number | undefined;
}

/**
 * Default {@link HttpClient}, built on the platform `fetch`.
 *
 * Works unchanged on Node 18+, browsers, Deno, Bun and Cloudflare Workers: no Node built-ins, no
 * agent, no globals touched. Anything runtime-specific belongs in a different implementation of
 * the interface, not here.
 */
export class FetchHttpClient implements HttpClient {
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;

  constructor(options: FetchHttpClientOptions = {}) {
    const impl = options.fetch ?? (globalThis.fetch as FetchLike | undefined);
    if (!impl) {
      throw new Error(
        'No global fetch found. Use Node 18+, or pass a fetch implementation: new HepsiburadaClient({ fetch })'
      );
    }
    // Bound so browsers do not throw "Illegal invocation" when fetch loses `this`.
    this.fetchImpl = impl === globalThis.fetch ? impl.bind(globalThis) : impl;
    this.timeoutMs = options.timeoutMs ?? 30_000;
  }

  async send(request: HttpRequest): Promise<HttpResponse> {
    const controller = new AbortController();
    const abortOnCallerSignal = (): void => controller.abort(request.signal?.reason);
    let timedOut = false;

    const timer =
      this.timeoutMs > 0
        ? setTimeout(() => {
            timedOut = true;
            controller.abort();
          }, this.timeoutMs)
        : undefined;

    if (request.signal) {
      if (request.signal.aborted) controller.abort(request.signal.reason);
      else request.signal.addEventListener('abort', abortOnCallerSignal, { once: true });
    }

    try {
      const init: RequestInit = {
        method: request.method,
        headers: request.headers,
        signal: controller.signal,
      };
      if (request.body !== undefined) init.body = request.body;

      const response = await this.fetchImpl(request.url, init);

      return {
        status: response.status,
        statusText: response.statusText,
        headers: readHeaders(response.headers),
        body: await response.text(),
        raw: response,
      };
    } catch (cause) {
      throw this.toTransportError(request, cause, timedOut);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      request.signal?.removeEventListener('abort', abortOnCallerSignal);
    }
  }

  private toTransportError(request: HttpRequest, cause: unknown, timedOut: boolean): Error {
    const context = {
      operationId: request.context.operationId,
      module: request.context.module,
      method: request.method,
      url: request.url,
    };

    if (timedOut) {
      return new HepsiburadaTimeoutError(
        `${request.context.operationId} timed out after ${this.timeoutMs}ms`,
        context,
        { cause }
      );
    }
    if (request.signal?.aborted) {
      return new HepsiburadaTimeoutError(`${request.context.operationId} was aborted by the caller`, context, { cause });
    }
    const detail = cause instanceof Error ? cause.message : String(cause);
    return new HepsiburadaConnectionError(
      `${request.context.operationId} could not reach Hepsiburada: ${detail}`,
      context,
      { cause }
    );
  }
}

/** Normalise header names to lower case so lookups never depend on casing. */
function readHeaders(headers: Headers): HttpHeaders {
  const result: HttpHeaders = {};
  headers.forEach((value, key) => {
    result[key.toLowerCase()] = value;
  });
  return result;
}
