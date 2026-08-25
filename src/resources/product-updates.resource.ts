import { BaseResource, type RequestOptions } from '../core/resource/base-resource.js';
import { toFormData, type FileInput } from '../core/http/form-data.js';
import { asJsonFile } from './products.resource.js';
import type { productUpdate } from '../generated/index.js';

const MODULE = 'product-update';
const VERSION = 1;

/**
 * Updating products already in the catalog — `mpop/ticket-api`.
 *
 * A separate service from {@link ProductsResource}, on the same host under a different base path,
 * with its own tracking ids. Creating a product and amending one are genuinely different APIs
 * here, which is why they are different classes.
 *
 * Note that this API types numeric-looking fields as strings: `kdv` (VAT rate) and `desi`
 * (volumetric weight) are both `string` in the documented payload.
 */
export class ProductUpdatesResource extends BaseResource {
  /** Submit an update document as a file. Returns a tracking id. */
  submit(document: unknown[] | FileInput, options: RequestOptions = {}): Promise<productUpdate.PostIntegratorImportResponse> {
    return this.transport.request<productUpdate.PostIntegratorImportResponse>({
      operationId: 'postIntegratorImport',
      module: MODULE,
      method: 'POST',
      path: '/api/integrator/import',
      query: { version: VERSION },
      body: toFormData({ file: asJsonFile(document, 'integrator-ticket-upload.json') }),
      ...this.options(options),
    });
  }

  /** The per-row outcome of an update, by tracking id. */
  status(
    trackingId: string,
    query: Omit<productUpdate.GetIntegratorStatusQuery, 'version'> = {},
    options: RequestOptions = {}
  ): Promise<productUpdate.GetIntegratorStatusResponse> {
    return this.transport.request<productUpdate.GetIntegratorStatusResponse>({
      operationId: 'getIntegratorStatus',
      module: MODULE,
      method: 'GET',
      path: '/api/integrator/status/{trackingId}',
      pathParams: { trackingId },
      query: { version: VERSION, ...query },
      ...this.options(options),
    });
  }

  /** One product's current state, by Hepsiburada SKU. `hbSku` is immutable. */
  get(hbSku: string, options: RequestOptions = {}): Promise<productUpdate.GetIntegratorMerchantResponse> {
    return this.transport.request<productUpdate.GetIntegratorMerchantResponse>({
      operationId: 'getIntegratorMerchant',
      module: MODULE,
      method: 'GET',
      path: '/api/integrator/merchant/{merchantId}/hbSku/{hbSku}',
      pathParams: { merchantId: this.merchantId, hbSku },
      ...this.options(options),
    });
  }
}
