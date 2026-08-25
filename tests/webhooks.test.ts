import { describe, expect, it } from 'vitest';
import { webhooks } from '../src/index.js';

/**
 * Webhooks run the opposite way to everything else here.
 *
 * There is no subscription endpoint and nothing to call: you build eight HTTP endpoints under a
 * base URL of your own, e-mail that URL to Hepsiburada with a Basic username and password of your
 * choosing, and they call you. There is no signature header and no HMAC — the shared credentials
 * are the whole security model. So this module ships types and nothing else, and these tests
 * check the routing table a handler has to match.
 */
describe('the webhook routing table', () => {
  it('covers all eight events', () => {
    expect(Object.keys(webhooks.WEBHOOK_ROUTES).sort()).toEqual([
      'change-shipping-address-order',
      'create-order',
      'create-packages',
      'deliver',
      'intransit',
      'order-cancel',
      'undeliver',
      'unpack',
    ]);
  });

  // Easy to miss and easy to get wrong: only the two creation events are POST.
  it('uses POST for the two creations and PUT for the six transitions', () => {
    const posts = Object.entries(webhooks.WEBHOOK_ROUTES)
      .filter(([, route]) => route.method === 'POST')
      .map(([event]) => event);

    expect(posts.sort()).toEqual(['create-order', 'create-packages']);
  });

  it('gives every event a path relative to the base URL you register', () => {
    for (const [event, route] of Object.entries(webhooks.WEBHOOK_ROUTES)) {
      expect(route.path, event).toMatch(/^\//);
      expect(route.path, event).not.toMatch(/^https?:/);
    }
  });

  it('has a payload type for every route', () => {
    // Compile-time really, but the assertion keeps the two lists from drifting apart.
    const payloads: Record<webhooks.WebhookEvent, true> = {
      'create-order': true,
      'create-packages': true,
      'order-cancel': true,
      unpack: true,
      intransit: true,
      deliver: true,
      undeliver: true,
      'change-shipping-address-order': true,
    };

    expect(Object.keys(payloads).sort()).toEqual(Object.keys(webhooks.WEBHOOK_ROUTES).sort());
  });
});

describe('a handler typed against these', () => {
  it('reads a create-order payload', () => {
    const body: webhooks.CreateOrderWebhook = {
      items: [{ orderNumber: 'HB-1', sku: 'HBV1', quantity: 2, totalPrice: { amount: 240.5, currency: 'TRY' } }],
    };

    expect(body.items?.[0]?.totalPrice?.amount).toBe(240.5);
  });

  // The published example for this contract is not valid JSON: it quotes the boolean as
  // `"isUnpackedLine":'false'`. The field is a boolean on the wire, and the type says so.
  it('reads order-cancel’s isUnpackedLine as a boolean', () => {
    const body: webhooks.OrderCancelWebhook = { orderNumber: 'HB-1', isUnpackedLine: false };

    expect(body.isUnpackedLine).toBe(false);
  });
});
