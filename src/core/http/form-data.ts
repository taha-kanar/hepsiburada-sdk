/**
 * A file to upload, in whatever shape the runtime offers.
 *
 * `Blob`/`File` work everywhere modern; the object form covers Node buffers and raw bytes, where
 * a filename has to be supplied explicitly because the data carries none.
 */
export type FileInput =
  | Blob
  | {
      data: Blob | ArrayBuffer | ArrayBufferView | string;
      /** Sent as the multipart `filename`. */
      filename: string;
      contentType?: string;
    };

/**
 * Fields accepted by {@link toFormData}. `undefined` entries are skipped.
 *
 * Typed as `object` rather than `Record<string, unknown>` so the generated body interfaces can be
 * passed straight in — interfaces have no implicit index signature.
 */
export type FormFields = object;

function isFileInput(value: unknown): value is FileInput {
  if (typeof Blob !== 'undefined' && value instanceof Blob) return true;
  return typeof value === 'object' && value !== null && 'data' in value && 'filename' in value;
}

function toBlob(file: FileInput): { blob: Blob; filename?: string } {
  if (typeof Blob !== 'undefined' && file instanceof Blob) {
    const filename = (file as File).name;
    return filename ? { blob: file, filename } : { blob: file };
  }

  const { data, filename, contentType } = file as Exclude<FileInput, Blob>;
  if (typeof Blob !== 'undefined' && data instanceof Blob) return { blob: data, filename };
  const parts: BlobPart[] = [data as BlobPart];
  return { blob: new Blob(parts, contentType ? { type: contentType } : undefined), filename };
}

/**
 * Build a `FormData` from a plain object.
 *
 * Scalars are stringified, arrays become repeated fields, and anything shaped like a
 * {@link FileInput} is appended as a file. The `content-type` header is deliberately left unset
 * so the runtime can add the multipart boundary.
 */
export function toFormData(fields: FormFields): FormData {
  const form = new FormData();

  const append = (key: string, value: unknown): void => {
    if (value === undefined || value === null) return;

    if (isFileInput(value)) {
      const { blob, filename } = toBlob(value);
      if (filename) form.append(key, blob, filename);
      else form.append(key, blob);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) append(key, item);
      return;
    }
    if (value instanceof Date) {
      form.append(key, value.toISOString());
      return;
    }
    if (typeof value === 'object') {
      form.append(key, JSON.stringify(value));
      return;
    }
    form.append(key, String(value));
  };

  for (const [key, value] of Object.entries(fields as Record<string, unknown>)) append(key, value);
  return form;
}
