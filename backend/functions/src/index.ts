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

import { RequestHandler } from "express";

const getAggregatesHandler: RequestHandler = async (req, res) => {
  const { ticker } = req.params;
  logger.info(`Fetching daily aggregates for index: ${ticker}`);

  if (!ticker) {
    res.status(400).send("Ticker parameter is required");
    return; // Exit function early
  }

  try {
    const today = new Date();
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(today.getDate() - 60);

    const to = today.toISOString().split("T")[0]; // YYYY-MM-DD
    const from = sixtyDaysAgo.toISOString().split("T")[0]; // YYYY-MM-DD

    // Indices often need 'I:' prefix for Polygon API
    const formattedTicker = ticker.startsWith("I:") ? ticker : `I:${ticker}`;

    const aggregates = await polygon.stocks.aggregates(
      formattedTicker,
      1,
      "day",
      from,
      to,
      {
        adjusted: "true",
        sort: "asc",
      }
    );

    if (!aggregates.results) {
      logger.warn(
        `No aggregate data found for ${formattedTicker} from ${from} to ${to}`
      );
      res.json([]); // Send empty array
      return; // Exit function early
    }

    res.json(aggregates.results);
  } catch (error) {
    logger.error(`Error fetching aggregates for ${ticker}:`, error);
    res.status(500).send(`Error fetching aggregate data for ${ticker}`);
  }
};

app.get("/indices/:ticker/aggregates", getAggregatesHandler);

export const api = functions.https.onRequest(app);
