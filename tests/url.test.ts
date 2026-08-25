import { describe, expect, it } from 'vitest';
import { expandPath, joinUrl, serializeQuery } from '../src/index.js';

describe('expandPath', () => {
  it('substitutes and URL-encodes', () => {
    expect(expandPath('/orders/merchantid/{merchantId}', { merchantId: 'a b/c' })).toBe('/orders/merchantid/a%20b%2Fc');
  });

  it('accepts numbers', () => {
    expect(expandPath('/categories/{id}', { id: 18021982 })).toBe('/categories/18021982');
  });

  // Better a refusal here than a live request against `/merchantid/undefined`, which several
  // Hepsiburada hosts answer with a 200 and an empty page.
  it.each([undefined, ''])('refuses a missing value (%p)', (value) => {
    expect(() => expandPath('/orders/merchantid/{merchantId}', { merchantId: value }, 'getOrders')).toThrow(
      /Missing path parameter "merchantId" for getOrders/
    );
  });

  it('leaves a template with no placeholders alone', () => {
    expect(expandPath('/orders')).toBe('/orders');
  });
});

describe('joinUrl', () => {
  it.each([
    ['https://h.test', '/a', 'https://h.test/a'],
    ['https://h.test/', '/a', 'https://h.test/a'],
    ['https://h.test/product', 'api/x', 'https://h.test/product/api/x'],
    ['https://h.test//', '//a', 'https://h.test/a'],
  ])('%s + %s', (base, path, expected) => {
    expect(joinUrl(base, path)).toBe(expected);
  });
});

describe('serializeQuery', () => {
  it('drops undefined and null', () => {
    // Not tidiness: several endpoints reject a blank filter, and the order endpoints accept a date
    // they cannot parse and answer 200 with nothing.
    expect(serializeQuery({ a: 1, b: undefined, c: null })).toBe('a=1');
  });

  it('keeps zero, false and the empty string', () => {
    expect(serializeQuery({ offset: 0, active: false, q: '' })).toBe('offset=0&active=false&q=');
  });

  it('joins arrays with commas, which is what skuList expects', () => {
    expect(serializeQuery({ skuList: ['a', 'b'] })).toBe('skuList=a%2Cb');
  });

  it('can repeat them instead', () => {
    expect(serializeQuery({ skuList: ['a', 'b'] }, 'repeat')).toBe('skuList=a&skuList=b');
  });

  it('drops an empty array entirely', () => {
    expect(serializeQuery({ skuList: [] })).toBe('');
  });

  it('percent-encodes Turkish characters', () => {
    expect(serializeQuery({ q: 'çğıöşü' })).toBe('q=%C3%A7%C4%9F%C4%B1%C3%B6%C5%9F%C3%BC');
  });
});
