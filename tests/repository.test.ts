import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = new URL('..', import.meta.url).pathname;
const SKIP = new Set(['node_modules', 'dist', '.git', 'coverage', '.turbo']);

function* files(directory: string): Generator<string> {
  for (const entry of readdirSync(directory)) {
    if (SKIP.has(entry)) continue;
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) yield* files(full);
    else yield full;
  }
}

const tracked = [...files(ROOT)];

/**
 * Nothing in this repository may carry a real credential.
 *
 * The SDK was built against a live production account, and the merchant id, service key and
 * integrator name were supplied in conversation. None of them belongs in a file — not in a
 * fixture, not in an example, not in a committed observation. This test is the mechanical check
 * that runs before every commit, because the careful check is the one that eventually gets
 * skipped.
 */
describe('no credentials in the tree', () => {
  const sources = tracked
    .filter((file) => /\.(ts|mjs|js|json|md|yml|yaml)$/.test(file))
    .filter((file) => !file.endsWith('package-lock.json'))
    .map((file) => ({ file: relative(ROOT, file), text: readFileSync(file, 'utf8') }));

  /** GUIDs that are provably not anyone's account. */
  const FIXTURE_GUIDS = new Set(['00000000-0000-4000-8000-000000000001']);

  it('contains no GUID outside the vendored specs and the fixtures', () => {
    // Every real Hepsiburada merchant id is a GUID, so any GUID in a hand-written file is either
    // a fixture on this list or a leak. `openapi/` is excluded because it holds Hepsiburada's own
    // documents committed as published — their examples are theirs, and editing them would
    // destroy the diff that makes a vendor change visible.
    const offenders: string[] = [];

    for (const { file, text } of sources) {
      if (file.startsWith('openapi/')) continue;

      for (const match of text.matchAll(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi)) {
        if (!FIXTURE_GUIDS.has(match[0].toLowerCase())) offenders.push(`${file}: ${match[0]}`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('contains no obvious secret assignment', () => {
    const offenders: string[] = [];
    const pattern = /(?:password|secret|serviceKey|servis[Aa]nahtari|apiKey|token)\s*[:=]\s*['"]([^'"]{12,})['"]/g;
    const allowed = /^(?:test-service-key|<[^>]+>|\$\{[^}]+\}|process\.env|xxx+|your-|change-?me|\.\.\.)/i;

    for (const { file, text } of sources) {
      for (const match of text.matchAll(pattern)) {
        if (!allowed.test(match[1]!)) offenders.push(`${file}: ${match[0]}`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('contains no .env file', () => {
    expect(tracked.map((file) => relative(ROOT, file)).filter((file) => /(^|\/)\.env/.test(file))).toEqual([]);
  });
});

describe('overlay discipline', () => {
  const directory = join(ROOT, 'openapi/overlays');
  const overlays = readdirSync(directory).filter((file) => file.endsWith('.json'));

  it('has at least one overlay to check', () => {
    expect(overlays.length).toBeGreaterThan(0);
  });

  /**
   * Every correction must say when it was seen and how.
   *
   * An overlay entry overrides Hepsiburada's own document, so it needs to be falsifiable: the
   * date says when it was true, the evidence says what to re-run to check. Without both, a
   * correction that stops being true is indistinguishable from one that never was — and the
   * temptation is to add an entry because a shape "looks wrong", which is how a leading-zero SKU
   * ends up typed as a number.
   */
  it.each(overlays)('%s dates and evidences every entry', (file) => {
    const document = JSON.parse(readFileSync(join(directory, file), 'utf8')) as Record<string, unknown>;
    const missing: string[] = [];

    const walk = (node: unknown, path: string): void => {
      if (!node || typeof node !== 'object' || Array.isArray(node)) return;
      const record = node as Record<string, unknown>;

      const corrections = Object.keys(record).filter((key) => key.startsWith('x-') && !key.startsWith('x-observed') && key !== 'x-overlay-note');
      if (corrections.length) {
        if (!record['x-observed']) missing.push(`${path}: no x-observed`);
        if (!record['x-observed-evidence']) missing.push(`${path}: no x-observed-evidence`);
      }
      for (const [key, value] of Object.entries(record)) walk(value, `${path}/${key}`);
    };

    walk(document, file);
    expect(missing).toEqual([]);
  });

  it.each(overlays)('%s dates every entry as a real date', (file) => {
    const text = readFileSync(join(directory, file), 'utf8');

    for (const match of text.matchAll(/"x-observed":\s*"([^"]+)"/g)) {
      expect(match[1], `${file} has an unparseable x-observed`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('patches paths the document actually has', () => {
    // An overlay keyed on a path that no longer exists is a silent no-op — exactly the failure
    // this whole mechanism is meant to make visible.
    for (const file of overlays) {
      const overlay = JSON.parse(readFileSync(join(directory, file), 'utf8')) as { paths?: Record<string, unknown> };
      const spec = JSON.parse(readFileSync(join(ROOT, 'openapi', file), 'utf8')) as { paths?: Record<string, unknown> };

      for (const path of Object.keys(overlay.paths ?? {})) {
        expect(spec.paths, `${file} patches ${path}, which the spec does not have`).toHaveProperty([path]);
      }
    }
  });
});

describe('the vendored specs', () => {
  it('are committed as published, so a Hepsiburada change shows up as a diff', () => {
    const manifest = JSON.parse(readFileSync(join(ROOT, 'openapi/manifest.json'), 'utf8')) as {
      products: Array<{ module: string; operations: number }>;
    };

    for (const product of manifest.products) {
      const spec = JSON.parse(readFileSync(join(ROOT, `openapi/${product.module}.json`), 'utf8')) as {
        paths?: Record<string, Record<string, unknown>>;
      };
      const count = Object.values(spec.paths ?? {}).reduce((total, item) => total + Object.keys(item).length, 0);

      expect(count, `${product.module} has ${count} operations, manifest says ${product.operations}`).toBe(
        product.operations
      );
    }
  });

  it('never records a sandbox host as a production one', () => {
    const manifest = JSON.parse(readFileSync(join(ROOT, 'openapi/manifest.json'), 'utf8')) as {
      products: Array<{ module: string; sit: string; prod: string | null }>;
    };

    for (const product of manifest.products) {
      expect(product.sit, product.module).toContain('-sit');
      if (product.prod !== null) expect(product.prod, product.module).not.toContain('-sit');
    }
  });
});

/**
 * The live probe may only ever read.
 *
 * `tools/observe.mjs` runs with a real seller's production credentials against an account with
 * real orders in it. Its allowlist is enforced by a middleware at run time; this is the check that
 * the list itself never acquires an entry that is not a published GET — because the review that
 * would catch it is the one that gets skipped at 2am.
 */
describe('the observation tool', () => {
  const source = readFileSync(join(ROOT, 'tools/observe.mjs'), 'utf8');
  const published = JSON.parse(readFileSync(join(ROOT, 'openapi/operations.json'), 'utf8')) as Array<{
    module: string;
    operationId: string;
    method: string;
    path: string;
  }>;

  const probes = [...source.matchAll(/\{ module: '([^']+)', operationId: '([^']+)', path: '([^']+)'/g)].map(
    (match) => ({ module: match[1]!, operationId: match[2]!, path: match[3]! })
  );

  it('has probes to check', () => {
    expect(probes.length).toBeGreaterThan(5);
  });

  it.each(probes.map((probe) => [`${probe.module}.${probe.operationId}`, probe] as const))(
    '%s is a published GET at the path it claims',
    (_label, probe) => {
      const found = published.find((op) => op.module === probe.module && op.operationId === probe.operationId);

      expect(found, 'no such published operation').toBeDefined();
      expect(found!.method).toBe('GET');
      expect(found!.path).toBe(probe.path);
    }
  );

  it('refuses anything that is not on the allowlist', () => {
    expect(source).toMatch(/request\.method !== 'GET' \|\| !ALLOWED\.has\(key\)/);
  });

  it('redacts the field names that carry personal data', () => {
    const pattern = /const SENSITIVE = \/([^/]+)\//.exec(source)?.[1] ?? '';

    for (const field of ['name', 'email', 'phone', 'address', 'identity', 'kimlik', 'vergi', 'iban']) {
      expect(pattern, `${field} is not redacted`).toContain(field);
    }
  });
});

/**
 * The type entry point must stay type-only.
 *
 * `hepsiburada-sdk/types` is twelve namespaces and no runtime value, and that is load-bearing
 * rather than tidy: a declaration rollup cannot express a namespace of namespaces, so nesting
 * them under one export emits `declare const types_order: typeof order` — not legal TypeScript
 * when `order` is type-only — and every consumer sees TS2708 from inside `index.d.ts`. The
 * published package typechecks only while this file is flat and free of values.
 */
describe('the type entry point', () => {
  const source = readFileSync(join(ROOT, 'src/generated/types.ts'), 'utf8');
  const statements = source.split('\n').filter((line) => line.startsWith('export'));

  it('exports nothing but type-only namespaces', () => {
    expect(statements.length).toBe(12);
    for (const statement of statements) expect(statement).toMatch(/^export type \* as \w+ from '\.\/[\w-]+\.js';$/);
  });

  it('is not re-exported as a nested namespace from the main entry point', () => {
    const index = readFileSync(join(ROOT, 'src/index.ts'), 'utf8');

    expect(index).not.toMatch(/export (?:type )?\* as \w+ from '\.\/generated\/types\.js'/);
  });

  it('is a published entry point, so consumers can reach it', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
      exports: Record<string, unknown>;
    };

    expect(pkg.exports).toHaveProperty(['./types']);
  });
});

describe('the generated tree', () => {
  /**
   * Running the generator must be a no-op on a clean tree.
   *
   * The types are generated and the resources are hand-written, which only works while the two
   * agree. This is the check that they do: if the committed output differs from what the
   * generator produces, either someone edited a generated file by hand or the vendored specs
   * moved without the output being refreshed.
   */
  it('is regenerable — running the generator changes nothing', () => {
    const outputs = [
      ...readdirSync(join(ROOT, 'src/generated')).map((file) => join(ROOT, 'src/generated', file)),
      join(ROOT, 'openapi/operations.json'),
    ];
    const before = new Map(outputs.map((file) => [file, readFileSync(file, 'utf8')]));

    execFileSync('node', ['tools/generate.mjs'], { cwd: ROOT, stdio: 'pipe' });

    const changed = outputs.filter((file) => readFileSync(file, 'utf8') !== before.get(file)).map((file) => relative(ROOT, file));

    expect(changed).toEqual([]);
  });
});

describe('overlays reach the generated types', () => {
  // The mechanism failed silently once: overlays were merged *after* the document was normalised
  // into one internal shape, so `components.schemas`/`definitions` corrections patched a copy the
  // generator no longer read. Every schema correction was counted in the summary line and then
  // dropped. Nothing failed — the types were simply still wrong, which is the exact class of
  // problem overlays exist to prevent. So the round trip is asserted, not assumed.
  const directory = join(ROOT, 'openapi/overlays');
  const overlays = readdirSync(directory).filter((file) => file.endsWith('.json'));

  it.each(overlays)('%s: every property it adds appears in the generated module', (file) => {
    const overlay = JSON.parse(readFileSync(join(directory, file), 'utf8')) as Record<string, unknown>;
    const module = file.replace(/\.json$/, '');
    const generated = readFileSync(join(ROOT, `src/generated/${module}.ts`), 'utf8');

    const added: string[] = [];
    const walk = (node: unknown, inProperties: boolean): void => {
      if (!node || typeof node !== 'object' || Array.isArray(node)) return;
      for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        // A `null` value is a deletion, which by definition must NOT appear.
        if (inProperties && value !== null) added.push(key);
        walk(value, key === 'properties');
      }
    };
    walk(overlay, false);

    const missing = added.filter((name) => !new RegExp(`\\b${name}\\??:`).test(generated));
    expect(missing, `${file} patches fields that never reached src/generated/${module}.ts`).toEqual([]);
  });

  it.each(overlays)('%s: every property it deletes is gone from the generated module', (file) => {
    const overlay = JSON.parse(readFileSync(join(directory, file), 'utf8')) as Record<string, unknown>;
    const module = file.replace(/\.json$/, '');
    const generated = readFileSync(join(ROOT, `src/generated/${module}.ts`), 'utf8');

    // Scoped to the interface the entry patches, not the whole file: `data` and `name` are
    // ordinary property names that other schemas in the same product legitimately have. The
    // generator PascalCases a schema name and drops the Swagger `model.` prefix, so `model.Claim`
    // becomes `interface Claim`.
    const schemas = {
      ...((overlay['components'] as { schemas?: Record<string, unknown> })?.schemas ?? {}),
      ...((overlay['definitions'] as Record<string, unknown>) ?? {}),
    };

    const survivors: string[] = [];
    for (const [schemaName, schema] of Object.entries(schemas)) {
      const properties = (schema as { properties?: Record<string, unknown> }).properties ?? {};
      const deleted = Object.entries(properties).filter(([, value]) => value === null).map(([key]) => key);
      if (!deleted.length) continue;

      const typeName = schemaName.split('.').pop()!.replace(/^(.)/, (chr) => chr.toUpperCase());
      const block = new RegExp(`export interface ${typeName} \\{([\\s\\S]*?)\\n\\}`).exec(generated);
      expect(block, `${file} patches ${schemaName}, which generated no interface ${typeName}`).not.toBeNull();

      for (const name of deleted) {
        if (new RegExp(`^\\s+${name}\\??:`, 'm').test(block![1]!)) survivors.push(`${typeName}.${name}`);
      }
    }

    expect(survivors, `${file} deletes fields that are still generated`).toEqual([]);
  });
});

describe('the live verification report', () => {
  const report = JSON.parse(readFileSync(join(ROOT, 'openapi/verification.json'), 'utf8')) as {
    environment: string;
    probes: Record<string, { status?: number; shape?: unknown; host?: string }>;
  };

  it('records production, not the sandbox', () => {
    expect(report.environment).toBe('production');
    for (const [label, probe] of Object.entries(report.probes)) {
      expect(probe.host, `${label} was probed against a -sit host`).not.toMatch(/-sit\./);
    }
  });

  it('carries shapes and never values', () => {
    // The probe runs against a live seller with real orders. The report is committed, so the
    // rule is structural: every leaf must be a type name, a count, or a redaction marker.
    const leaves: string[] = [];
    const walk = (node: unknown): void => {
      if (typeof node === 'string') leaves.push(node);
      else if (node && typeof node === 'object') for (const value of Object.values(node)) walk(value);
    };
    walk(Object.fromEntries(Object.entries(report.probes).map(([label, probe]) => [label, probe.shape])));

    const legal = /^(string|number|boolean|object|array|null|undefined)( \(redacted\))?( \(optional\))?$|^array\(\d+\)$/;
    const values = leaves.filter((leaf) => !leaf.split(' | ').every((part) => legal.test(part.trim())));
    expect(values, 'verification.json contains something that is not a type name').toEqual([]);
  });

  it('answered every probe', () => {
    for (const [label, probe] of Object.entries(report.probes)) {
      expect(probe.status, `${label} did not answer 200`).toBe(200);
    }
  });
});

describe('nothing observed is left unrecorded', () => {
  it('every difference the live pass found is in openapi/overlays/', () => {
    // The report counts findings twice: against the documents as published, and against them with
    // the overlays folded in. A non-zero second number means production sends something no
    // overlay explains — so the generated types are, right now, describing a response that does
    // not exist. Committing that state should fail the build, not wait to be noticed.
    const report = JSON.parse(readFileSync(join(ROOT, 'openapi/verification.json'), 'utf8')) as {
      probes: Record<string, { unrecorded?: number }>;
    };

    const open = Object.entries(report.probes)
      .filter(([, probe]) => (probe.unrecorded ?? 0) > 0)
      .map(([label, probe]) => `${label}: ${probe.unrecorded}`);

    expect(open, 'run `npm run observe -- --write` and write the findings up as overlays').toEqual([]);
  });
});
