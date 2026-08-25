import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { basename, join } from 'node:path';
import type { SchemaDocument } from './compare.js';

/** Files in `openapi/` that are not OpenAPI documents. */
const NON_SPEC = new Set(['manifest.json', 'operations.json', 'verification.json']);

/**
 * The shipped specs, keyed by module name.
 *
 * Keyed rather than listed because twelve independently-authored products share path templates:
 * `/orders/merchantid/{merchantId}` exists in both `order` and `claim-list`, and a linear scan
 * would check a response against whichever document happened to be read first. `request.context`
 * already carries the module, so the lookup is exact.
 */
export type SpecDocuments = Readonly<Record<string, SchemaDocument>>;

/**
 * Load the OpenAPI documents shipped with the package.
 *
 * Node-only, and deliberately so: this is a staging/diagnostics tool, not something to bundle into
 * a browser build. It lives behind the `hepsiburada-sdk/drift` entry point so the main bundle
 * never pulls in `node:fs`.
 *
 * The documents come in two dialects — OpenAPI 3 from the .NET and Java services, Swagger 2.0 from
 * the five Go ones — and are loaded as published, unconverted. {@link findResponseSchema} reads
 * both.
 *
 * @param specsDir Overrides the shipped `openapi/` directory.
 */
export function loadSpecDocuments(specsDir?: string): SpecDocuments {
  const directory = specsDir ?? fileURLToPath(new URL('../openapi/', import.meta.url));
  const documents: Record<string, SchemaDocument> = {};

  for (const file of readdirSync(directory)) {
    if (!file.endsWith('.json') || NON_SPEC.has(file)) continue;
    documents[basename(file, '.json')] = JSON.parse(readFileSync(join(directory, file), 'utf8')) as SchemaDocument;
  }
  return documents;
}
