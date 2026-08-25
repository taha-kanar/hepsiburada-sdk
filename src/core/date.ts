/**
 * Date handling for Hepsiburada's query filters.
 *
 * This is the smallest module in the SDK and the one most likely to save a day of debugging.
 *
 * The order endpoints filter on `begindate`/`enddate` in the format `yyyy-MM-dd HH:mm` — a space
 * rather than a `T`, no seconds, no zone suffix — and they read the value as **Turkey local time**
 * (UTC+3, no daylight saving). Neither fact is written down.
 *
 * What makes it dangerous is the failure mode. An ISO-8601 string is accepted by the parameter
 * parser and then matches no records: the call returns 200 with an empty page. A UTC timestamp
 * parses fine and shifts the window three hours early, quietly dropping the most recent orders on
 * every sync. Nothing raises, nothing logs, and the gap only shows up as missing orders days
 * later.
 *
 * So dates are formatted here, once, and the resource methods take `Date` objects.
 */

/** Turkey has observed permanent UTC+3 since 2016 — no daylight saving to track. */
const TURKEY_OFFSET_MINUTES = 3 * 60;

const pad = (value: number, width = 2): string => String(value).padStart(width, '0');

/**
 * Format an instant the way Hepsiburada's date filters expect it.
 *
 * The instant is converted to Turkey local time first, so a caller can pass a plain `new Date()`
 * from a server running in any zone and get the window they meant.
 *
 * ```ts
 * formatDateFilter(new Date('2026-08-25T09:00:00Z')) // => '2026-08-25 12:00'
 * ```
 */
export function formatDateFilter(instant: Date | string | number): string {
  const date = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError(`formatDateFilter received an invalid date: ${String(instant)}`);
  }

  // Shift the epoch by the target offset, then read the UTC fields — this avoids depending on the
  // host's own timezone, which `toLocaleString` would drag in.
  const shifted = new Date(date.getTime() + TURKEY_OFFSET_MINUTES * 60_000);

  return (
    `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())} ` +
    `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`
  );
}

/**
 * Parse a timestamp from a response body.
 *
 * Response timestamps are ISO-8601, but not consistently: the corpus contains
 * `2023-10-02T11:09:16.334Z`, `2020-09-15T16:06:51Z`, `2018-12-21T09:34:47` with no zone at all,
 * and `2018-12-23T13:28:27.4518986` with seven fractional digits from a .NET serialiser. `Date`
 * handles the first two; the rest need help.
 *
 * A value with no zone is read as Turkey local time, which is what the services mean by it.
 * Returns `undefined` rather than an Invalid Date, so a bad value cannot propagate silently.
 */
export function parseTimestamp(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;

  // Trim sub-millisecond precision that `Date.parse` would reject or truncate unpredictably.
  const normalised = value.replace(/(\.\d{3})\d+/, '$1');

  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(normalised);
  const parsed = Date.parse(hasZone ? normalised : `${normalised}+03:00`);

  return Number.isNaN(parsed) ? undefined : new Date(parsed);
}
