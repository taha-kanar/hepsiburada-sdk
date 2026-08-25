import { BaseResource, type RequestOptions } from '../core/resource/base-resource.js';
import { toFormData, type FileInput } from '../core/http/form-data.js';
import type { catalog } from '../generated/index.js';

const MODULE = 'catalog';

/** Every operation in this product takes `?version=`, and every one of them wants `1`. */
const VERSION = 1;

/**
 * The product catalog — `mpop/product`.
 *
 * Creating a product is not a JSON POST. {@link importProducts} uploads a **`multipart/form-data`
 * file** whose content is a JSON document, and answers with a `trackingId` you poll through
 * {@link importStatus}. That is the only way to create products in bulk.
 *
 * Two field-level traps live in the import payload rather than in this class, because they are
 * properties of the document you upload:
 *
 * - `price` is a **string with a comma**, `"130,50"`. The listing service, on a different host,
 *   wants a JSON number with a point. Sending the wrong one per surface is silently rejected.
 * - attribute keys are Turkish and PascalCase (`UrunAdi`, `Marka`, `GarantiSuresi`), and variant
 *   attributes carry a `_variant_property` suffix.
 *
 * Responses from this host are wrapped in `{ success, code, message, data }` where `code: 0` means
 * success. The transport checks that envelope on every call, so a failure reported inside an
 * HTTP 200 raises rather than decoding as an empty result.
 */
export class ProductsResource extends BaseResource {
  /**
   * Create or update products from a JSON document, uploaded as a file.
   *
   * Pass the document itself and it is wrapped for you:
   *
   * ```ts
   * const { data } = await client.products.importProducts([
   *   { categoryId: 18021982, merchant: merchantId, attributes: { merchantSku: 'ABC', price: '130,50' } },
   * ]);
   * const result = await client.products.importStatus(data.trackingId);
   * ```
   *
   * A `FileInput` may be passed instead when the document is already on disk.
   */
  importProducts(
    document: unknown[] | FileInput,
    options: RequestOptions = {}
  ): Promise<catalog.PostProductsImportResponse> {
    return this.transport.request<catalog.PostProductsImportResponse>({
      operationId: 'postProductsImport',
      module: MODULE,
      method: 'POST',
      path: '/api/products/import',
      query: { version: VERSION },
      body: toFormData({ file: asJsonFile(document, 'integrator.json') }),
      ...this.options(options),
    });
  }

  /** The per-row outcome of an import, by tracking id. */
  importStatus(
    trackingId: string,
    query: Omit<catalog.GetProductsStatusQuery, 'version'> = {},
    options: RequestOptions = {}
  ): Promise<catalog.GetProductsStatusResponse> {
    return this.transport.request<catalog.GetProductsStatusResponse>({
      operationId: 'getProductsStatus',
      module: MODULE,
      method: 'GET',
      path: '/api/products/status/{trackingId}',
      pathParams: { trackingId },
      query: { version: VERSION, ...query },
      ...this.options(options),
    });
  }

  /** Recent tracking ids, so an interrupted run can be resumed. */
  trackingIdHistory(
    query: Omit<catalog.GetProductsTrackingIdHistoryQuery, 'version'> = {},
    options: RequestOptions = {}
  ): Promise<catalog.GetProductsTrackingIdHistoryResponse> {
    return this.transport.request<catalog.GetProductsTrackingIdHistoryResponse>({
      operationId: 'getProductsTrackingIdHistory',
      module: MODULE,
      method: 'GET',
      path: '/api/products/trackingId-history',
      query: { version: VERSION, ...query },
      ...this.options(options),
    });
  }

  /** Create a listing and a product in one step. */
  fastListing(
    body: catalog.PostProductsFastlistingBody,
    options: RequestOptions = {}
  ): Promise<catalog.PostProductsFastlistingResponse> {
    return this.transport.request<catalog.PostProductsFastlistingResponse>({
      operationId: 'postProductsFastlisting',
      module: MODULE,
      method: 'POST',
      path: '/api/products/fastlisting',
      body,
      ...this.options(options),
    });
  }

  /** Status of a list of merchant SKUs. */
  checkStatus(
    body: catalog.PostProductsCheckProductStatusBody,
    options: RequestOptions = {}
  ): Promise<catalog.PostProductsCheckProductStatusResponse> {
    return this.transport.request<catalog.PostProductsCheckProductStatusResponse>({
      operationId: 'postProductsCheckProductStatus',
      module: MODULE,
      method: 'POST',
      path: '/api/products/check-product-status',
      query: { version: VERSION },
      body,
      ...this.options(options),
    });
  }

  /** All products for a merchant, filtered by barcode, merchant SKU or HB SKU. */
  listAll(
    merchantId: string = this.merchantId,
    query: catalog.GetProductsAllProductsOfMerchantQuery = {},
    options: RequestOptions = {}
  ): Promise<catalog.GetProductsAllProductsOfMerchantResponse> {
    return this.transport.request<catalog.GetProductsAllProductsOfMerchantResponse>({
      operationId: 'getProductsAllProductsOfMerchant',
      module: MODULE,
      method: 'GET',
      path: '/api/products/all-products-of-merchant/{merchantId}',
      pathParams: { merchantId },
      query: { ...query },
      ...this.options(options),
    });
  }

  /** Products filtered by product and task status. */
  listByStatus(
    query: Omit<catalog.GetProductsProductsByMerchantAndStatusQuery, 'merchantId' | 'version'> &
      Partial<Pick<catalog.GetProductsProductsByMerchantAndStatusQuery, 'merchantId'>>,
    options: RequestOptions = {}
  ): Promise<catalog.GetProductsProductsByMerchantAndStatusResponse> {
    return this.transport.request<catalog.GetProductsProductsByMerchantAndStatusResponse>({
      operationId: 'getProductsProductsByMerchantAndStatus',
      module: MODULE,
      method: 'GET',
      path: '/api/products/products-by-merchant-and-status',
      query: { merchantId: this.merchantId, version: VERSION, ...query },
      ...this.options(options),
    });
  }

  /** Approve a pre-match Hepsiburada proposed for your product. */
  approvePreMatch(
    body: catalog.PostProductsApprovePrematchBody,
    options: RequestOptions = {}
  ): Promise<catalog.PostProductsApprovePrematchResponse> {
    return this.transport.request<catalog.PostProductsApprovePrematchResponse>({
      operationId: 'postProductsApprovePrematch',
      module: MODULE,
      method: 'POST',
      path: '/api/products/approve-prematch',
      body,
      ...this.options(options),
    });
  }

  /** Reject a proposed pre-match. */
  rejectPreMatch(
    body: catalog.PostProductsRejectPrematchBody,
    options: RequestOptions = {}
  ): Promise<catalog.PostProductsRejectPrematchResponse> {
    return this.transport.request<catalog.PostProductsRejectPrematchResponse>({
      operationId: 'postProductsRejectPrematch',
      module: MODULE,
      method: 'POST',
      path: '/api/products/reject-prematch',
      body,
      ...this.options(options),
    });
  }

  /** Start a delete process. Returns a tracking id. */
  startDelete(
    body: catalog.PostProductsDeleteProcessBody,
    options: RequestOptions = {}
  ): Promise<catalog.PostProductsDeleteProcessResponse> {
    return this.transport.request<catalog.PostProductsDeleteProcessResponse>({
      operationId: 'postProductsDeleteProcess',
      module: MODULE,
      method: 'POST',
      path: '/api/products/delete-process',
      body,
      ...this.options(options),
    });
  }

  /** The outcome of a delete process. */
  deleteStatus(
    trackingId: string,
    options: RequestOptions = {}
  ): Promise<catalog.GetProductsDeleteProcessResponse> {
    return this.transport.request<catalog.GetProductsDeleteProcessResponse>({
      operationId: 'getProductsDeleteProcess',
      module: MODULE,
      method: 'GET',
      path: '/api/products/delete-process/{trackingId}',
      pathParams: { trackingId },
      ...this.options(options),
    });
  }

  /** The category tree. `size` may be raised to 2000; there are roughly 27,000 rows. */
  categories(
    query: Omit<catalog.GetCategoriesGetAllCategoriesQuery, 'version'> = {},
    options: RequestOptions = {}
  ): Promise<catalog.GetCategoriesGetAllCategoriesResponse> {
    return this.transport.request<catalog.GetCategoriesGetAllCategoriesResponse>({
      operationId: 'getCategoriesGetAllCategories',
      module: MODULE,
      method: 'GET',
      path: '/api/categories/get-all-categories',
      query: { version: VERSION, ...query },
      ...this.options(options),
    });
  }

  /** Attributes of a category. Leaf categories only — a branch answers `code: 1003`. */
  categoryAttributes(
    categoryId: number | string,
    query: Omit<catalog.GetCategoriesAttributesQuery, 'version'> = {},
    options: RequestOptions = {}
  ): Promise<catalog.GetCategoriesAttributesResponse> {
    return this.transport.request<catalog.GetCategoriesAttributesResponse>({
      operationId: 'getCategoriesAttributes',
      module: MODULE,
      method: 'GET',
      path: '/api/categories/{categoryId}/attributes',
      pathParams: { categoryId },
      query: { version: VERSION, ...query },
      ...this.options(options),
    });
  }

  /** The allowed values of one category attribute. */
  categoryAttributeValues(
    categoryId: number | string,
    attributeId: number | string,
    query: Omit<catalog.GetCategoriesAttributeValuesQuery, 'version'> = {},
    options: RequestOptions = {}
  ): Promise<catalog.GetCategoriesAttributeValuesResponse> {
    return this.transport.request<catalog.GetCategoriesAttributeValuesResponse>({
      operationId: 'getCategoriesAttributeValues',
      module: MODULE,
      method: 'GET',
      path: '/api/categories/{categoryId}/attribute/{attributeId}/values',
      pathParams: { categoryId, attributeId },
      query: { version: VERSION, ...query },
      ...this.options(options),
    });
  }
}

/** Wrap a JSON document as the file this API expects, or pass a caller's file through. */
export function asJsonFile(document: unknown[] | FileInput, filename: string): FileInput {
  if (Array.isArray(document)) {
    return { data: JSON.stringify(document), filename, contentType: 'application/json' };
  }
  return document;
}
