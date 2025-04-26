import * as functions from "firebase-functions";
import express from "express";
import * as logger from "firebase-functions/logger";
import { restClient } from "@polygon.io/client-js";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

const authenticate = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  const idToken = req.headers.authorization?.split("Bearer ")[1];

  if (!idToken) {
    res.status(401).send("Unauthorized: No token provided");
    return;
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    (req as any).user = decodedToken;
    next();
  } catch (error) {
    logger.error("Error verifying Firebase ID token:", error);
    res.status(401).send("Unauthorized: Invalid token");
    return;
  }
};

const polygonApiKey = functions.config().polygon?.key;
if (!polygonApiKey) {
  logger.error(
    "Polygon API key not configured. Run 'firebase functions:config:set polygon.key=\"YOUR_API_KEY\"'"
  );
}
const polygon = restClient(polygonApiKey);

const app = express();
app.use(express.json());

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
      limit: 100,
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
    return;
  }

  try {
    const today = new Date();
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(today.getDate() - 60);

    const to = today.toISOString().split("T")[0];
    const from = sixtyDaysAgo.toISOString().split("T")[0];

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
      res.json([]);
      return;
    }

    res.json(aggregates.results);
  } catch (error) {
    logger.error(`Error fetching aggregates for ${ticker}:`, error);
    res.status(500).send(`Error fetching aggregate data for ${ticker}`);
  }
};

app.get("/indices/:ticker/aggregates", getAggregatesHandler);

app.post(
  "/alerts",
  authenticate,
  async (req: express.Request, res: express.Response) => {
    const userId = (req as any).user.uid;
    const { ticker, threshold, condition } = req.body;

    if (
      !ticker ||
      !threshold ||
      !condition ||
      (condition !== "above" && condition !== "below")
    ) {
      res
        .status(400)
        .send(
          "Missing or invalid alert parameters (ticker, threshold, condition: 'above'|'below')"
        );
      return;
    }

    logger.info(
      `User ${userId} creating alert for ${ticker} ${condition} ${threshold}`
    );

    try {
      const alertData = {
        userId,
        ticker,
        threshold: Number(threshold),
        condition,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      const docRef = await db.collection("alerts").add(alertData);
      res.status(201).json({ id: docRef.id, ...alertData });
      return;
    } catch (error) {
      logger.error(`Error creating alert for user ${userId}:`, error);
      res.status(500).send("Error creating alert");
      return;
    }
  }
);

app.get(
  "/alerts",
  authenticate,
  async (req: express.Request, res: express.Response) => {
    const userId = (req as any).user.uid;
    logger.info(`Fetching alerts for user ${userId}`);

    try {
      const alertsSnapshot = await db
        .collection("alerts")
        .where("userId", "==", userId)
        .orderBy("createdAt", "desc")
        .get();
      const alerts = alertsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      res.json(alerts);
      return;
    } catch (error) {
      logger.error(`Error fetching alerts for user ${userId}:`, error);
      res.status(500).send("Error fetching alerts");
      return;
    }
  }
);

app.delete(
  "/alerts/:alertId",
  authenticate,
  async (req: express.Request, res: express.Response) => {
    const userId = (req as any).user.uid;
    const { alertId } = req.params;
    logger.info(`User ${userId} deleting alert ${alertId}`);

    try {
      const alertRef = db.collection("alerts").doc(alertId);
      const doc = await alertRef.get();

      if (!doc.exists) {
        res.status(404).send("Alert not found");
        return;
      }

      if (doc.data()?.userId !== userId) {
        res.status(403).send("Forbidden: You can only delete your own alerts");
        return;
      }

      await alertRef.delete();
      res.status(200).send(`Alert ${alertId} deleted successfully`);
      return;
    } catch (error) {
      logger.error(
        `Error deleting alert ${alertId} for user ${userId}:`,
        error
      );
      res.status(500).send("Error deleting alert");
      return;
    }
  }
);

export const api = functions.https.onRequest(app);
