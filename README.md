# hepsiburada-sdk

Typed TypeScript client for the **Hepsiburada Marketplace API** — 96 operations across twelve
separately-versioned products, with zero runtime dependencies.

> ### Unofficial
>
> This is **not** Hepsiburada's own SDK, and Hepsiburada did not write, review or endorse it. It is
> an independent community project, not affiliated with Hepsiburada in any way. The types are
> generated from Hepsiburada's published OpenAPI documents, but everything else here is third-party
> work — use it at your own risk, and treat Hepsiburada's own documentation as the authority when
> the two differ.

## Install

Not published to npm — install it from the repository:

```bash
npm install github:taha-kanar/hepsiburada-sdk
```

## Quick start

```ts
import { HepsiburadaClient } from 'hepsiburada-sdk';

const client = new HepsiburadaClient({
  merchantId: process.env.HB_MERCHANT_ID!,   // the GUID from the merchant panel
  password: process.env.HB_SERVICE_KEY!,     // servis anahtarı
  userAgent: process.env.HB_INTEGRATOR!,     // your registered integrator name, exactly
});

const orders = await client.orders.list({ begindate: new Date(Date.now() - 3_600_000) });
```

## What it handles for you

Three mistakes account for nearly every failed Hepsiburada integration. All three answer `401`, and
none of them is a credential problem — the SDK gets all three right from your config:

- **The `User-Agent` is a credential.** It must be *exactly* the integrator name registered in your
  panel. Every decorated variant — `{merchantId} - {name}`, `{name}/1.0` — is a 401.
- **The Basic-auth username is your merchant id**, not your username.
- **Some services want the merchant id in a header** instead of the path.

Also handled: dates that answer 200 while returning the wrong window, six paging dialects across
four envelope shapes, partial failure reported inside a successful bulk write, and per-product base
URLs. Types are generated from the specs under [`openapi/`](./openapi); where the specs and the live
API disagree, the correction is an overlay carrying evidence, not an edit to generated code.

## Development

```bash
npm install
npm run generate    # specs → src/generated/
npm run typecheck
npm test
npm run build
```

## License

MIT
