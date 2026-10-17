import dotenv from "dotenv";
dotenv.config();

import { createApp } from "./app.js";

const port = process.env.PORT || 4000;
const app = createApp();

app.listen(port, () => {
  console.log(`=======================================================`);
  console.log(`🚀 BridgeOne ERP - Purchase Management API`);
  console.log(`📡 Listening on http://localhost:${port}`);
  console.log(`📘 OpenAPI docs at http://localhost:${port}/api/v1/openapi.json`);
  console.log(`=======================================================`);
});
