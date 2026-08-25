import type { HttpRequest, HttpResponse } from '../http/types.js';
import type { Middleware, Next } from './types.js';

export interface RateLimitMiddlewareOptions {
  /**
   * Requests allowed per minute across the whole client. Default 180.
   *
   * Hepsiburada documents "180 istek/1 dakika, her bir IP başına" — a per-IP budget, so several
   * clients behind one address share it and this default is a ceiling, not a guarantee.
   */
  perMinute?: number;
  /**
   * Concurrent upload jobs allowed. Default 5.
   *
   * The listing service refuses a sixth in-flight upload with a message rather than a 429:
   * "There are too many ongoing/waiting inventory uploads at the moment." Queueing locally is the
   * only way to avoid it, since there is nothing to retry against.
   */
  maxConcurrentUploads?: number;
  /** Operations counted against the upload limit. Defaults to every `*-uploads` submit. */
  isUpload?: (request: HttpRequest) => boolean;
  /** Injected for tests. */
  now?: () => number;
  /** Injected for tests. */
  sleep?: (ms: number) => Promise<void>;
}

const defaultIsUpload = (request: HttpRequest): boolean =>
  request.method === 'POST' && /-uploads$/.test(new URL(request.url).pathname);

/**
 * Keeps a bulk sync inside Hepsiburada's published limits.
 *
 * Two independent constraints, because Hepsiburada enforces two:
 *
 * - a rolling per-minute request budget, which yields a 429 when exceeded;
 * - a cap on concurrent listing upload jobs, which does *not* yield a 429 — it returns a message
 *   inside an otherwise successful response, so nothing downstream would recognise it as a
 *   failure worth retrying. Waiting for a slot is the only reliable fix.
 *
 * Opt-in rather than default: a client issuing a handful of calls should not pay for a scheduler,
 * and a caller running their own queue should not have two.
 */
export class RateLimitMiddleware implements Middleware {
  readonly name = 'rate-limit';

  private readonly perMinute: number;
  private readonly maxConcurrentUploads: number;
  private readonly isUpload: (request: HttpRequest) => boolean;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;

  /** Completion timestamps of recent requests, oldest first. */
  private readonly recent: number[] = [];
  private uploadsInFlight = 0;
  /** Resolvers waiting for an upload slot, released in arrival order. */
  private readonly uploadQueue: Array<() => void> = [];

  constructor(options: RateLimitMiddlewareOptions = {}) {
    this.perMinute = options.perMinute ?? 180;
    this.maxConcurrentUploads = options.maxConcurrentUploads ?? 5;
    this.isUpload = options.isUpload ?? defaultIsUpload;
    this.now = options.now ?? ((): number => Date.now());
    this.sleep = options.sleep ?? ((ms): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  async handle(request: HttpRequest, next: Next): Promise<HttpResponse> {
    const upload = this.isUpload(request);
    if (upload) await this.acquireUploadSlot();

    try {
      await this.acquireRequestSlot();
      return await next(request);
    } finally {
      if (upload) this.releaseUploadSlot();
    }
  }

  /** Wait until the rolling minute has room, then record this request. */
  private async acquireRequestSlot(): Promise<void> {
    for (;;) {
      const cutoff = this.now() - 60_000;
      while (this.recent.length && this.recent[0]! <= cutoff) this.recent.shift();

      if (this.recent.length < this.perMinute) {
        this.recent.push(this.now());
        return;
      }
      // The oldest request leaves the window at `recent[0] + 60s`; wait exactly that long.
      await this.sleep(Math.max(1, this.recent[0]! + 60_000 - this.now()));
    }
  }

  private async acquireUploadSlot(): Promise<void> {
    if (this.uploadsInFlight < this.maxConcurrentUploads) {
      this.uploadsInFlight++;
      return;
    }
    await new Promise<void>((resolve) => this.uploadQueue.push(resolve));
    this.uploadsInFlight++;
  }

  private releaseUploadSlot(): void {
    this.uploadsInFlight--;
    this.uploadQueue.shift()?.();
  }
}
