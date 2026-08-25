import { BaseResource, type RequestOptions } from '../core/resource/base-resource.js';
import type { promotion } from '../generated/index.js';

const MODULE = 'promotion';

/**
 * Seller-funded campaigns — `diskonto-external`.
 *
 * The only product that spells its page size `pagesize`, all lower case.
 */
export class PromotionsResource extends BaseResource {
  /** Campaigns for this merchant. `page` and `pagesize` are both required. */
  list(
    query: promotion.GetSelfCampaignDiscountsQuery,
    options: RequestOptions = {}
  ): Promise<promotion.GetSelfCampaignDiscountsResponse> {
    return this.transport.request<promotion.GetSelfCampaignDiscountsResponse>({
      operationId: 'getSelfCampaignDiscounts',
      module: MODULE,
      method: 'GET',
      path: '/self-campaign/{merchantId}/discounts',
      pathParams: { merchantId: this.merchantId },
      query: { ...query },
      ...this.options(options),
    });
  }

  /** One campaign. */
  get(campaignId: string | number, options: RequestOptions = {}): Promise<promotion.GetSelfCampaignDiscountResponse> {
    return this.transport.request<promotion.GetSelfCampaignDiscountResponse>({
      operationId: 'getSelfCampaignDiscount',
      module: MODULE,
      method: 'GET',
      path: '/self-campaign/{merchantId}/discount/{campaignId}',
      pathParams: { merchantId: this.merchantId, campaignId },
      ...this.options(options),
    });
  }

  /** A fixed-lira basket discount. */
  createTlDiscount(
    body: promotion.PostSelfCampaignTlDiscountBody,
    options: RequestOptions = {}
  ): Promise<promotion.PostSelfCampaignTlDiscountResponse> {
    return this.transport.request<promotion.PostSelfCampaignTlDiscountResponse>({
      operationId: 'postSelfCampaignTlDiscount',
      module: MODULE,
      method: 'POST',
      path: '/self-campaign/{merchantId}/tl-discount',
      pathParams: { merchantId: this.merchantId },
      body,
      ...this.options(options),
    });
  }

  /** A percentage basket discount. */
  createPercentDiscount(
    body: promotion.PostSelfCampaignPercentDiscountBody,
    options: RequestOptions = {}
  ): Promise<promotion.PostSelfCampaignPercentDiscountResponse> {
    return this.transport.request<promotion.PostSelfCampaignPercentDiscountResponse>({
      operationId: 'postSelfCampaignPercentDiscount',
      module: MODULE,
      method: 'POST',
      path: '/self-campaign/{merchantId}/percent-discount',
      pathParams: { merchantId: this.merchantId },
      body,
      ...this.options(options),
    });
  }

  /** A buy-X-get-Y campaign. */
  createXyDiscount(
    body: promotion.PostSelfCampaignXyDiscountBody,
    options: RequestOptions = {}
  ): Promise<promotion.PostSelfCampaignXyDiscountResponse> {
    return this.transport.request<promotion.PostSelfCampaignXyDiscountResponse>({
      operationId: 'postSelfCampaignXyDiscount',
      module: MODULE,
      method: 'POST',
      path: '/self-campaign/{merchantId}/xy-discount',
      pathParams: { merchantId: this.merchantId },
      body,
      ...this.options(options),
    });
  }

  /** Cancel a running campaign. */
  cancel(
    body: promotion.PostSelfCampaignCancelDiscountBody,
    options: RequestOptions = {}
  ): Promise<promotion.PostSelfCampaignCancelDiscountResponse> {
    return this.transport.request<promotion.PostSelfCampaignCancelDiscountResponse>({
      operationId: 'postSelfCampaignCancelDiscount',
      module: MODULE,
      method: 'POST',
      path: '/self-campaign/{merchantId}/cancel-discount',
      pathParams: { merchantId: this.merchantId },
      body,
      ...this.options(options),
    });
  }

  /** Campaign limits that apply to this merchant. */
  limits(options: RequestOptions = {}): Promise<promotion.GetSelfCampaignLimitsResponse> {
    return this.transport.request<promotion.GetSelfCampaignLimitsResponse>({
      operationId: 'getSelfCampaignLimits',
      module: MODULE,
      method: 'GET',
      path: '/self-campaign/{merchantId}/limits',
      pathParams: { merchantId: this.merchantId },
      ...this.options(options),
    });
  }

  /** Remaining campaign budget. */
  budgets(options: RequestOptions = {}): Promise<promotion.GetSelfCampaignBudgetsResponse> {
    return this.transport.request<promotion.GetSelfCampaignBudgetsResponse>({
      operationId: 'getSelfCampaignBudgets',
      module: MODULE,
      method: 'GET',
      path: '/self-campaign/{merchantId}/budgets',
      pathParams: { merchantId: this.merchantId },
      ...this.options(options),
    });
  }

  /** Categories a campaign may target. */
  categories(options: RequestOptions = {}): Promise<promotion.GetCategoriesResponse> {
    return this.transport.request<promotion.GetCategoriesResponse>({
      operationId: 'getCategories',
      module: MODULE,
      method: 'GET',
      path: '/categories/{merchantId}',
      pathParams: { merchantId: this.merchantId },
      ...this.options(options),
    });
  }
}
