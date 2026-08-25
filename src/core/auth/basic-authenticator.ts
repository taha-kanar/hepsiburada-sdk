import { withHeaders } from '../http/types.js';
import type { HttpRequest } from '../http/types.js';
import { encodeBase64 } from './base64.js';
import type { Authenticator } from './authenticator.js';

export interface BasicAuthenticatorOptions {
  /** The seller's GUID merchant id, from Merchant Panel → Hesabım → Bilgilerim → Mağaza ID. */
  merchantId: string;
  /** The service key (servis anahtarı), from Bilgilerim → Entegrasyon → Entegratör Bilgileri. */
  password: string;
  /** An explicit Basic-auth username. Defaults to {@link merchantId} — see the class doc. */
  username?: string | undefined;
  /** The registered integrator name, sent verbatim as `User-Agent`. */
  userAgent: string;
}

/**
 * HTTP Basic auth plus the mandatory `User-Agent`.
 *
 * Two details here are the difference between a working integration and an unexplained 401, and
 * both contradict what most of the public writing on this API says.
 *
 * **The username slot holds the merchant id.** Hepsiburada's own FAQ describes a developer
 * username and a service key, and four open-source SDKs take a separate username, so a reasonable
 * reading is `username:serviceKey`. Live testing against production says otherwise: on
 * `oms-external`, `merchantId:secret` is accepted and `<integratorName>:secret` is refused. The
 * merchant panel does display a `Username` field, and mistaking it for this one is a documented
 * root cause of a production outage. So `username` defaults to `merchantId` and exists only as an
 * override for a seller who genuinely has a distinct one — which satisfies both readings without
 * guessing.
 *
 * **The `User-Agent` must match the registered integrator name exactly.** It is required on
 * 82 of the 96 published operations and declared as a parameter on all 96. Hepsiburada validates
 * the value rather than merely requiring it: the bare registered name is accepted while
 * `<merchantId> - SelfIntegration`, `<merchantId> - <integratorName>` and every other decorated
 * variant is refused with a 401. The widely-published `{merchantId} - {AppName}` format is simply
 * wrong. Because the correct value is per-seller credential data rather than a property of this
 * SDK, it is required in config and never synthesised — an SDK-invented default would be a
 * guaranteed 401 that looks like a credentials problem.
 *
 * The header is computed once; nothing re-encodes per call.
 */
export class BasicAuthenticator implements Authenticator {
  private readonly header: string;
  private readonly userAgent: string;

  constructor(options: BasicAuthenticatorOptions) {
    const user = options.username ?? options.merchantId;
    this.header = `Basic ${encodeBase64(`${user}:${options.password}`)}`;
    this.userAgent = options.userAgent;
  }

  authenticate(request: HttpRequest): HttpRequest {
    return withHeaders(request, { authorization: this.header, 'user-agent': this.userAgent });
  }
}
