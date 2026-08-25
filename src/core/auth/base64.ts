/**
 * Base64-encode a UTF-8 string on every supported runtime.
 *
 * `btoa` exists in browsers, Deno and Workers but is byte-oriented, so the input is UTF-8 encoded
 * first — a service key with a non-ASCII character would otherwise throw `InvalidCharacterError`.
 */
export function encodeBase64(input: string): string {
  const globalBuffer = (globalThis as { Buffer?: { from(s: string, e: string): { toString(e: string): string } } })
    .Buffer;
  if (typeof globalBuffer !== 'undefined') {
    return globalBuffer.from(input, 'utf8').toString('base64');
  }

  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
