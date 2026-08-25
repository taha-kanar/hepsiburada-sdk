import { existsSync, readdirSync, readFileSync } from 'node:fs';
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

/** Options for {@link loadSpecDocuments}. A bare string is still accepted as `specsDir`. */
export interface LoadOptions {
  /** Overrides the shipped `openapi/` directory. */
  specsDir?: string;
  /** Fold in `openapi/overlays/`, so already-recorded gaps are not reported again. Default `true`. */
  overlays?: boolean;
}

/**
 * RFC 7386 JSON Merge Patch — the same form `tools/generate.mjs` applies, so the documents the
 * drift walk compares against are the ones the types were generated from.
 */
function mergePatch(base: unknown, patch: unknown): unknown {
  if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) return patch;
  const target: Record<string, unknown> =
    base && typeof base === 'object' && !Array.isArray(base) ? { ...(base as Record<string, unknown>) } : {};

  for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
    if (value === null) delete target[key];
    else target[key] = mergePatch(target[key], value);
  }
  return target;
}

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
 * Corrections from `openapi/overlays/` are folded in by default, which is what keeps the drift
 * middleware worth running: a gap that has already been recorded, dated and evidenced is not news,
 * and eight known-undocumented fields on every claim would drown the findings that are. Pass
 * `overlays: false` to compare against the documents exactly as Hepsiburada publishes them.
 *
 * @param options `specsDir` overrides the shipped `openapi/` directory; `overlays` folds in the
 *   recorded corrections (default `true`).
 */
export function loadSpecDocuments(options: LoadOptions | string = {}): SpecDocuments {
  const { specsDir, overlays = true } = typeof options === 'string' ? { specsDir: options } : options;
  const directory = specsDir ?? fileURLToPath(new URL('../openapi/', import.meta.url));
  const overlayDir = join(directory, 'overlays');
  const documents: Record<string, SchemaDocument> = {};

  for (const file of readdirSync(directory)) {
    if (!file.endsWith('.json') || NON_SPEC.has(file)) continue;
    const module = basename(file, '.json');
    const document = JSON.parse(readFileSync(join(directory, file), 'utf8')) as SchemaDocument;

    const overlay = join(overlayDir, file);
    documents[module] =
      overlays && existsSync(overlay)
        ? (mergePatch(document, JSON.parse(readFileSync(overlay, 'utf8'))) as SchemaDocument)
        : document;
  }
  return documents;
}
