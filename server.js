import express from "express";
import he from "he";
import safeCompare from "safe-compare";
import { makeJWT } from "addons-scanner-utils";

import pkg from "./package.json" with { type: "json" };

const app = express();
app.use(express.json());

app.post("/redash-webhook", (req, res) => {
  const auth = req.headers.authorization;
  const [user, pass] = auth?.startsWith("Basic ")
    ? Buffer.from(auth.slice(6), "base64").toString().split(":")
    : [];
  if (
    !safeCompare(user ?? "", process.env.REDASH_USER ?? "") ||
    !safeCompare(pass ?? "", process.env.REDASH_PASS ?? "")
  ) {
    return res.status(401).send("Unauthorized");
  }

  const alert = req.body?.alert;
  if (typeof alert !== "object") {
    return res.status(400).end();
  }

  let data;
  try {
    data = JSON.parse(he.unescape(alert.description).replaceAll(`'`, `"`));
  } catch {
    return res.status(400).end();
  }

  const results = {
    version: pkg.version,
    matchedRules: ["ANNOTATIONS"],
    annotations: {
      ANNOTATIONS: [
        {
          message: `Redash alert: ${alert.name}`,
          url: `${req.body.url_base}/queries/${alert.query_id}`,
        },
      ],
    },
  };

  data.forEach(({ version_id }) =>
    fetch(process.env.AMO_SCANNER_RESULTS_API_URL, {
      method: "POST",
      headers: {
        authorization: `JWT ${makeJWT()}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ version_id, results }),
    }).catch((err) => console.error("Failed to post scanner results:", err)),
  );

  return res.status(202).json({ ok: true });
});

export { app };
