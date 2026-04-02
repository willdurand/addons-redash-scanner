import { jest } from '@jest/globals';

const { fetchQueryResults } = await import('./redash.js');

describe('redash.test.js', () => {
  const BASE_URL = 'https://redash.example.com';
  const QUERY_ID = 42;

  beforeAll(() => {
    process.env.REDASH_USER_API_KEY = 'test-api-key';
  });

  beforeEach(() => {});

  it('fetches the query rows and returns them', async () => {
    const rows = [{ version_id: 1 }, { version_id: 2 }];
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        query_result: { data: { rows } },
      }),
    });

    const results = await fetchQueryResults(QUERY_ID, BASE_URL);

    expect(global.fetch).toHaveBeenCalledWith(
      `${BASE_URL}/api/queries/${QUERY_ID}/results`,
      { headers: { Authorization: 'Key test-api-key' } },
    );
    expect(results).toEqual(rows);
  });

  it('returns an empty array when rows are missing', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({}),
    });

    const result = await fetchQueryResults(QUERY_ID, BASE_URL);

    expect(result).toEqual([]);
  });

  it('throws when the response is not ok', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false });

    await expect(fetchQueryResults(QUERY_ID, BASE_URL)).rejects.toThrow(
      `failed to fetch the query results for ${QUERY_ID}`,
    );
  });
});
