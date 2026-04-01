import { jest } from '@jest/globals';
import request from 'supertest';

jest.unstable_mockModule('addons-scanner-utils/functions/auth', () => ({
  makeJWT: jest.fn().mockReturnValue('test-jwt'),
}));

const mockFetchQueryResults = jest.fn();
jest.unstable_mockModule('./redash.js', () => ({
  fetchQueryResults: mockFetchQueryResults,
}));

const { app } = await import('./server.js');

describe('server.test.js', () => {
  const WEBHOOK_USER = 'redash';
  const WEBHOOK_PASS = 'redash';

  const validAuth =
    'Basic ' +
    Buffer.from(`${WEBHOOK_USER}:${WEBHOOK_PASS}`).toString('base64');

  const validBody = {
    alert: {
      id: 1,
      name: 'Test Alert',
      description: '{"query_id": 2}',
    },
    url_base: 'https://redash.example.com',
  };

  beforeAll(() => {
    process.env.WEBHOOK_USER = WEBHOOK_USER;
    process.env.WEBHOOK_PASS = WEBHOOK_PASS;
    process.env.AMO_SCANNER_RESULTS_API_URL =
      'https://example.com/api/v5/scanner/results/';
  });

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
    mockFetchQueryResults.mockResolvedValue([
      { version_id: 123 },
      { version_id: 456 },
    ]);
  });

  describe('POST /redash-webhook', () => {
    it('returns 401 with no auth header', async () => {
      await request(app).post('/redash-webhook').expect(401);
    });

    it('returns 401 with wrong credentials', async () => {
      const badAuth =
        'Basic ' + Buffer.from('wrong:credentials').toString('base64');
      await request(app)
        .post('/redash-webhook')
        .set('Authorization', badAuth)
        .expect(401);
    });

    it('returns 400 when alert is missing', async () => {
      const res = await request(app)
        .post('/redash-webhook')
        .set('Authorization', validAuth)
        .send({})
        .expect(400);

      expect(res.body).toEqual({ error: 'invalid payload (missing alert)' });
    });

    it('returns 400 when description is not valid JSON', async () => {
      const res = await request(app)
        .post('/redash-webhook')
        .set('Authorization', validAuth)
        .send({
          ...validBody,
          alert: { ...validBody.alert, description: 'not json' },
        })
        .expect(400);

      expect(res.body).toEqual({ error: 'failed to parse alert description' });
    });

    it('returns 400 when description is missing query_id', async () => {
      const res = await request(app)
        .post('/redash-webhook')
        .set('Authorization', validAuth)
        .send({
          ...validBody,
          alert: { ...validBody.alert, description: '{}' },
        })
        .expect(400);

      expect(res.body).toEqual({
        error: 'missing query_id in alert description',
      });
    });

    it('returns 202 with { ok: true } on success', async () => {
      const res = await request(app)
        .post('/redash-webhook')
        .set('Authorization', validAuth)
        .send(validBody)
        .expect(202);

      expect(res.body).toEqual({ ok: true });
    });

    it('calls fetch for each addon in the alert', async () => {
      await request(app)
        .post('/redash-webhook')
        .set('Authorization', validAuth)
        .send(validBody);

      expect(mockFetchQueryResults).toHaveBeenCalledWith(2, validBody.url_base);

      expect(global.fetch).toHaveBeenCalledTimes(2);

      let [url, options] = global.fetch.mock.calls[0];
      expect(url).toBe(process.env.AMO_SCANNER_RESULTS_API_URL);
      expect(options.method).toBe('POST');
      expect(options.headers.authorization).toBe('JWT test-jwt');
      expect(JSON.parse(options.body)).toMatchObject({ version_id: 123 });
      expect(JSON.parse(options.body)).toMatchObject({
        version_id: 123,
        results: {
          matchedRules: ['ANNOTATIONS'],
          annotations: {
            ANNOTATIONS: [
              {
                message: 'Redash alert: Test Alert',
                query_url: 'https://redash.example.com/queries/2',
                alert_url: 'https://redash.example.com/alerts/1',
              },
            ],
          },
        },
      });

      [url, options] = global.fetch.mock.calls[1];
      expect(url).toBe(process.env.AMO_SCANNER_RESULTS_API_URL);
      expect(options.method).toBe('POST');
      expect(options.headers.authorization).toBe('JWT test-jwt');
      expect(JSON.parse(options.body)).toMatchObject({
        version_id: 456,
        results: {
          matchedRules: ['ANNOTATIONS'],
          annotations: {
            ANNOTATIONS: [
              {
                message: 'Redash alert: Test Alert',
                query_url: 'https://redash.example.com/queries/2',
                alert_url: 'https://redash.example.com/alerts/1',
              },
            ],
          },
        },
      });
    });
  });
});
