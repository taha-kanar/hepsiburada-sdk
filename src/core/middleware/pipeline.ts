import type { HttpRequest, HttpResponse } from '../http/types.js';
import type { Middleware, Next } from './types.js';

/** Fold a middleware list into a single callable, `terminal` innermost. */
export function composeMiddleware(middleware: readonly Middleware[], terminal: Next): Next {
  return middleware.reduceRight<Next>(
    (next, current) => (request: HttpRequest): Promise<HttpResponse> => current.handle(request, next),
    terminal
  );
}
