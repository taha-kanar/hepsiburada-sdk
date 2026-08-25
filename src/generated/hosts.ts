/* eslint-disable */
/**
 * Where each product lives, generated from openapi/manifest.json.
 *
 * The documents' own `servers` blocks all name the sandbox; production hostnames are not
 * published anywhere, because access is granted per merchant through a support ticket. Both
 * are recorded in the manifest so neither is derived at runtime from the other.
 *
 * `sitOnly` marks the two sandbox stubs. Their production names do not resolve, so the client
 * refuses to build one rather than failing later at DNS with nothing to explain it.
 */

export interface ProductHosts {
  readonly sit: string;
  readonly prod: string | null;
  readonly sitOnly?: boolean;
}

export const HOSTS: Readonly<Record<string, ProductHosts>> = {
  "catalog": {
    "sit": "https://mpop-sit.hepsiburada.com/product",
    "prod": "https://mpop.hepsiburada.com/product"
  },
  "product-update": {
    "sit": "https://mpop-sit.hepsiburada.com/ticket-api",
    "prod": "https://mpop.hepsiburada.com/ticket-api"
  },
  "listing": {
    "sit": "https://listing-external-sit.hepsiburada.com",
    "prod": "https://listing-external.hepsiburada.com"
  },
  "promotion": {
    "sit": "https://diskonto-external-sit.hepsiburada.com",
    "prod": "https://diskonto-external.hepsiburada.com"
  },
  "order": {
    "sit": "https://oms-external-sit.hepsiburada.com",
    "prod": "https://oms-external.hepsiburada.com"
  },
  "test-order": {
    "sit": "https://oms-stub-external-sit.hepsiburada.com",
    "prod": null,
    "sitOnly": true
  },
  "shipping": {
    "sit": "https://shipping-external-sit.hepsiburada.com",
    "prod": "https://shipping-external.hepsiburada.com"
  },
  "finance": {
    "sit": "https://mpfinance-external-sit.hepsiburada.com",
    "prod": "https://mpfinance-external.hepsiburada.com"
  },
  "question": {
    "sit": "https://api-asktoseller-merchant-sit.hepsiburada.com",
    "prod": "https://api-asktoseller-merchant.hepsiburada.com"
  },
  "claim-create": {
    "sit": "https://claim-stub-external-sit.hepsiburada.com",
    "prod": null,
    "sitOnly": true
  },
  "claim-list": {
    "sit": "https://oms-external-sit.hepsiburada.com",
    "prod": "https://oms-external.hepsiburada.com"
  },
  "supplier": {
    "sit": "https://supplier-api-external-sit.hepsiburada.com",
    "prod": "https://supplier-api-external.hepsiburada.com"
  }
};
