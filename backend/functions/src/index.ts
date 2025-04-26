import * as functions from "firebase-functions";
import express from "express";
import * as logger from "firebase-functions/logger";
import { restClient } from "@polygon.io/client-js";

const polygonApiKey = functions.config().polygon?.key;
if (!polygonApiKey) {
  logger.error(
    "Polygon API key not configured. Run 'firebase functions:config:set polygon.key=\"YOUR_API_KEY\"'"
  );
}
const polygon = restClient(polygonApiKey);

const app = express();

app.get("/", (req: express.Request, res: express.Response) => {
  logger.info("API root accessed");
  res.send("Stock Index Tracker API");
});

app.get("/indices", async (req: express.Request, res: express.Response) => {
  logger.info("Fetching indices list");
  try {
    const indices = await polygon.reference.tickers({
      type: "INDEX",
      market: "indices",
      active: "true",
      limit: 100, // Fetch first 100 indices for now
    });
    res.json(indices.results || []);
  } catch (error) {
    logger.error("Error fetching indices from Polygon:", error);
    res.status(500).send("Error fetching stock indices");
  }
});

export const api = functions.https.onRequest(app);
