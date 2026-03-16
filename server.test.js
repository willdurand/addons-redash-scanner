import { jest } from "@jest/globals";
import request from "supertest";

jest.unstable_mockModule("addons-scanner-utils", () => ({
  makeJWT: jest.fn().mockReturnValue("test-jwt"),
}));

const { app } = await import("./server.js");

describe("server.test.js", () => {
  const REDASH_USER = "redash";
  const REDASH_PASS = "redash";

  const validAuth =
    "Basic " + Buffer.from(`${REDASH_USER}:${REDASH_PASS}`).toString("base64");

  const validBody = {
    alert: {
      name: "Test Alert",
      query_id: 2,
      description:
        "[{&#x27;version_id&#x27;: 123}, {&#x27;version_id&#x27;: 456}]",
    },
    url_base: "https://redash.example.com",
  };

  beforeAll(() => {
    process.env.REDASH_USER = REDASH_USER;
    process.env.REDASH_PASS = REDASH_PASS;
    process.env.AMO_SCANNER_RESULTS_API_URL =
      "https://example.com/api/v5/scanner/results/";
  });

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
  });

  describe("POST /redash-webhook", () => {
    it("returns 401 with no auth header", async () => {
      await request(app).post("/redash-webhook").expect(401);
    });

    it("returns 401 with wrong credentials", async () => {
      const badAuth =
        "Basic " + Buffer.from("wrong:credentials").toString("base64");
      await request(app)
        .post("/redash-webhook")
        .set("Authorization", badAuth)
        .expect(401);
    });

    it("returns 400 when alert is missing", async () => {
      await request(app)
        .post("/redash-webhook")
        .set("Authorization", validAuth)
        .send({})
        .expect(400);
    });

    it("returns 400 when description cannot be parsed", async () => {
      await request(app)
        .post("/redash-webhook")
        .set("Authorization", validAuth)
        .send({ alert: { name: "Test", description: "not valid json" } })
        .expect(400);
    });

    it("returns 202 with { ok: true } on success", async () => {
      const res = await request(app)
        .post("/redash-webhook")
        .set("Authorization", validAuth)
        .send(validBody)
        .expect(202);

      expect(res.body).toEqual({ ok: true });
    });

    it("calls fetch for each addon in the alert", async () => {
      await request(app)
        .post("/redash-webhook")
        .set("Authorization", validAuth)
        .send(validBody);

      expect(global.fetch).toHaveBeenCalledTimes(2);

      let [url, options] = global.fetch.mock.calls[0];
      expect(url).toBe(process.env.AMO_SCANNER_RESULTS_API_URL);
      expect(options.method).toBe("POST");
      expect(options.headers.authorization).toBe("JWT test-jwt");
      expect(JSON.parse(options.body)).toMatchObject({ version_id: 123 });
      expect(JSON.parse(options.body)).toMatchObject({
        version_id: 123,
        results: {
          matchedRules: ["ANNOTATIONS"],
          annotations: {
            ANNOTATIONS: [
              {
                message: "Redash alert: Test Alert",
                url: "https://redash.example.com/queries/2",
              },
            ],
          },
        },
      });

      [url, options] = global.fetch.mock.calls[1];
      expect(url).toBe(process.env.AMO_SCANNER_RESULTS_API_URL);
      expect(options.method).toBe("POST");
      expect(options.headers.authorization).toBe("JWT test-jwt");
      expect(JSON.parse(options.body)).toMatchObject({
        version_id: 456,
        results: {
          matchedRules: ["ANNOTATIONS"],
          annotations: {
            ANNOTATIONS: [
              {
                message: "Redash alert: Test Alert",
                url: "https://redash.example.com/queries/2",
              },
            ],
          },
        },
      });
    });
  });
});
