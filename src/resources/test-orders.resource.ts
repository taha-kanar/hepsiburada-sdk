import { BaseResource, type RequestOptions } from '../core/resource/base-resource.js';
import type { testOrder } from '../generated/index.js';

const MODULE = 'test-order';

/**
 * Test order creation — `oms-stub-external`, sandbox only.
 *
 * There is no production counterpart; the hostname does not resolve. The client refuses to build
 * a production base URL for this product rather than letting the call fail at DNS with nothing to
 * explain it.
 */
export class TestOrdersResource extends BaseResource {
  /** Create a test order in the sandbox. */
  create(body: testOrder.PostOrdersBody, options: RequestOptions = {}): Promise<testOrder.PostOrdersResponse> {
    return this.transport.request<testOrder.PostOrdersResponse>({
      operationId: 'postOrders',
      module: MODULE,
      method: 'POST',
      path: '/orders/merchantId/{merchantId}',
      pathParams: { merchantId: this.merchantId },
      body,
      ...this.options(options),
    });
  }
}
