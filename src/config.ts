import { HepsiburadaError } from './core/errors/errors.js';
import { HOSTS } from './generated/hosts.js';
import type { Logger } from './core/logger.js';

/** Which Hepsiburada environment to talk to. */
export type Environment = 'production' | 'sandbox';

export interface ClientOptions {
  /**
   * The seller's GUID merchant id.
   *
   * Merchant Panel → Hesabım → Bilgilerim → Mağaza ID. It appears in nearly every path, and it is
   * also the Basic-auth username unless {@link username} says otherwise.
   */
  merchantId: string;

  /**
   * The service key (servis anahtarı) issued to your integrator.
   *
   * Bilgilerim → Entegrasyon → Entegratör Bilgileri.
   */
  password: string;

  /**
   * The registered integrator name, sent verbatim as `User-Agent`.
   *
   * Mandatory, and validated by Hepsiburada rather than merely required: an exact match is
   * accepted and every decorated variant — including the widely-published
   * `{merchantId} - {AppName}` form — is refused with a 401. Because the correct value belongs to
   * the seller rather than to this SDK, there is no default: inventing one would guarantee a 401
   * that looks like a credentials problem.
   */
  userAgent: string;

  /**
   * An explicit Basic-auth username.
   *
   * Leave it unset unless you know you need it. Hepsiburada's own documentation describes a
   * developer username, but live testing against production shows the merchant id is what the
   * username slot actually wants — and the panel displays a `Username` field that is not this one.
   * Set it only if `merchantId` is refused.
   */
  username?: string;

  /** Default `production`. `sandbox` switches every product to its `-sit` host. */
  environment?: Environment;

  /**
   * Override a product's base URL, keyed by module name (`order`, `listing`, `catalog`, …).
   *
   * Useful for pointing one product at a proxy or a recorded fixture without moving the rest.
   */
  baseUrls?: Partial<Record<string, string>>;

  /** Per-request timeout in milliseconds. `0` disables it. Default 30000. */
  timeoutMs?: number;

  logger?: Logger;
}

/** Validated configuration. Every field is settled; nothing here is optional at use time. */
export interface ResolvedConfig {
  readonly merchantId: string;
  readonly password: string;
  readonly userAgent: string;
  readonly username: string | undefined;
  readonly environment: Environment;
  readonly baseUrls: Readonly<Record<string, string>>;
  readonly timeoutMs: number | undefined;
}

function required(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new HepsiburadaError(`HepsiburadaClient: \`${name}\` is required.`, {
      operationId: 'configure',
      module: 'client',
      method: 'NONE',
      url: '',
    });
  }
  return value.trim();
}

/**
 * Resolve the base URL of every product for the chosen environment.
 *
 * The two sandbox stubs (`test-order`, `claim-create`) have no production hostname — not an
 * omission, a fact: `oms-stub-external.hepsiburada.com` and `claim-stub-external.hepsiburada.com`
 * do not resolve. Rather than emit a URL that will fail at DNS, they are left out of the
 * production map, and the transport raises a message that says why when one is called. An
 * explicit `baseUrls` override still wins, so a proxy or a recording can stand in.
 */
function resolveBaseUrls(environment: Environment, overrides: Partial<Record<string, string>>): Record<string, string> {
  const resolved: Record<string, string> = {};

  for (const [module, hosts] of Object.entries(HOSTS)) {
    const chosen = environment === 'sandbox' ? hosts.sit : hosts.prod;
    if (chosen) resolved[module] = chosen;
  }

  for (const [module, url] of Object.entries(overrides)) {
    if (url) resolved[module] = url.replace(/\/+$/, '');
  }
  return resolved;
}

export function resolveConfig(options: ClientOptions, logger: Logger): ResolvedConfig {
  const merchantId = required(options.merchantId, 'merchantId');
  const password = required(options.password, 'password');
  const userAgent = required(options.userAgent, 'userAgent');
  const environment: Environment = options.environment ?? 'production';

  if (/^\S+\s+-\s+\S+/.test(userAgent)) {
    logger.warn(
      'userAgent looks like the "<merchantId> - <name>" format, which Hepsiburada rejects with a 401. ' +
        'It must be exactly the integrator name registered in the merchant panel.',
      { userAgent }
    );
  }

  return {
    merchantId,
    password,
    userAgent,
    username: options.username?.trim() || undefined,
    environment,
    baseUrls: resolveBaseUrls(environment, options.baseUrls ?? {}),
    timeoutMs: options.timeoutMs,
  };
}
