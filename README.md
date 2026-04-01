# addons-redash-scanner

A webhook server that receives [Redash](https://redash.io/) alerts and forwards
them as scanner results to AMO. See the [scanner pipeline docs][scanner-pipeline]
for more context.

## Configuration

| Variable                      | Description                                                    |
| ----------------------------- | -------------------------------------------------------------- |
| `WEBHOOK_USER`                | Basic Auth username this service expects from Redash           |
| `WEBHOOK_PASS`                | Basic Auth password this service expects from Redash           |
| `REDASH_USER_API_KEY`         | Redash user API key to fetch query results                     |
| `MAX_RESULTS_TO_PROCESS`      | Maximum number of query result rows to process (default: `10`) |
| `AMO_SCANNER_RESULTS_API_URL` | URL to post scanner results to                                 |
| `AMO_JWT_ISS_KEY`             | JWT issuer key for AMO API authentication                      |
| `AMO_JWT_SECRET`              | JWT secret for AMO API authentication                          |
| `PORT`                        | Port to listen on (default: `20000`)                           |

## Usage

### Redash

1. Create a new alert destination of type "webhook":
   - name: addons-redash-scanner
   - url: the URL to the scanner (e.g. `http://127.0.0.1:20000/redash-webhook`)
   - username: some user name, same as `WEBHOOK_USER`
   - password: some user pass, same as `WEBHOOK_PASS`

2. In a Redash alert, add `addons-redash-scanner` to the list of destinations.

3. Set the alert's description to a JSON object containing the `query_id` to
   fetch results from, e.g.:

   ```json
   { "query_id": 123 }
   ```

Currently, the scanner expects a query that returns rows, with at least a
`version_id` column. Each row (up to `MAX_RESULTS_TO_PROCESS`) will lead to the
creation of a scanner result to indicate that the received alert has fired.

### Scanner

You will need an AMO service account and its JWT credentials (`AMO_JWT_ISS_KEY`
and `AMO_JWT_SECRET`).

```
$ npm install
$ AMO_SCANNER_RESULTS_API_URL=http://olympia.test/api/v5/scanner/results/ \
  AMO_JWT_ISS_KEY="xxx" AMO_JWT_SECRET="xxx" \
  WEBHOOK_USER=redash WEBHOOK_PASS=redash REDASH_USER_API_KEY="xxx" \
  npm start
```

[scanner-pipeline]: https://mozilla.github.io/addons-server/topics/development/scanner_pipeline.html
