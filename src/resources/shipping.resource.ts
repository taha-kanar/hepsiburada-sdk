import { BaseResource, type RequestOptions } from '../core/resource/base-resource.js';
import type { shipping } from '../generated/index.js';

const MODULE = 'shipping';

/**
 * Carriers and shipping profiles — `shipping-external`.
 *
 * Note the path casing: this product spells the segment `{merchantId}` directly rather than
 * `/merchantid/{merchantId}`, unlike orders and listings. The templates are copied verbatim from
 * the document for exactly this reason.
 */
export class ShippingResource extends BaseResource {
  /** Carriers available to this merchant. */
  cargoFirms(options: RequestOptions = {}): Promise<shipping.GetCargoFirmsResponse> {
    return this.transport.request<shipping.GetCargoFirmsResponse>({
      operationId: 'getCargoFirms',
      module: MODULE,
      method: 'GET',
      path: '/cargoFirms/{merchantId}',
      pathParams: { merchantId: this.merchantId },
      ...this.options(options),
    });
  }

  /** Shipping profiles configured for this merchant. */
  profiles(options: RequestOptions = {}): Promise<shipping.GetProfilesResponse> {
    return this.transport.request<shipping.GetProfilesResponse>({
      operationId: 'getProfiles',
      module: MODULE,
      method: 'GET',
      path: '/profiles/{merchantId}',
      pathParams: { merchantId: this.merchantId },
      ...this.options(options),
    });
  }

  /** Create a shipping profile. */
  createProfile(
    body: shipping.PostProfileCreateByMerchantIdBody,
    options: RequestOptions = {}
  ): Promise<shipping.PostProfileCreateByMerchantIdResponse> {
    return this.transport.request<shipping.PostProfileCreateByMerchantIdResponse>({
      operationId: 'postProfileCreateByMerchantId',
      module: MODULE,
      method: 'POST',
      path: '/profile/createByMerchantId',
      body,
      ...this.options(options),
    });
  }

  /** Update a shipping profile. */
  updateProfile(
    body: shipping.PutProfileUpdateByMerchantIdBody,
    options: RequestOptions = {}
  ): Promise<shipping.PutProfileUpdateByMerchantIdResponse> {
    return this.transport.request<shipping.PutProfileUpdateByMerchantIdResponse>({
      operationId: 'putProfileUpdateByMerchantId',
      module: MODULE,
      method: 'PUT',
      path: '/profile/updateByMerchantId',
      body,
      ...this.options(options),
    });
  }
}
