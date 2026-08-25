import { BaseResource, type RequestOptions } from '../core/resource/base-resource.js';
import type { listing } from '../generated/index.js';

const MODULE = 'listing';

/**
 * Stock, price and listing state — `listing-external`.
 *
 * This is where a seller's day-to-day writes happen, and it has three properties worth knowing.
 *
 * **Writes are batched and asynchronous.** `updateStock`, `updatePrice` and `updateInventory`
 * take an array and return only an id; the outcome arrives from the matching `…UploadResult`
 * call. Rejected rows come back inside a successful response, keyed by their position in the
 * batch — see `pollBatch` and `readBatchResult` in the core for handling that without discarding
 * the rows that worked.
 *
 * **The synchronous escape hatch exists.** {@link update} writes one SKU and answers immediately.
 * Use it for a single urgent correction; use the batches for volume. Hepsiburada allows at most
 * five concurrent upload jobs and up to 4000 SKUs per request.
 *
 * **A price outside the category band locks the SKU** rather than being rejected. Recovery is
 * {@link bulkUnlock}. And a listing with `isFulfilledByHB` set has its stock managed by
 * Hepsiburada's warehouse — pushing your own oversells or zeroes it, so filter those out of any
 * stock sync.
 *
 * Note also that this host is the strict one about path casing: `/merchantid/` works and
 * `/merchantId/` answers 400, which is why the templates below are copied verbatim.
 */
export class ListingsResource extends BaseResource {
  /** Listings for this merchant. `offset` and `limit` are required by the endpoint. */
  list(query: listing.GetListingsQuery, options: RequestOptions = {}): Promise<listing.GetListingsResponse> {
    return this.transport.request<listing.GetListingsResponse>({
      operationId: 'getListings',
      module: MODULE,
      method: 'GET',
      path: '/listings/merchantid/{merchantId}',
      pathParams: { merchantId: this.merchantId },
      query: { ...query },
      ...this.options(options),
    });
  }

  /** Commission rates. At most 50 SKUs per call, and roughly 240 calls per minute. */
  commissions(
    query: listing.GetCommissionsQuery = {},
    options: RequestOptions = {}
  ): Promise<listing.GetCommissionsResponse> {
    return this.transport.request<listing.GetCommissionsResponse>({
      operationId: 'getCommissions',
      module: MODULE,
      method: 'GET',
      path: '/commissions/merchantid/{merchantId}',
      pathParams: { merchantId: this.merchantId },
      query: { ...query },
      ...this.options(options),
    });
  }

  /** Buybox ranking for the given SKUs. */
  buyboxOrders(
    query: listing.GetBuyboxOrdersQuery = {},
    options: RequestOptions = {}
  ): Promise<listing.GetBuyboxOrdersResponse> {
    return this.transport.request<listing.GetBuyboxOrdersResponse>({
      operationId: 'getBuyboxOrders',
      module: MODULE,
      method: 'GET',
      path: '/buybox-orders/merchantid/{merchantId}',
      pathParams: { merchantId: this.merchantId },
      query: { ...query },
      ...this.options(options),
    });
  }

  /** Submit a combined price, stock and dispatch-time batch. Returns the upload id. */
  updateInventory(
    body: listing.PostListingsInventoryUploadsBody,
    options: RequestOptions = {}
  ): Promise<listing.PostListingsInventoryUploadsResponse> {
    return this.transport.request<listing.PostListingsInventoryUploadsResponse>({
      operationId: 'postListingsInventoryUploads',
      module: MODULE,
      method: 'POST',
      path: '/listings/merchantid/{merchantId}/inventory-uploads',
      pathParams: { merchantId: this.merchantId },
      body,
      ...this.options(options),
    });
  }

  /** The outcome of an inventory batch. Rejected rows arrive here, not as an error. */
  inventoryUploadResult(
    inventoryUploadId: string,
    options: RequestOptions = {}
  ): Promise<listing.GetListingsInventoryUploadsResponse> {
    return this.transport.request<listing.GetListingsInventoryUploadsResponse>({
      operationId: 'getListingsInventoryUploads',
      module: MODULE,
      method: 'GET',
      path: '/listings/merchantid/{merchantId}/inventory-uploads/id/{inventoryUploadId}',
      pathParams: { merchantId: this.merchantId, inventoryUploadId },
      ...this.options(options),
    });
  }

  /** Submit a stock batch. Returns the upload id. */
  updateStock(
    body: listing.PostListingsStockUploadsBody,
    options: RequestOptions = {}
  ): Promise<listing.PostListingsStockUploadsResponse> {
    return this.transport.request<listing.PostListingsStockUploadsResponse>({
      operationId: 'postListingsStockUploads',
      module: MODULE,
      method: 'POST',
      path: '/listings/merchantid/{merchantId}/stock-uploads',
      pathParams: { merchantId: this.merchantId },
      body,
      ...this.options(options),
    });
  }

  /** The outcome of a stock batch. */
  stockUploadResult(id: string, options: RequestOptions = {}): Promise<listing.GetListingsStockUploadsResponse> {
    return this.transport.request<listing.GetListingsStockUploadsResponse>({
      operationId: 'getListingsStockUploads',
      module: MODULE,
      method: 'GET',
      path: '/listings/merchantid/{merchantId}/stock-uploads/id/{id}',
      pathParams: { merchantId: this.merchantId, id },
      ...this.options(options),
    });
  }

  /**
   * Submit a price batch. Returns the upload id.
   *
   * Prices here are JSON numbers with a decimal point. The product-import API on the catalog host
   * wants the opposite — a string with a comma, `"130,50"` — so the two are not interchangeable.
   */
  updatePrice(
    body: listing.PostListingsPriceUploadsBody,
    options: RequestOptions = {}
  ): Promise<listing.PostListingsPriceUploadsResponse> {
    return this.transport.request<listing.PostListingsPriceUploadsResponse>({
      operationId: 'postListingsPriceUploads',
      module: MODULE,
      method: 'POST',
      path: '/listings/merchantid/{merchantId}/price-uploads',
      pathParams: { merchantId: this.merchantId },
      body,
      ...this.options(options),
    });
  }

  /** The outcome of a price batch, including any `MaxLock`/`MinLock` price validations. */
  priceUploadResult(id: string, options: RequestOptions = {}): Promise<listing.GetListingsPriceUploadsResponse> {
    return this.transport.request<listing.GetListingsPriceUploadsResponse>({
      operationId: 'getListingsPriceUploads',
      module: MODULE,
      method: 'GET',
      path: '/listings/merchantid/{merchantId}/price-uploads/id/{id}',
      pathParams: { merchantId: this.merchantId, id },
      ...this.options(options),
    });
  }

  /** Submit a shipping-info batch. Returns the upload id. */
  updateShippingInfo(
    body: listing.PostListingsShippingInfoUploadsBody,
    options: RequestOptions = {}
  ): Promise<listing.PostListingsShippingInfoUploadsResponse> {
    return this.transport.request<listing.PostListingsShippingInfoUploadsResponse>({
      operationId: 'postListingsShippingInfoUploads',
      module: MODULE,
      method: 'POST',
      path: '/listings/merchantid/{merchantId}/shipping-info-uploads',
      pathParams: { merchantId: this.merchantId },
      body,
      ...this.options(options),
    });
  }

  /** The outcome of a shipping-info batch. */
  shippingInfoUploadResult(
    id: string,
    options: RequestOptions = {}
  ): Promise<listing.GetListingsShippingInfoUploadsResponse> {
    return this.transport.request<listing.GetListingsShippingInfoUploadsResponse>({
      operationId: 'getListingsShippingInfoUploads',
      module: MODULE,
      method: 'GET',
      path: '/listings/merchantid/{merchantId}/shipping-info-uploads/id/{id}',
      pathParams: { merchantId: this.merchantId, id },
      ...this.options(options),
    });
  }

  /** Submit an additional-info batch. Returns the upload id. */
  updateAdditionalInfo(
    body: listing.PostListingsAdditionalInfoUploadsBody,
    options: RequestOptions = {}
  ): Promise<listing.PostListingsAdditionalInfoUploadsResponse> {
    return this.transport.request<listing.PostListingsAdditionalInfoUploadsResponse>({
      operationId: 'postListingsAdditionalInfoUploads',
      module: MODULE,
      method: 'POST',
      path: '/listings/merchantid/{merchantId}/additional-info-uploads',
      pathParams: { merchantId: this.merchantId },
      body,
      ...this.options(options),
    });
  }

  /** The outcome of an additional-info batch. */
  additionalInfoUploadResult(
    id: string,
    options: RequestOptions = {}
  ): Promise<listing.GetListingsAdditionalInfoUploadsResponse> {
    return this.transport.request<listing.GetListingsAdditionalInfoUploadsResponse>({
      operationId: 'getListingsAdditionalInfoUploads',
      module: MODULE,
      method: 'GET',
      path: '/listings/merchantid/{merchantId}/additional-info-uploads/id/{id}',
      pathParams: { merchantId: this.merchantId, id },
      ...this.options(options),
    });
  }

  /** Put a listing back on sale. */
  activate(sku: string, options: RequestOptions = {}): Promise<listing.PostListingsActivateResponse> {
    return this.transport.request<listing.PostListingsActivateResponse>({
      operationId: 'postListingsActivate',
      module: MODULE,
      method: 'POST',
      path: '/listings/merchantid/{merchantId}/sku/{sku}/activate',
      pathParams: { merchantId: this.merchantId, sku },
      ...this.options(options),
    });
  }

  /** Take a listing off sale. There is no delete; this and zero stock are the way. */
  deactivate(sku: string, options: RequestOptions = {}): Promise<listing.PostListingsDeactivateResponse> {
    return this.transport.request<listing.PostListingsDeactivateResponse>({
      operationId: 'postListingsDeactivate',
      module: MODULE,
      method: 'POST',
      path: '/listings/merchantid/{merchantId}/sku/{sku}/deactivate',
      pathParams: { merchantId: this.merchantId, sku },
      ...this.options(options),
    });
  }

  /**
   * Update one listing's stock, price and dispatch time synchronously.
   *
   * The only write in this product that answers with the outcome rather than an id.
   */
  update(
    sku: string,
    merchantSku: string,
    body: listing.PostListingsBody,
    options: RequestOptions = {}
  ): Promise<listing.PostListingsResponse> {
    return this.transport.request<listing.PostListingsResponse>({
      operationId: 'postListings',
      module: MODULE,
      method: 'POST',
      path: '/listings/merchantid/{merchantId}/sku/{sku}/merchantsku/{merchantSku}',
      pathParams: { merchantId: this.merchantId, sku, merchantSku },
      body,
      ...this.options(options),
    });
  }

  /** Remove a listing. */
  remove(sku: string, merchantSku: string, options: RequestOptions = {}): Promise<listing.DeleteListingsResponse> {
    return this.transport.request<listing.DeleteListingsResponse>({
      operationId: 'deleteListings',
      module: MODULE,
      method: 'DELETE',
      path: '/listings/merchantid/{merchantId}/sku/{sku}/merchantsku/{merchantSku}',
      pathParams: { merchantId: this.merchantId, sku, merchantSku },
      ...this.options(options),
    });
  }

  /** Unlock SKUs that were locked for pricing outside their category band. */
  bulkUnlock(
    body: listing.PostListingsBulkUnlockBody,
    options: RequestOptions = {}
  ): Promise<listing.PostListingsBulkUnlockResponse> {
    return this.transport.request<listing.PostListingsBulkUnlockResponse>({
      operationId: 'postListingsBulkUnlock',
      module: MODULE,
      method: 'POST',
      path: '/listings/merchantid/{merchantId}/bulk-unlock',
      pathParams: { merchantId: this.merchantId },
      body,
      ...this.options(options),
    });
  }
}
