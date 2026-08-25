/* eslint-disable */
/**
 * Operations whose published parameters production does not honour.
 *
 * Generated from the `x-rejects-date-filter` markers in openapi/overlays/. These endpoints
 * declare `begindate`/`enddate` and answer 400 WrongDateFormat for every value; the resource
 * layer drops the parameters rather than sending a request that cannot succeed.
 */

export const REJECTS_DATE_FILTER: ReadonlySet<string> = new Set([
  "order.getOrdersCancelled",
  "order.getPackagesDelivered",
  "order.getPackagesShipped",
  "order.getPackagesUndelivered"
]);
