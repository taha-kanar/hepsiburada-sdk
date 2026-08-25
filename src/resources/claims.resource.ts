import { BaseResource, type RequestOptions } from '../core/resource/base-resource.js';
import type { claimCreate, claimList } from '../generated/index.js';

const LIST = 'claim-list';
const CREATE = 'claim-create';

/**
 * Returns and claims — listing on `oms-external`, creation on a sandbox-only stub.
 *
 * Claim status is the one status set in this whole API that really is closed: the service rejects
 * anything outside it with `400 "Wrong Claim Status"`. Order status, by contrast, is a free string
 * on the wire with no enum in any document.
 *
 * Note the path casing here: this product spells the segment `/claims/merchantId/{merchantId}`
 * with a capital I, while orders and listings use `/merchantid/`. Neither is "the" convention —
 * the templates are copied from each document as published.
 */
export type ClaimStatus =
  | 'NewRequest'
  | 'Accepted'
  | 'AwaitingAction'
  | 'InDispute'
  | 'Rejected'
  | 'Refunded'
  | 'Cancelled'
  | 'AwaitingPreApproval';

export class ClaimsResource extends BaseResource {
  /** Claims raised against this merchant. */
  list(query: claimList.GetClaimsQuery = {}, options: RequestOptions = {}): Promise<claimList.GetClaimsResponse> {
    return this.transport.request<claimList.GetClaimsResponse>({
      operationId: 'getClaims',
      module: LIST,
      method: 'GET',
      path: '/claims/merchantId/{merchantId}',
      pathParams: { merchantId: this.merchantId },
      query: { ...query },
      ...this.options(options),
    });
  }

  /** Claims in one status. */
  listByStatus(
    status: ClaimStatus,
    query: claimList.GetClaimsByStatusQuery = {},
    options: RequestOptions = {}
  ): Promise<claimList.GetClaimsByStatusResponse> {
    return this.transport.request<claimList.GetClaimsByStatusResponse>({
      operationId: 'getClaimsByStatus',
      module: LIST,
      method: 'GET',
      path: '/claims/merchantId/{merchantId}/status/{status}',
      pathParams: { merchantId: this.merchantId, status },
      query: { ...query },
      ...this.options(options),
    });
  }

  /** Accept a claim. */
  accept(
    claimNumber: string,
    body: claimList.PostClaimsAcceptBody,
    options: RequestOptions = {}
  ): Promise<claimList.PostClaimsAcceptResponse> {
    return this.transport.request<claimList.PostClaimsAcceptResponse>({
      operationId: 'postClaimsAccept',
      module: LIST,
      method: 'POST',
      path: '/claims/number/{claimNumber}/accept',
      pathParams: { claimNumber },
      body,
      ...this.options(options),
    });
  }

  /** Reject a claim. */
  reject(
    claimNumber: string,
    body: claimList.PostClaimsRejectBody,
    options: RequestOptions = {}
  ): Promise<claimList.PostClaimsRejectResponse> {
    return this.transport.request<claimList.PostClaimsRejectResponse>({
      operationId: 'postClaimsReject',
      module: LIST,
      method: 'POST',
      path: '/claims/number/{claimNumber}/reject',
      pathParams: { claimNumber },
      body,
      ...this.options(options),
    });
  }

  /** Confirm a pre-approval. */
  confirmPreApproval(
    claimNumber: string,
    body: claimList.PostClaimsPreapprovalconfirmBody,
    options: RequestOptions = {}
  ): Promise<claimList.PostClaimsPreapprovalconfirmResponse> {
    return this.transport.request<claimList.PostClaimsPreapprovalconfirmResponse>({
      operationId: 'postClaimsPreapprovalconfirm',
      module: LIST,
      method: 'POST',
      path: '/claims/number/{claimNumber}/preapprovalconfirm',
      pathParams: { claimNumber },
      body,
      ...this.options(options),
    });
  }

  /**
   * Create a test claim.
   *
   * Sandbox only — the production hostname for this stub does not resolve, and the client refuses
   * to build a production base URL for it rather than failing at DNS.
   */
  createTestClaim(
    body: claimCreate.PostClaimsMerchantCreateBody,
    options: RequestOptions = {}
  ): Promise<claimCreate.PostClaimsMerchantCreateResponse> {
    return this.transport.request<claimCreate.PostClaimsMerchantCreateResponse>({
      operationId: 'postClaimsMerchantCreate',
      module: CREATE,
      method: 'POST',
      path: '/claims/merchant/{merchantid}/create',
      pathParams: { merchantid: this.merchantId },
      body,
      ...this.options(options),
    });
  }
}
