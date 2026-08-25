import { describe, expect, it, vi } from 'vitest';
import {
  createDriftMiddleware,
  findResponseSchema,
  findSchemaDrift,
  loadSpecDocuments,
  type DriftReport,
  type SchemaDocument,
} from '../src/drift/index.js';
import { testClient } from './helpers.js';

/** An OpenAPI 3 document, as the .NET and Java services publish. */
const OA3: SchemaDocument = {
  components: {
    schemas: {
      Package: {
        type: 'object',
        properties: {
          Id: { type: 'string' },
          Deci: { type: 'number' },
          Status: { type: 'string', enum: ['Shipped', 'Delivered'] },
          Lines: { type: 'array', items: { $ref: '#/components/schemas/Line' } },
        },
      },
      Line: { type: 'object', properties: { sku: { type: 'string' } } },
    },
  },
  paths: {
    '/packages/merchantid/{merchantId}': {
      get: { responses: { '200': { content: { 'application/json': { schema: { $ref: '#/components/schemas/Package' } } } } } },
    },
  },
};

/** A Swagger 2.0 document, as the five Go services publish. */
const SWAGGER: SchemaDocument = {
  definitions: {
    Claim: { type: 'object', properties: { id: { type: 'string' }, quantity: { type: 'integer' } } },
  },
  paths: {
    '/claims/merchantId/{merchantId}': {
      get: { responses: { '200': { schema: { $ref: '#/definitions/Claim' } } } },
    },
  },
};

describe('findResponseSchema', () => {
  it('reads an OpenAPI 3 response, which nests the schema under a media type', () => {
    const found = findResponseSchema(OA3, 'GET', '/packages/merchantid/{merchantId}');

    expect(found?.schemaPath).toEqual([
      'paths',
      '/packages/merchantid/{merchantId}',
      'get',
      'responses',
      '200',
      'content',
      'application/json',
      'schema',
    ]);
  });

  // The reason the two dialects are read rather than converted: five of the twelve products are
  // Swagger 2.0, and putting a conversion step between the document and the finding would mean
  // findings pointed at a file nobody can edit.
  it('reads a Swagger 2.0 response, which puts the schema on the response itself', () => {
    const found = findResponseSchema(SWAGGER, 'GET', '/claims/merchantId/{merchantId}');

    expect(found?.schemaPath).toEqual(['paths', '/claims/merchantId/{merchantId}', 'get', 'responses', '200', 'schema']);
  });

  it('is case-insensitive about the method', () => {
    expect(findResponseSchema(OA3, 'get', '/packages/merchantid/{merchantId}')).toBeDefined();
  });

  it('returns nothing for a path or method the document does not describe', () => {
    expect(findResponseSchema(OA3, 'POST', '/packages/merchantid/{merchantId}')).toBeUndefined();
    expect(findResponseSchema(OA3, 'GET', '/nope')).toBeUndefined();
  });
});

describe('findSchemaDrift', () => {
  // A `$ref`, as the response schemas actually are — resolving it is what moves a finding's
  // schemaPath onto the shared component rather than onto one response.
  const schema = { $ref: '#/components/schemas/Package' };

  it('reports a field the schema does not describe', () => {
    const findings = findSchemaDrift(OA3, schema, { Id: 'a', EtgbNo: 'TR123' });

    expect(findings).toEqual([
      { kind: 'undocumented-field', path: 'EtgbNo', actual: 'string', schemaPath: ['components', 'schemas', 'Package', 'properties', 'EtgbNo'] },
    ]);
  });

  // The schemaPath is what lets a finding become an overlay entry without guessing which schema
  // the field came from — and a Swagger 2.0 finding must point at `definitions`, not at
  // `components.schemas`, or the overlay patches a key that does not exist.
  it('points a Swagger 2.0 finding at definitions', () => {
    const findings = findSchemaDrift(SWAGGER, { $ref: '#/definitions/Claim' }, { id: 'a', reasonCode: 12 });

    expect(findings[0]?.schemaPath).toEqual(['definitions', 'Claim', 'properties', 'reasonCode']);
  });

  it('reports a type the schema contradicts', () => {
    const findings = findSchemaDrift(OA3, schema, { Deci: '1.5' });

    expect(findings[0]).toMatchObject({ kind: 'unexpected-type', path: 'Deci', expected: 'number', actual: 'string' });
  });

  it('accepts a number for an integer', () => {
    expect(findSchemaDrift(SWAGGER, { $ref: '#/definitions/Claim' }, { quantity: 2 })).toEqual([]);
  });

  it('reports a value outside a documented enum', () => {
    const findings = findSchemaDrift(OA3, schema, { Status: 'PartiallyShipped' });

    expect(findings[0]).toMatchObject({ kind: 'unexpected-enum-value', path: 'Status' });
  });

  // Findings are meant to be safe to log in production, so a value must never appear in one.
  it('never reports a value', () => {
    const findings = findSchemaDrift(OA3, schema, { Status: 'a-secret-status', CustomerName: 'Ayşe Yılmaz' });

    expect(JSON.stringify(findings)).not.toContain('Ayşe');
    expect(JSON.stringify(findings)).not.toContain('a-secret-status');
  });

  it('walks into arrays, and stops after the sample', () => {
    const findings = findSchemaDrift(OA3, schema, { Lines: [{ vat: 1 }, { vat: 1 }, { vat: 1 }, { vat: 1 }] }, '', {
      sampleSize: 2,
    });

    expect(findings).toHaveLength(2);
    expect(findings[0]?.path).toBe('Lines[0].vat');
  });

  it('caps the findings a wildly stale schema can produce', () => {
    const payload = Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`f${i}`, 1]));

    expect(findSchemaDrift(OA3, schema, payload, '', { limit: 5 })).toHaveLength(5);
  });

  it('survives a recursive schema', () => {
    const recursive: SchemaDocument = {
      components: { schemas: { Node: { type: 'object', properties: { child: { $ref: '#/components/schemas/Node' } } } } },
    };

    expect(() =>
      findSchemaDrift(recursive, { $ref: '#/components/schemas/Node' }, { child: { child: { child: {} } } })
    ).not.toThrow();
  });

  it('says nothing about a free-form map', () => {
    const free: SchemaDocument = { components: { schemas: { Bag: { type: 'object', additionalProperties: true } } } };

    expect(findSchemaDrift(free, { $ref: '#/components/schemas/Bag' }, { anything: 1 })).toEqual([]);
  });
});

describe('the drift middleware', () => {
  const documents = { order: OA3, 'claim-list': SWAGGER };

  it('reports drift against the document of the module that was called', async () => {
    const reports: DriftReport[] = [];
    const { client } = testClient(
      { body: { Id: 'a', EtgbNo: 'TR1' } },
      { middleware: [createDriftMiddleware({ documents, onDrift: (report) => reports.push(report) })] }
    );

    await client.request({
      operationId: 'getPackages',
      module: 'order',
      method: 'GET',
      path: '/packages/merchantid/{merchantId}',
      pathParams: { merchantId: 'x' },
    });

    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ module: 'order', operationId: 'getPackages', status: 200 });
  });

  // Path templates repeat across the twelve products, so a linear scan would check a response
  // against whichever document happened to be loaded first.
  it('does not check a response against another product’s document', async () => {
    const onDrift = vi.fn();
    const { client } = testClient(
      { body: { Id: 'a', EtgbNo: 'TR1' } },
      { middleware: [createDriftMiddleware({ documents: { 'claim-list': SWAGGER }, onDrift })] }
    );

    await client.request({
      operationId: 'getPackages',
      module: 'order',
      method: 'GET',
      path: '/packages/merchantid/{merchantId}',
      pathParams: { merchantId: 'x' },
    });

    expect(onDrift).not.toHaveBeenCalled();
  });

  it('says nothing when the payload matches', async () => {
    const onDrift = vi.fn();
    const { client } = testClient(
      { body: { Id: 'a', Deci: 1.5 } },
      { middleware: [createDriftMiddleware({ documents, onDrift })] }
    );

    await client.request({
      operationId: 'getPackages',
      module: 'order',
      method: 'GET',
      path: '/packages/merchantid/{merchantId}',
      pathParams: { merchantId: 'x' },
    });

    expect(onDrift).not.toHaveBeenCalled();
  });

  it('leaves a non-JSON body to the transport', async () => {
    const onDrift = vi.fn();
    const { client } = testClient(
      { headers: { 'content-type': 'text/plain' }, body: 'ok' },
      { middleware: [createDriftMiddleware({ documents, onDrift })] }
    );

    await client.request({ operationId: 'x', module: 'order', method: 'GET', path: '/packages/merchantid/{merchantId}', pathParams: { merchantId: 'x' } });

    expect(onDrift).not.toHaveBeenCalled();
  });
});

describe('loadSpecDocuments', () => {
  const documents = loadSpecDocuments(new URL('../openapi/', import.meta.url).pathname);

  it('loads all twelve products, keyed by module', () => {
    expect(Object.keys(documents).sort()).toEqual([
      'catalog',
      'claim-create',
      'claim-list',
      'finance',
      'listing',
      'order',
      'product-update',
      'promotion',
      'question',
      'shipping',
      'supplier',
      'test-order',
    ]);
  });

  it('excludes the files in openapi/ that are not specs', () => {
    expect(documents).not.toHaveProperty('manifest');
    expect(documents).not.toHaveProperty('operations');
  });

  it('loads both dialects as published', () => {
    // Five Go services carry `definitions`; the rest carry `components.schemas`. Neither is
    // converted, so a finding's schemaPath addresses the file as it sits on disk.
    expect(documents['order']?.definitions ?? documents['order']?.components?.schemas).toBeDefined();
    expect(Object.values(documents).some((document) => document.definitions)).toBe(true);
    expect(Object.values(documents).some((document) => document.components?.schemas)).toBe(true);
  });

  it('finds a real response schema in a real document', () => {
    const found = findResponseSchema(documents['order']!, 'GET', '/orders/merchantid/{merchantId}');

    expect(found?.schema).toBeDefined();
  });
});
