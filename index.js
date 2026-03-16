import { app } from "./server.js";

const port = process.env.PORT || 20000;

app.listen(port, () => {
  console.log(`addons-redash-scanner is running on port ${port}`);
});
