import { describe, expect, it, vi } from 'vitest';
import { isSettled, pollBatch, readBatchResult, toFormData } from '../src/index.js';
import { testClient } from './helpers.js';

describe('readBatchResult', () => {
  // The listing service's shape: bare JSON array in, `{ id }` out, `errors[]` on the poll.
  it('reads the listing service shape', () => {
    const result = readBatchResult({
      id: 'e7ab',
      status: 'Done',
      total: 3,
      errors: [{ elementNo: 2, merchantSku: 'ABC-1', errors: ['stok negatif', 'fiyat yok'] }],
    });

    expect(result).toMatchObject({ id: 'e7ab', status: 'Done', total: 3, ok: false });
    expect(result.failed).toEqual([{ elementNo: 2, merchantSku: 'ABC-1', messages: ['stok negatif', 'fiyat yok'] }]);
  });

  // The catalog service's: multipart in, `data.trackingId` out, one `message` per row on the poll.
  it('reads the catalog service shape, including its capitalised keys', () => {
    const result = readBatchResult({
      Id: '9f0c',
      Status: 'Failed',
      Errors: [{ ElementNo: 1, message: 'Kategori zorunlu' }],
    });

    expect(result).toMatchObject({ id: '9f0c', status: 'Failed', ok: false });
    expect(result.failed).toEqual([{ elementNo: 1, messages: ['Kategori zorunlu'] }]);
  });

  // The point of the whole module: rejected rows are a value, not an exception. Throwing would
  // discard the rows that succeeded and make a few bad SKUs look like an outage.
  it('reports a clean run as ok', () => {
    expect(readBatchResult({ id: 'a', status: 'Done', total: 100, errors: [] }).ok).toBe(true);
  });

  it('is not ok while still processing', () => {
    expect(readBatchResult({ id: 'a', status: 'Processing' }).ok).toBe(false);
  });

  it('drops rows that carry no message at all', () => {
    expect(readBatchResult({ id: 'a', status: 'Done', errors: [{ elementNo: 4 }] }).failed).toEqual([]);
  });

  it('defaults to Processing when the service says nothing', () => {
    expect(readBatchResult({}).status).toBe('Processing');
  });

  it('keeps the raw response', () => {
    const body = { id: 'a', status: 'Done', undocumented: 1 };
    expect(readBatchResult(body).raw).toBe(body);
  });
});

describe('isSettled', () => {
  it.each([['Done', true], ['done', true], ['Failed', true], ['Completed', true], ['Processing', false], ['Queued', false]])(
    '%s → %s',
    (status, expected) => {
      expect(isSettled(status)).toBe(expected);
    }
  );
});

describe('pollBatch', () => {
  it('polls until the batch settles', async () => {
    const responses = [{ id: 'a', status: 'Processing' }, { id: 'a', status: 'Processing' }, { id: 'a', status: 'Done' }];
    let call = 0;

    const result = await pollBatch(async () => responses[call++]!, { sleep: async () => {}, intervalMs: 0 });

    expect(result.status).toBe('Done');
    expect(call).toBe(3);
  });

  it('resolves rather than throwing when rows were rejected', async () => {
    const result = await pollBatch(async () => ({ id: 'a', status: 'Done', errors: [{ elementNo: 1, message: 'x' }] }), {
      sleep: async () => {},
    });

    expect(result.ok).toBe(false);
    expect(result.failed).toHaveLength(1);
  });

  it('gives up with a message that says the batch has not failed', async () => {
    let clock = 0;

    await expect(
      pollBatch(async () => ({ id: 'a', status: 'Processing' }), {
        sleep: async () => {
          clock += 1000;
        },
        now: () => clock,
        timeoutMs: 2000,
      })
    ).rejects.toThrow(/still "Processing".*has not failed/s);
  });

  it('honours an abort signal', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(pollBatch(async () => ({}), { signal: controller.signal })).rejects.toThrow(/aborted/);
  });
});

describe('the two submit idioms', () => {
  it('catalog submits multipart with the document as a file field', async () => {
    const { client, http } = testClient({ body: { success: true, code: 0, data: { trackingId: 'abc' } } });

    await client.products.importProducts([{ merchantSku: 'A-1' }] as never);

    expect(http.last.body).toBeInstanceOf(FormData);
    expect(http.last.headers['content-type']).toBeUndefined();
  });

  it('listing submits a bare JSON array', async () => {
    const { client, http } = testClient({ body: { id: 'e7ab' } });

    await client.listings.updateInventory([{ hepsiburadaSku: 'HB-1', price: 120.5 }] as never);

    expect(http.last.headers['content-type']).toBe('application/json');
    expect(JSON.parse(http.last.body as string)).toBeInstanceOf(Array);
  });

  it('toFormData names the part the way the service expects', () => {
    const form = toFormData({ file: { data: '[]', filename: 'products.json' } });

    expect(form.get('file')).toBeInstanceOf(Blob);
    expect((form.get('file') as File).name).toBe('products.json');
  });
});

describe('an integration polling to completion', () => {
  it('reports which rows failed without losing the ones that did not', async () => {
    const { client } = testClient([
      { body: { id: 'e7ab', status: 'Processing' } },
      { body: { id: 'e7ab', status: 'Done', total: 3, errors: [{ elementNo: 3, errors: ['stok negatif'] }] } },
    ]);

    const result = await pollBatch(() => client.listings.inventoryUploadResult('e7ab'), {
      sleep: vi.fn(async () => {}),
    });

    expect(result.total).toBe(3);
    expect(result.ok).toBe(false);
    expect(result.failed[0]?.elementNo).toBe(3);
  });
});
