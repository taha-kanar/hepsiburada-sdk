import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/index.ts', drift: 'src/drift/index.ts', types: 'src/generated/types.ts' },
  format: ['esm', 'cjs'],
  outExtension: ({ format }) => ({ js: format === 'cjs' ? '.cjs' : '.js' }),
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: 'es2022',
  // `types` is a type-only entry point: twelve namespaces, no runtime value. It is separate from
  // `index` because a declaration rollup cannot express a namespace of namespaces — nesting them
  // emits `declare const types_order: typeof order`, which is not legal when `order` is a
  // type-only namespace, and every consumer sees TS2708 from inside index.d.ts. Flat, they roll up
  // correctly.
  // `loadSpecDocuments` locates openapi/ relative to itself, which needs import.meta.url in ESM
  // and __dirname in CJS. tsup's shims paper over the difference.
  shims: true,
  external: ['node:fs', 'node:url', 'node:path'],
});
