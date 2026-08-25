import { describe, expect, it } from 'vitest';
import { formatDateFilter, parseTimestamp } from '../src/index.js';
import { testClient } from './helpers.js';

/**
 * The most consequential eighty lines in the SDK.
 *
 * `begindate` is read as Turkey local time (UTC+3, no daylight saving) in the format
 * `yyyy-MM-dd HH:mm`. Sending UTC shifts the window three hours early and quietly drops the newest
 * orders; sending ISO-8601 is accepted by the parameter parser and matches no records at all.
 * Neither failure raises, and neither is documented.
 */
describe('formatDateFilter', () => {
  it('converts an instant to Turkey local time', () => {
    expect(formatDateFilter(new Date('2026-08-25T09:00:00Z'))).toBe('2026-08-25 12:00');
  });

  it('uses a space, no seconds and no zone suffix', () => {
    expect(formatDateFilter(new Date('2026-01-02T03:04:05.678Z'))).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });

  it('rolls the date over at the Turkish midnight, not the UTC one', () => {
    // 22:30Z on the 24th is 01:30 on the 25th in Istanbul — a whole day out if read as UTC.
    expect(formatDateFilter(new Date('2026-08-24T22:30:00Z'))).toBe('2026-08-25 01:30');
  });

  it('does not shift with the host timezone', () => {
    const original = process.env['TZ'];
    try {
      process.env['TZ'] = 'America/Los_Angeles';
      expect(formatDateFilter(new Date('2026-08-25T09:00:00Z'))).toBe('2026-08-25 12:00');
    } finally {
      if (original === undefined) delete process.env['TZ'];
      else process.env['TZ'] = original;
    }
  });

  it('accepts a string or an epoch', () => {
    expect(formatDateFilter('2026-08-25T09:00:00Z')).toBe('2026-08-25 12:00');
    expect(formatDateFilter(Date.parse('2026-08-25T09:00:00Z'))).toBe('2026-08-25 12:00');
  });

  it('refuses an unparseable value rather than sending "Invalid Date"', () => {
    expect(() => formatDateFilter('last tuesday')).toThrow(TypeError);
  });
});

describe('parseTimestamp', () => {
  it.each([
    ['2023-10-02T11:09:16.334Z', '2023-10-02T11:09:16.334Z'],
    ['2020-09-15T16:06:51Z', '2020-09-15T16:06:51.000Z'],
    // Seven fractional digits, from a .NET serialiser.
    ['2018-12-23T13:28:27.4518986Z', '2018-12-23T13:28:27.451Z'],
    // No zone at all: the services mean Turkey local time by it.
    ['2018-12-21T09:34:47', '2018-12-21T06:34:47.000Z'],
  ])('parses %s', (input, expected) => {
    expect(parseTimestamp(input)?.toISOString()).toBe(expected);
  });

  it('returns undefined rather than an Invalid Date', () => {
    expect(parseTimestamp('not a date')).toBeUndefined();
    expect(parseTimestamp('')).toBeUndefined();
    expect(parseTimestamp(null)).toBeUndefined();
    expect(parseTimestamp(undefined)).toBeUndefined();
  });
});

describe('the resource layer', () => {
  it('formats a Date the way the filter expects', async () => {
    const { client, http } = testClient({ body: [] });

    await client.orders.list({ begindate: new Date('2026-08-25T09:00:00Z') });

    expect(http.query.get('begindate')).toBe('2026-08-25 12:00');
  });

  it('formats both ends of a window', async () => {
    const { client, http } = testClient({ body: [] });

    await client.orders.list({
      begindate: new Date('2026-08-25T09:00:00Z'),
      enddate: new Date('2026-08-25T10:00:00Z'),
    });

    expect(http.query.get('enddate')).toBe('2026-08-25 13:00');
  });

  // Passing an ISO string straight through is exactly the mistake this SDK exists to prevent, so
  // even a string is re-formatted rather than forwarded.
  it('re-formats an ISO string rather than forwarding it', async () => {
    const { client, http } = testClient({ body: [] });

    await client.orders.list({ begindate: '2026-08-25T09:00:00Z' });

    expect(http.query.get('begindate')).toBe('2026-08-25 12:00');
  });
});
