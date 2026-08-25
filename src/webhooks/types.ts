/**
 * The eight inbound webhook contracts.
 *
 * Hepsiburada's webhooks run the opposite way to everything else in this SDK: there is no
 * subscription endpoint and nothing to call. You build eight HTTP endpoints under a base URL of
 * your own, e-mail that base URL to Hepsiburada along with a Basic-auth username and password of
 * your choosing, and they call you. There is no signature header and no HMAC — the shared Basic
 * credentials are the whole of the security model.
 *
 * So this module ships types and nothing else: a client would have nothing to talk to. What it
 * gives you is the payload shape for each handler, transcribed from the published contracts, so
 * the body you receive is not `any`.
 *
 * Two things the documentation says that are easy to miss:
 *
 * - **Your own API-driven actions are not echoed back.** Shipping a package through
 *   `client.orders.ship()` does not produce an `intransit` webhook. The feed reports what happened
 *   elsewhere, not what you did.
 * - **Handle them idempotently.** Every contract page repeats this; deliveries can repeat.
 *
 * All timestamps are ISO-8601 strings, inconsistently serialised — some carry a `Z`, some carry
 * none, some carry seven fractional digits. Use `parseTimestamp` from the core rather than
 * `new Date()`.
 */

/** A monetary amount. `currency` is `TRY` in practice. */
export interface WebhookMoney {
  currency?: string;
  amount?: number;
}

/** A postal address as the webhooks carry it. */
export interface WebhookAddress {
  addressId?: string;
  address?: string;
  name?: string;
  email?: string;
  countryCode?: string;
  phoneNumber?: string;
  alternatePhoneNumber?: string;
  district?: string;
  city?: string;
  town?: string;
  postalCode?: string;
}

/** Invoice details, including the identifiers an e-invoice needs. */
export interface WebhookInvoice {
  /** TC kimlik number for an individual buyer. */
  turkishIdentityNumber?: string | null;
  /** Tax number for a company buyer. */
  taxNumber?: string | null;
  taxOffice?: string | null;
  address?: WebhookAddress;
}

export interface WebhookCargoCompany {
  id?: number;
  name?: string;
  shortName?: string;
  logoUrl?: string;
  trackingUrl?: string | null;
}

/** One line item, as `POST /orders` delivers it. */
export interface WebhookOrderLine {
  id?: string;
  orderNumber?: string;
  orderDate?: string;
  dueDate?: string;
  lastStatusUpdateDate?: string;
  name?: string;
  sku?: string;
  merchantSKU?: string;
  productImageUrlFormat?: string;
  quantity?: number;
  merchantId?: string;
  /** A free string on the wire — no document declares an enum for it. */
  status?: string;
  totalPrice?: WebhookMoney;
  unitPrice?: WebhookMoney;
  purchasePrice?: WebhookMoney;
  vat?: WebhookMoney;
  vatRate?: number;
  commission?: WebhookMoney;
  commissionType?: number;
  hbDiscount?: { totalPrice?: WebhookMoney; unitPrice?: WebhookMoney };
  discountPriceToBeInvoicedHb?: WebhookMoney;
  discountInfo?: unknown[];
  deptorDifferenceAmount?: number;
  paymentTermInDays?: number;
  customerName?: string;
  /** Capitalised in the published contract, unlike every neighbouring field. */
  CustomerId?: string;
  creditCardHolderName?: string | null;
  shippingAddress?: WebhookAddress;
  invoice?: WebhookInvoice;
  cargoCompany?: string;
  cargoCompanyModel?: WebhookCargoCompany;
  warehouse?: { shippingModel?: string; shippingAddressLabel?: string };
  deliveryType?: string;
  deliveryOptionCode?: string;
  deliveryNote?: string | null;
  dispatchTime?: number;
  sapNumber?: string;
  slot?: { id?: string | null; timeslot?: string };
  pickUpTime?: string;
  isCustomized?: boolean;
  isCancellable?: boolean;
  canCreatePackage?: boolean;
  isJetDelivery?: boolean;
  customizedText01?: string;
  customizedText02?: string;
  customizedText03?: string;
  customizedText04?: string;
  customizedTextX?: string;
}

/** `POST {yourBaseUrl}/orders` — a new order. */
export interface CreateOrderWebhook {
  items?: WebhookOrderLine[];
}

/** One item inside a package notification. */
export interface WebhookPackageLine {
  lineItemId?: string;
  listingId?: string;
  hbSku?: string;
  merchantSku?: string;
  quantity?: number;
  price?: WebhookMoney;
  [key: string]: unknown;
}

/** `POST {yourBaseUrl}/packages` — items were packed into a package. */
export interface CreatePackagesWebhook {
  id?: string;
  status?: string;
  merchantId?: string;
  customerId?: string;
  customerName?: string;
  orderDate?: string;
  dueDate?: string;
  barcode?: string;
  packageNumber?: string;
  cargoCompany?: string;
  shippingAddressDetail?: string;
  recipientName?: string;
  shippingCountryCode?: string;
  shippingDistrict?: string;
  shippingTown?: string;
  shippingCity?: string;
  email?: string;
  phoneNumber?: string;
  companyName?: string;
  billingAddress?: string;
  billingCity?: string;
  billingTown?: string;
  billingDistrict?: string;
  billingPostalCode?: string;
  taxOffice?: string;
  taxNumber?: string;
  identityNo?: string;
  items?: WebhookPackageLine[];
}

/**
 * `PUT {yourBaseUrl}/lineitems/{lineitemid}/cancel` — a line item was cancelled.
 *
 * The published example for this contract is not valid JSON: it quotes the boolean as
 * `"isUnpackedLine":'false'`, with single quotes. The field is a boolean on the wire.
 */
export interface OrderCancelWebhook {
  id?: string;
  merchantId?: string;
  orderNumber?: string;
  cancelDate?: string;
  quantity?: number;
  /** Who cancelled — `Customer`, `Merchant`, and others. Free string. */
  cancelledBy?: string;
  cancelReasonCode?: string;
  isUnpackedLine?: boolean;
}

/** `PUT {yourBaseUrl}/packages/{packagenumber}/unpack` — a package was taken apart. */
export interface UnpackWebhook {
  merchantId?: string;
  packageNumber?: string;
  unpackedDate?: string;
  orderNumbers?: string[];
}

/** `PUT {yourBaseUrl}/packages/{packagenumber}/intransit` — handed to the carrier. */
export interface IntransitWebhook {
  merchantId?: string;
  packageNumber?: string;
  shippedDate?: string;
  barcode?: string;
  trackingInfoCode?: string;
  trackingInfoUrl?: string;
  /** Volumetric weight. */
  deci?: number;
}

/** `PUT {yourBaseUrl}/packages/{packagenumber}/deliver` — delivered. */
export interface DeliverWebhook {
  merchantId?: string;
  packageNumber?: string;
  receivedDate?: string;
  receivedBy?: string;
  barcode?: string;
}

/** `PUT {yourBaseUrl}/packages/{packagenumber}/undeliver` — delivery failed. */
export interface UndeliverWebhook {
  merchantId?: string;
  packageNumber?: string;
  undeliveredDate?: string;
  undeliveredReason?: string;
  barcode?: string;
}

/** `PUT {yourBaseUrl}/orders/{ordersnumber}/shippingaddress` — the buyer moved the delivery. */
export interface ChangeShippingAddressWebhook extends WebhookAddress {
  orderNumber?: string;
}

/** Every webhook, keyed by the event name Hepsiburada uses. */
export interface WebhookPayloads {
  'create-order': CreateOrderWebhook;
  'create-packages': CreatePackagesWebhook;
  'order-cancel': OrderCancelWebhook;
  unpack: UnpackWebhook;
  intransit: IntransitWebhook;
  deliver: DeliverWebhook;
  undeliver: UndeliverWebhook;
  'change-shipping-address-order': ChangeShippingAddressWebhook;
}

export type WebhookEvent = keyof WebhookPayloads;

/**
 * The endpoint each event is delivered to, relative to the base URL you register.
 *
 * Note that only `create-order` and `create-packages` are `POST`; the other six are `PUT`.
 */
export const WEBHOOK_ROUTES: Readonly<Record<WebhookEvent, { method: 'POST' | 'PUT'; path: string }>> = {
  'create-order': { method: 'POST', path: '/orders' },
  'create-packages': { method: 'POST', path: '/packages' },
  'order-cancel': { method: 'PUT', path: '/lineitems/{lineitemid}/cancel' },
  unpack: { method: 'PUT', path: '/packages/{packagenumber}/unpack' },
  intransit: { method: 'PUT', path: '/packages/{packagenumber}/intransit' },
  deliver: { method: 'PUT', path: '/packages/{packagenumber}/deliver' },
  undeliver: { method: 'PUT', path: '/packages/{packagenumber}/undeliver' },
  'change-shipping-address-order': { method: 'PUT', path: '/orders/{ordersnumber}/shippingaddress' },
};
