/**
 * `hepsiburada-sdk/drift` — tools for catching the API drifting away from its spec.
 *
 * Hepsiburada's published documents describe the sandbox, and lag the running service. This entry
 * point is how the gaps are found: compare a real payload to the schema that claims to describe
 * it, and record what is missing.
 *
 * Kept out of the main entry point: {@link loadSpecDocuments} reads from disk, which has no place
 * in a browser bundle.
 */
export {
  findResponseSchema,
  findSchemaDrift,
  type CompareOptions,
  type DriftFinding,
  type DriftKind,
  type JsonSchema,
  type OperationObject,
  type ResponseSchemaLocation,
  type SchemaDocument,
} from './compare.js';
export { loadSpecDocuments, type LoadOptions, type SpecDocuments } from './spec-documents.js';
export { createDriftMiddleware, type DriftMiddlewareOptions, type DriftReport } from './middleware.js';
