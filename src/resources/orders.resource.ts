import { BaseResource, type RequestOptions } from '../core/resource/base-resource.js';
import { formatDateFilter } from '../core/date.js';
import type { order } from '../generated/index.js';

const MODULE = 'order';

/** A date window, accepted as `Date`s and formatted where Hepsiburada expects them. */
export interface DateWindow {
  /** Inclusive start. Formatted as Turkey local time — see {@link formatDateFilter}. */
  begindate?: Date | string;
  enddate?: Date | string;
  offset?: number;
  limit?: number;
}

/** Paging for the endpoints that reject a date filter. */
export interface PageWindow {
  offset?: number;
  limit?: number;
}

/** Paging for the two OMS endpoints that spell the parameter `Offset`. */
export interface CapitalisedPageWindow {
  Offset?: number;
  limit?: number;
  /** Minutes to look back. Undocumented but honoured, and the only filter these two accept. */
  timespan?: number;
}

function window(input: DateWindow = {}): Record<string, string | number | undefined> {
  const query: Record<string, string | number | undefined> = {};
  if (input.begindate !== undefined) query['begindate'] = formatDateFilter(input.begindate);
  if (input.enddate !== undefined) query['enddate'] = formatDateFilter(input.enddate);
  if (input.offset !== undefined) query['offset'] = input.offset;
  if (input.limit !== undefined) query['limit'] = input.limit;
  return query;
}

/**
 * Paging only, for the four endpoints that answer a date filter with `400 WrongDateFormat`.
 *
 * `PageWindow` already keeps `begindate` out at compile time, and this keeps it out at run time —
 * which is not belt-and-braces. Most consumers of a published SDK reach it from JavaScript, or
 * from TypeScript through an `any` at the boundary, and a date that slips through does not
 * degrade gracefully: the request 400s, or on the neighbouring endpoint that does accept dates it
 * returns 200 with an empty page. Picking the two fields that work beats forwarding whatever
 * arrived.
 */
function pageWindow(input: PageWindow = {}): Record<string, number | undefined> {
  const query: Record<string, number | undefined> = {};
  if (input.offset !== undefined) query['offset'] = input.offset;
  if (input.limit !== undefined) query['limit'] = input.limit;
  return query;
}

/** The same, for the two OMS endpoints that spell the parameter `Offset`. */
function capitalisedWindow(input: CapitalisedPageWindow = {}): Record<string, number | undefined> {
  const query: Record<string, number | undefined> = {};
  if (input.Offset !== undefined) query['Offset'] = input.Offset;
  if (input.limit !== undefined) query['limit'] = input.limit;
  if (input.timespan !== undefined) query['timespan'] = input.timespan;
  return query;
}

/**
 * Orders, packages and the transitions between them — `oms-external`.
 *
 * The largest of the twelve products, and the one whose shape is least like a REST resource: an
 * order's status is not a field you set but an endpoint you call. A line item is packed by
 * `POST /packages`, shipped by `POST …/intransit`, and completed by `POST …/deliver`, and it
 * moves between the status-bucketed listing endpoints as it goes.
 *
 * Two consequences worth knowing before using this class.
 *
 * **No feed here is a snapshot.** A line item that has been packed leaves `list()` and appears
 * under `listPackages()`; it was not deleted. Treating any one feed as the complete picture, and
 * reconciling against it, deletes real data — a mistake that cost one integration 67 of 69 orders
 * their line items before it was caught. Merge, never replace.
 *
 * **The tracking feeds are thin.** `listShippedPackages()`, `listDeliveredPackages()` and
 * `listUndeliveredPackages()` return a minimal shipment summary with **PascalCase** keys — `Id`,
 * `OrderNumber`, `Barcode`, `PackageNumber`, `ShippedDate` — and no customer, line items, amounts
 * or addresses. Use {@link get} with the order number to fill them in.
 */
export class OrdersResource extends BaseResource {
  /**
   * Orders whose payment has completed — the main polling endpoint.
   *
   * The only operation in this product that honours `begindate`. Pass a `Date`; the SDK formats
   * it as Turkey local time, which is what the filter reads and what nothing documents.
   */
  list(query: DateWindow = {}, options: RequestOptions = {}): Promise<order.GetOrdersResponse> {
    return this.transport.request<order.GetOrdersResponse>({
      operationId: 'getOrders',
      module: MODULE,
      method: 'GET',
      path: '/orders/merchantid/{merchantId}',
      pathParams: { merchantId: this.merchantId },
      query: window(query),
      ...this.options(options),
    });
  }

  /**
   * Cancelled orders.
   *
   * Takes no date filter: the endpoint declares `begindate`/`enddate` and answers
   * `400 WrongDateFormat` for every value. Pull the page and let an idempotent upsert absorb the
   * overlap.
   */
  listCancelled(query: PageWindow = {}, options: RequestOptions = {}): Promise<order.GetOrdersCancelledResponse> {
    return this.transport.request<order.GetOrdersCancelledResponse>({
      operationId: 'getOrdersCancelled',
      module: MODULE,
      method: 'GET',
      path: '/orders/merchantid/{merchantId}/cancelled',
      pathParams: { merchantId: this.merchantId },
      query: pageWindow(query),
      ...this.options(options),
    });
  }

  /** Orders placed but not yet paid for. */
  listAwaitingPayment(
    query: DateWindow = {},
    options: RequestOptions = {}
  ): Promise<order.GetOrdersPaymentawaitingResponse> {
    return this.transport.request<order.GetOrdersPaymentawaitingResponse>({
      operationId: 'getOrdersPaymentawaiting',
      module: MODULE,
      method: 'GET',
      path: '/orders/merchantid/{merchantId}/paymentawaiting',
      pathParams: { merchantId: this.merchantId },
      query: window(query),
      ...this.options(options),
    });
  }

  /**
   * One order in full, by order number.
   *
   * The enrichment call for anything that arrived through a tracking feed: it returns line items,
   * customer, addresses, invoice details and the real order date in every status.
   */
  get(orderNumber: string, options: RequestOptions = {}): Promise<order.GetOrdersByOrdernumberResponse> {
    return this.transport.request<order.GetOrdersByOrdernumberResponse>({
      operationId: 'getOrdersByOrdernumber',
      module: MODULE,
      method: 'GET',
      path: '/orders/merchantid/{merchantId}/ordernumber/{orderNumber}',
      pathParams: { merchantId: this.merchantId, orderNumber },
      ...this.options(options),
    });
  }

  /**
   * Packages awaiting shipment.
   *
   * Note the capital `Offset`: this endpoint and {@link listUnpackedPackages} spell it that way
   * while their siblings do not. Sending `offset` here pages nowhere.
   */
  listPackages(
    query: CapitalisedPageWindow = {},
    options: RequestOptions = {}
  ): Promise<order.GetPackagesResponse> {
    return this.transport.request<order.GetPackagesResponse>({
      operationId: 'getPackages',
      module: MODULE,
      method: 'GET',
      path: '/packages/merchantid/{merchantId}',
      pathParams: { merchantId: this.merchantId },
      query: capitalisedWindow(query),
      ...this.options(options),
    });
  }

  /** Line items that have been unpacked back out of a package. */
  listUnpackedPackages(
    query: CapitalisedPageWindow = {},
    options: RequestOptions = {}
  ): Promise<order.GetPackagesStatusUnpackedResponse> {
    return this.transport.request<order.GetPackagesStatusUnpackedResponse>({
      operationId: 'getPackagesStatusUnpacked',
      module: MODULE,
      method: 'GET',
      path: '/packages/merchantid/{merchantId}/status/unpacked',
      pathParams: { merchantId: this.merchantId },
      query: capitalisedWindow(query),
      ...this.options(options),
    });
  }

  /** Shipped packages. A PascalCase tracking summary — see the class doc. No date filter. */
  listShippedPackages(query: PageWindow = {}, options: RequestOptions = {}): Promise<order.GetPackagesShippedResponse> {
    return this.transport.request<order.GetPackagesShippedResponse>({
      operationId: 'getPackagesShipped',
      module: MODULE,
      method: 'GET',
      path: '/packages/merchantid/{merchantId}/shipped',
      pathParams: { merchantId: this.merchantId },
      query: pageWindow(query),
      ...this.options(options),
    });
  }

  /** Delivered packages. A PascalCase tracking summary — see the class doc. No date filter. */
  listDeliveredPackages(
    query: PageWindow = {},
    options: RequestOptions = {}
  ): Promise<order.GetPackagesDeliveredResponse> {
    return this.transport.request<order.GetPackagesDeliveredResponse>({
      operationId: 'getPackagesDelivered',
      module: MODULE,
      method: 'GET',
      path: '/packages/merchantid/{merchantId}/delivered',
      pathParams: { merchantId: this.merchantId },
      query: pageWindow(query),
      ...this.options(options),
    });
  }

  /** Packages that could not be delivered. A PascalCase tracking summary. No date filter. */
  listUndeliveredPackages(
    query: PageWindow = {},
    options: RequestOptions = {}
  ): Promise<order.GetPackagesUndeliveredResponse> {
    return this.transport.request<order.GetPackagesUndeliveredResponse>({
      operationId: 'getPackagesUndelivered',
      module: MODULE,
      method: 'GET',
      path: '/packages/merchantid/{merchantId}/undelivered',
      pathParams: { merchantId: this.merchantId },
      query: pageWindow(query),
      ...this.options(options),
    });
  }

  /** Packages still waiting for an invoice. */
  listPackagesMissingInvoice(
    query: PageWindow = {},
    options: RequestOptions = {}
  ): Promise<order.GetPackagesMissingInvoiceResponse> {
    return this.transport.request<order.GetPackagesMissingInvoiceResponse>({
      operationId: 'getPackagesMissingInvoice',
      module: MODULE,
      method: 'GET',
      path: '/packages/merchantid/{merchantId}/missing-invoice',
      pathParams: { merchantId: this.merchantId },
      query: pageWindow(query),
      ...this.options(options),
    });
  }

  /** One package by its package number. */
  getPackage(
    packageNumber: string,
    options: RequestOptions = {}
  ): Promise<order.GetPackagesByPackagenumberResponse> {
    return this.transport.request<order.GetPackagesByPackagenumberResponse>({
      operationId: 'getPackagesByPackagenumber',
      module: MODULE,
      method: 'GET',
      path: '/packages/merchantid/{merchantId}/packagenumber/{packagenumber}',
      pathParams: { merchantId: this.merchantId, packagenumber: packageNumber },
      ...this.options(options),
    });
  }

  /**
   * Pack one or more line items into a package. The first transition in the lifecycle.
   *
   * Answers `201` with the created package.
   */
  pack(body: order.PostPackagesBody, options: RequestOptions = {}): Promise<order.PostPackagesResponse> {
    return this.transport.request<order.PostPackagesResponse>({
      operationId: 'postPackages',
      module: MODULE,
      method: 'POST',
      path: '/packages/merchantid/{merchantId}',
      pathParams: { merchantId: this.merchantId },
      body,
      ...this.options(options),
    });
  }

  /** Undo packaging, returning the line items to the unpacked pool. */
  unpack(packageNumber: string, options: RequestOptions = {}): Promise<order.PostPackagesUnpackResponse> {
    return this.transport.request<order.PostPackagesUnpackResponse>({
      operationId: 'postPackagesUnpack',
      module: MODULE,
      method: 'POST',
      path: '/packages/merchantid/{merchantId}/packagenumber/{packagenumber}/unpack',
      pathParams: { merchantId: this.merchantId, packagenumber: packageNumber },
      ...this.options(options),
    });
  }

  /** Split a package into several. */
  split(
    packageNumber: string,
    body: order.PostPackagesSplitBody,
    options: RequestOptions = {}
  ): Promise<order.PostPackagesSplitResponse> {
    return this.transport.request<order.PostPackagesSplitResponse>({
      operationId: 'postPackagesSplit',
      module: MODULE,
      method: 'POST',
      path: '/packages/merchantid/{merchantId}/packagenumber/{packagenumber}/split',
      pathParams: { merchantId: this.merchantId, packagenumber: packageNumber },
      body,
      ...this.options(options),
    });
  }

  /** Hand the package to the carrier — the `Packaged → InTransit` transition. */
  ship(
    packageNumber: string,
    body: order.PostPackagesIntransitBody,
    options: RequestOptions = {}
  ): Promise<order.PostPackagesIntransitResponse> {
    return this.transport.request<order.PostPackagesIntransitResponse>({
      operationId: 'postPackagesIntransit',
      module: MODULE,
      method: 'POST',
      path: '/packages/merchantid/{merchantId}/packagenumber/{packagenumber}/intransit',
      pathParams: { merchantId: this.merchantId, packagenumber: packageNumber },
      body,
      ...this.options(options),
    });
  }

  /** Mark the package delivered. */
  deliver(
    packageNumber: string,
    body: order.PostPackagesDeliverBody,
    options: RequestOptions = {}
  ): Promise<order.PostPackagesDeliverResponse> {
    return this.transport.request<order.PostPackagesDeliverResponse>({
      operationId: 'postPackagesDeliver',
      module: MODULE,
      method: 'POST',
      path: '/packages/merchantid/{merchantId}/packagenumber/{packagenumber}/deliver',
      pathParams: { merchantId: this.merchantId, packagenumber: packageNumber },
      body,
      ...this.options(options),
    });
  }

  /** Mark the package undeliverable, with a reason. */
  markUndelivered(
    packageNumber: string,
    body: order.PostPackagesUndeliverBody,
    options: RequestOptions = {}
  ): Promise<order.PostPackagesUndeliverResponse> {
    return this.transport.request<order.PostPackagesUndeliverResponse>({
      operationId: 'postPackagesUndeliver',
      module: MODULE,
      method: 'POST',
      path: '/packages/merchantid/{merchantId}/packagenumber/{packagenumber}/undeliver',
      pathParams: { merchantId: this.merchantId, packagenumber: packageNumber },
      body,
      ...this.options(options),
    });
  }

  /** The shipping label and barcode for a package. */
  labels(
    packageNumber: string,
    query: order.GetPackagesLabelsQuery = {},
    options: RequestOptions = {}
  ): Promise<order.GetPackagesLabelsResponse> {
    return this.transport.request<order.GetPackagesLabelsResponse>({
      operationId: 'getPackagesLabels',
      module: MODULE,
      method: 'GET',
      path: '/packages/merchantid/{merchantId}/packagenumber/{packagenumber}/labels',
      pathParams: { merchantId: this.merchantId, packagenumber: packageNumber },
      query: { ...query },
      ...this.options(options),
    });
  }

  /**
   * Attach an invoice to a package.
   *
   * Link-based, not a file upload: you host the PDF and Hepsiburada fetches the URL. A package
   * that already carries an invoice answers `409`.
   */
  addInvoice(
    packageNumber: string,
    body: order.PutPackagesInvoiceBody,
    options: RequestOptions = {}
  ): Promise<order.PutPackagesInvoiceResponse> {
    return this.transport.request<order.PutPackagesInvoiceResponse>({
      operationId: 'putPackagesInvoice',
      module: MODULE,
      method: 'PUT',
      path: '/packages/merchantid/{merchantId}/packagenumber/{packageNumber}/invoice',
      pathParams: { merchantId: this.merchantId, packageNumber },
      body,
      ...this.options(options),
    });
  }

  /** Update parcel count and volumetric weight (desi). */
  updateParcelInfo(
    packageNumber: string,
    body: order.PutPackagesParcelInfoBody,
    options: RequestOptions = {}
  ): Promise<order.PutPackagesParcelInfoResponse> {
    return this.transport.request<order.PutPackagesParcelInfoResponse>({
      operationId: 'putPackagesParcelInfo',
      module: MODULE,
      method: 'PUT',
      path: '/packages/merchantid/{merchantId}/packagenumber/{packagenumber}/parcel-info',
      pathParams: { merchantId: this.merchantId, packagenumber: packageNumber },
      body,
      ...this.options(options),
    });
  }

  /** Move a package to a different warehouse. */
  updateWarehouse(
    packageNumber: string,
    body: order.PutPackagesWarehouseBody,
    options: RequestOptions = {}
  ): Promise<order.PutPackagesWarehouseResponse> {
    return this.transport.request<order.PutPackagesWarehouseResponse>({
      operationId: 'putPackagesWarehouse',
      module: MODULE,
      method: 'PUT',
      path: '/packages/merchantid/{merchantId}/packagenumber/{packagenumber}/warehouse',
      pathParams: { merchantId: this.merchantId, packagenumber: packageNumber },
      body,
      ...this.options(options),
    });
  }

  /** Change the carrier on a package. */
  changeCargoCompany(
    packageNumber: string,
    body: order.PutPackagesChangecargocompanyBody,
    options: RequestOptions = {}
  ): Promise<order.PutPackagesChangecargocompanyResponse> {
    return this.transport.request<order.PutPackagesChangecargocompanyResponse>({
      operationId: 'putPackagesChangecargocompany',
      module: MODULE,
      method: 'PUT',
      path: '/packages/merchantid/{merchantId}/packagenumber/{packageNumber}/changecargocompany',
      pathParams: { merchantId: this.merchantId, packageNumber },
      body,
      ...this.options(options),
    });
  }

  /** Which carriers this package may be switched to. */
  changeableCargoCompanies(
    packageNumber: string,
    options: RequestOptions = {}
  ): Promise<order.GetPackagesChangablecargocompaniesResponse> {
    return this.transport.request<order.GetPackagesChangablecargocompaniesResponse>({
      operationId: 'getPackagesChangablecargocompanies',
      module: MODULE,
      method: 'GET',
      path: '/packages/merchantid/{merchantId}/packagenumber/{packageNumber}/changablecargocompanies',
      pathParams: { merchantId: this.merchantId, packageNumber },
      ...this.options(options),
    });
  }

  /**
   * Cancel a line item as the merchant.
   *
   * The reason is an integer `reasonId`, not a free-text string.
   */
  cancelLineItem(
    lineId: string,
    body: order.PostLineitemsCancelbymerchantBody,
    options: RequestOptions = {}
  ): Promise<order.PostLineitemsCancelbymerchantResponse> {
    return this.transport.request<order.PostLineitemsCancelbymerchantResponse>({
      operationId: 'postLineitemsCancelbymerchant',
      module: MODULE,
      method: 'POST',
      path: '/lineitems/merchantid/{merchantId}/id/{lineId}/cancelbymerchant',
      pathParams: { merchantId: this.merchantId, lineId },
      body,
      ...this.options(options),
    });
  }

  /** Change the carrier on a line item that has not been packed yet. */
  changeLineCargoCompany(
    orderLineId: string,
    body: order.PutLineitemsCargocompanyBody,
    options: RequestOptions = {}
  ): Promise<order.PutLineitemsCargocompanyResponse> {
    return this.transport.request<order.PutLineitemsCargocompanyResponse>({
      operationId: 'putLineitemsCargocompany',
      module: MODULE,
      method: 'PUT',
      path: '/lineitems/merchantid/{merchantId}/orderlineid/{id}/cargocompany',
      pathParams: { merchantId: this.merchantId, id: orderLineId },
      body,
      ...this.options(options),
    });
  }

  /** Record the labour cost of a line item. */
  updateLineLaborCost(
    orderLineId: string,
    body: order.PutLineitemsLaborcostBody,
    options: RequestOptions = {}
  ): Promise<order.PutLineitemsLaborcostResponse> {
    return this.transport.request<order.PutLineitemsLaborcostResponse>({
      operationId: 'putLineitemsLaborcost',
      module: MODULE,
      method: 'PUT',
      path: '/lineitems/merchantid/{merchantId}/orderlineid/{id}/laborcost',
      pathParams: { merchantId: this.merchantId, id: orderLineId },
      body,
      ...this.options(options),
    });
  }

  /** Line items that may go into the same package as this one. */
  packageableWith(
    lineItemId: string,
    options: RequestOptions = {}
  ): Promise<order.GetLineitemsPackageablewithResponse> {
    return this.transport.request<order.GetLineitemsPackageablewithResponse>({
      operationId: 'getLineitemsPackageablewith',
      module: MODULE,
      method: 'GET',
      path: '/lineitems/merchantid/{merchantId}/packageablewith/lineitemid/{lineItemId}',
      pathParams: { merchantId: this.merchantId, lineItemId },
      ...this.options(options),
    });
  }

  /** Which carriers an unpacked line item may be switched to. */
  changeableCargoCompaniesForLine(
    orderLineId: string,
    options: RequestOptions = {}
  ): Promise<order.GetDeliveryChangeablecargocompaniesResponse> {
    return this.transport.request<order.GetDeliveryChangeablecargocompaniesResponse>({
      operationId: 'getDeliveryChangeablecargocompanies',
      module: MODULE,
      method: 'GET',
      path: '/delivery/changeablecargocompanies/merchantid/{merchantId}/orderlineid/{orderLineId}',
      pathParams: { merchantId: this.merchantId, orderLineId },
      ...this.options(options),
    });
  }
}
