import { BaseResource, type RequestOptions } from '../core/resource/base-resource.js';
import type { supplier } from '../generated/index.js';

const MODULE = 'supplier';

/**
 * Supplier listings and purchase orders — `supplier-api-external`.
 *
 * Reads here are `POST …/search` rather than `GET`, so they carry a body instead of a query.
 */
export class SuppliersResource extends BaseResource {
  /** Raise a listing update request. */
  createListingUpdateRequest(
    body: supplier.PostSuppliersListingUpdateRequestsBody,
    options: RequestOptions = {}
  ): Promise<supplier.PostSuppliersListingUpdateRequestsResponse> {
    return this.transport.request<supplier.PostSuppliersListingUpdateRequestsResponse>({
      operationId: 'postSuppliersListingUpdateRequests',
      module: MODULE,
      method: 'POST',
      path: '/suppliers/{merchantId}/listingUpdateRequests',
      pathParams: { merchantId: this.merchantId },
      body,
      ...this.options(options),
    });
  }

  /** Search listing update requests. */
  searchListingUpdateRequests(
    body: supplier.PostSuppliersListingUpdateRequestsSearchBody,
    options: RequestOptions = {}
  ): Promise<supplier.PostSuppliersListingUpdateRequestsSearchResponse> {
    return this.transport.request<supplier.PostSuppliersListingUpdateRequestsSearchResponse>({
      operationId: 'postSuppliersListingUpdateRequestsSearch',
      module: MODULE,
      method: 'POST',
      path: '/suppliers/{merchantId}/listingUpdateRequests/search',
      pathParams: { merchantId: this.merchantId },
      body,
      ...this.options(options),
    });
  }

  /** One listing update request. */
  getListingUpdateRequest(
    requestId: string,
    options: RequestOptions = {}
  ): Promise<supplier.GetSuppliersListingUpdateRequestsResponse> {
    return this.transport.request<supplier.GetSuppliersListingUpdateRequestsResponse>({
      operationId: 'getSuppliersListingUpdateRequests',
      module: MODULE,
      method: 'GET',
      path: '/suppliers/{merchantId}/listingUpdateRequests/{requestId}',
      pathParams: { merchantId: this.merchantId, requestId },
      ...this.options(options),
    });
  }

  /** Search open purchase orders. */
  searchOpenPurchaseOrders(
    body: supplier.PostSuppliersOpenPurchaseOrdersSearchBody,
    options: RequestOptions = {}
  ): Promise<supplier.PostSuppliersOpenPurchaseOrdersSearchResponse> {
    return this.transport.request<supplier.PostSuppliersOpenPurchaseOrdersSearchResponse>({
      operationId: 'postSuppliersOpenPurchaseOrdersSearch',
      module: MODULE,
      method: 'POST',
      path: '/suppliers/{merchantId}/openPurchaseOrders/search',
      pathParams: { merchantId: this.merchantId },
      body,
      ...this.options(options),
    });
  }

  /** Search supplier listings. */
  searchSupplierListings(
    body: supplier.PostSuppliersSupplierlistingsSearchBody,
    options: RequestOptions = {}
  ): Promise<supplier.PostSuppliersSupplierlistingsSearchResponse> {
    return this.transport.request<supplier.PostSuppliersSupplierlistingsSearchResponse>({
      operationId: 'postSuppliersSupplierlistingsSearch',
      module: MODULE,
      method: 'POST',
      path: '/suppliers/{merchantId}/supplierlistings/search',
      pathParams: { merchantId: this.merchantId },
      body,
      ...this.options(options),
    });
  }
}
