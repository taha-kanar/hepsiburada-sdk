import type { OperationRequest, Transport } from '../transport.js';
import type { HttpHeaders } from '../http/types.js';

/** Per-call options every resource method accepts. */
export interface RequestOptions {
  /** Abort this call. Also honoured by the default HTTP client's timeout. */
  signal?: AbortSignal;
  /** Extra headers, merged over the defaults. */
  headers?: HttpHeaders;
  /** Values forwarded to middleware through `request.context.meta`. */
  meta?: Record<string, unknown>;
}

/**
 * Base class for the twelve resource classes.
 *
 * Holds the transport and the merchant id — which every Hepsiburada path carries as a segment,
 * so no caller should have to pass it per call.
 */
export abstract class BaseResource {
  constructor(
    protected readonly transport: Transport,
    protected readonly merchantId: string
  ) {}

  /**
   * Copy the caller's options onto an operation without introducing `undefined` values.
   *
   * `exactOptionalPropertyTypes` distinguishes "absent" from "present and undefined", so
   * spreading the options object directly would not type-check.
   */
  protected options(options: RequestOptions = {}): Partial<Pick<OperationRequest, 'signal' | 'headers' | 'meta'>> {
    const forwarded: Partial<Pick<OperationRequest, 'signal' | 'headers' | 'meta'>> = {};
    if (options.signal) forwarded.signal = options.signal;
    if (options.headers) forwarded.headers = options.headers;
    if (options.meta) forwarded.meta = options.meta;
    return forwarded;
  }
}
