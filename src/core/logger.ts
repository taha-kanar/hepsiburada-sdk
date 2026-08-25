/** Minimal logging surface — anything with these three methods fits (pino, console, …). */
export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

/** Default logger: drops everything. Keeps call sites free of `if (logger)`. */
export const silentLogger: Logger = {
  debug: () => {},
  warn: () => {},
  error: () => {},
};

/** Adapter over the global `console`, for quick debugging. */
export const consoleLogger: Logger = {
  debug: (message, meta) => console.debug(`[hepsiburada] ${message}`, meta ?? ''),
  warn: (message, meta) => console.warn(`[hepsiburada] ${message}`, meta ?? ''),
  error: (message, meta) => console.error(`[hepsiburada] ${message}`, meta ?? ''),
};
