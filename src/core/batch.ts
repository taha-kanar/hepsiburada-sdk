/**
 * Hepsiburada's two asynchronous write idioms, and the partial failures they report.
 *
 * Both the catalog and the listing services accept a batch, hand back a ticket, and make you ask
 * again for the outcome — but they do it differently enough that one abstraction over the pair
 * would hide the parts that matter.
 *
 * **Catalog (`mpop`)** takes `multipart/form-data` with a JSON document as a `file` field and
 * answers `{ success, code, data: { trackingId } }`. Polling returns a paged report of every row.
 *
 * **Listing (`listing-external`)** takes a bare JSON array as the request body and answers
 * `{ id }`. Polling returns `{ id, status, total, errors[] }`.
 *
 * The important shared property is what a *failure* looks like. Neither service fails the HTTP
 * request when some rows are rejected: the poll returns 200 and the rejected rows appear in
 * `errors[]`, keyed by their position in the batch. Modelling that as a thrown exception would be
 * wrong twice over — it would discard the rows that succeeded, and it would make the common case
 * (a few bad SKUs in a large upload) indistinguishable from an outage. So a completed batch is a
 * value, and the caller decides what a partial success means for them.
 */

/** The status strings the poll endpoints return. Not an enum on the wire, so unknowns pass through. */
export type BatchStatus = 'Processing' | 'Done' | 'Failed' | (string & {});

/** One rejected row, located by its position in the submitted batch. */
export interface BatchRowError {
  /** 1-based index of the row within the submitted batch, as Hepsiburada numbers them. */
  elementNo?: number;
  hepsiburadaSku?: string;
  merchantSku?: string;
  /** Every message reported against this row. */
  messages: string[];
}

/** The outcome of a batch, once it stopped moving. */
export interface BatchResult<TRaw = unknown> {
  /** The tracking id or upload id this batch was submitted under. */
  id: string;
  status: BatchStatus;
  /** Rows submitted, when the service reports it. */
  total?: number | undefined;
  /** Rows the service rejected. Empty on a clean run. */
  failed: BatchRowError[];
  /** True when the batch finished and rejected nothing. */
  ok: boolean;
  /** The last poll response, for fields this normalisation drops. */
  raw: TRaw;
}

/** A batch that is still running is neither `Done` nor `Failed`. */
export function isSettled(status: BatchStatus): boolean {
  const normalised = status.toLowerCase();
  return normalised === 'done' || normalised === 'failed' || normalised === 'completed';
}

/**
 * Normalise a poll response into a {@link BatchResult}.
 *
 * Written against both shapes because the two services disagree about casing (`Id`/`id`,
 * `Status`/`status`) and about how a row's messages are nested — listing puts them in a nested
 * `errors: string[]`, catalog puts a single `message` on the row.
 */
export function readBatchResult<TRaw = unknown>(body: TRaw): BatchResult<TRaw> {
  const record = (body ?? {}) as Record<string, unknown>;

  const id = String(record['id'] ?? record['Id'] ?? '');
  const status = String(record['status'] ?? record['Status'] ?? 'Processing') as BatchStatus;
  const totalRaw = record['total'] ?? record['Total'];
  const total = totalRaw === undefined ? undefined : Number(totalRaw);

  const rows = record['errors'] ?? record['Errors'];
  const failed: BatchRowError[] = Array.isArray(rows) ? rows.map(readRowError).filter((row) => row.messages.length) : [];

  return {
    id,
    status,
    total: Number.isFinite(total) ? total : undefined,
    failed,
    ok: isSettled(status) && status.toLowerCase() !== 'failed' && failed.length === 0,
    raw: body,
  };
}

function readRowError(row: unknown): BatchRowError {
  const record = (row ?? {}) as Record<string, unknown>;

  const nested = record['errors'] ?? record['Errors'];
  const messages = Array.isArray(nested)
    ? nested.map((message) => String(message))
    : [record['message'] ?? record['Message'] ?? record['description'] ?? record['Description']]
        .filter((message) => message !== undefined && message !== null && message !== '')
        .map((message) => String(message));

  const elementNo = Number(record['elementNo'] ?? record['ElementNo']);

  return {
    ...(Number.isFinite(elementNo) ? { elementNo } : {}),
    ...(record['hepsiburadaSku'] ? { hepsiburadaSku: String(record['hepsiburadaSku']) } : {}),
    ...(record['merchantSku'] ? { merchantSku: String(record['merchantSku']) } : {}),
    messages,
  };
}

export interface PollOptions {
  /** Milliseconds between polls. Default 2000. */
  intervalMs?: number;
  /** Give up after this long. Default 300000 (five minutes). */
  timeoutMs?: number;
  /** Injected for tests. */
  sleep?: (ms: number) => Promise<void>;
  /** Injected for tests. */
  now?: () => number;
  signal?: AbortSignal | undefined;
}

/**
 * Poll until a batch settles, then return what happened.
 *
 * Resolves — rather than throwing — when rows were rejected. `result.ok` is the question most
 * callers want answered; `result.failed` says which rows and why.
 *
 * @throws {Error} only when the batch never settles within `timeoutMs`, or the signal aborts.
 */
export async function pollBatch<TRaw = unknown>(
  poll: () => Promise<TRaw>,
  options: PollOptions = {}
): Promise<BatchResult<TRaw>> {
  const intervalMs = options.intervalMs ?? 2000;
  const timeoutMs = options.timeoutMs ?? 300_000;
  const now = options.now ?? ((): number => Date.now());
  const sleep = options.sleep ?? ((ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms)));

  const deadline = now() + timeoutMs;
  let last: BatchResult<TRaw> | undefined;

  for (;;) {
    if (options.signal?.aborted) throw new Error('pollBatch was aborted by the caller');

    last = readBatchResult(await poll());
    if (isSettled(last.status)) return last;

    if (now() >= deadline) {
      throw new Error(
        `Batch ${last.id || '(no id)'} was still "${last.status}" after ${timeoutMs}ms. ` +
          `It has not failed — poll again later with the same id.`
      );
    }
    await sleep(intervalMs);
  }
}
