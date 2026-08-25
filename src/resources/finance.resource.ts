import { BaseResource, type RequestOptions } from '../core/resource/base-resource.js';
import type { finance } from '../generated/index.js';

const MODULE = 'finance';

/**
 * Settlement and transactions — `mpfinance-external`.
 *
 * The one product whose document declares **no schemas at all**, so its responses are typed
 * `unknown` rather than invented. Run `npm run observe` against a live account and the drift walk
 * will report what actually comes back; reviewed findings become an overlay and the types follow.
 *
 * Both operations capitalise **both** paging parameters — `Offset` and `Limit`. OMS capitalises
 * neither, and sending the lower-case pair here pages nowhere at all.
 */
export class FinanceResource extends BaseResource {
  /** Financial transactions for this merchant. */
  transactions(
    query: finance.GetTransactionsQuery,
    options: RequestOptions = {}
  ): Promise<finance.GetTransactionsResponse> {
    return this.transport.request<finance.GetTransactionsResponse>({
      operationId: 'getTransactions',
      module: MODULE,
      method: 'GET',
      path: '/transactions/merchantid/{merchantId}',
      pathParams: { merchantId: this.merchantId },
      query: { ...query },
      ...this.options(options),
    });
  }

  /** Order-level settlement figures. */
  orders(query: finance.GetOrdersQuery, options: RequestOptions = {}): Promise<finance.GetOrdersResponse> {
    return this.transport.request<finance.GetOrdersResponse>({
      operationId: 'getOrders',
      module: MODULE,
      method: 'GET',
      path: '/orders/merchantid/{merchantId}',
      pathParams: { merchantId: this.merchantId },
      query: { ...query },
      ...this.options(options),
    });
  }
}
