import * as functions from "firebase-functions";
import express from "express";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import sgMail from "@sendgrid/mail";
import { onSchedule, ScheduledEvent } from "firebase-functions/v2/scheduler";
import axios from "axios"; // Import axios

admin.initializeApp();
const db = admin.firestore();

const sendgridApiKey = functions.config().sendgrid?.key;
const sendgridSender = functions.config().sendgrid?.sender;

if (!sendgridApiKey || !sendgridSender) {
  logger.error(
    "SendGrid API key or sender email not configured. Run 'firebase functions:config:set sendgrid.key=...' and 'firebase functions:config:set sendgrid.sender=...'"
  );
} else {
  sgMail.setApiKey(sendgridApiKey);
}

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

const polygonApiBaseUrl = "https://api.polygon.io";

const app = express();
app.use(express.json());

app.get("/", (req: express.Request, res: express.Response) => {
  logger.info("API root accessed");
  res.send("Stock Index Tracker API");
});

app.get("/indices", async (req: express.Request, res: express.Response) => {
  const cursorUrl = req.query.cursor as string | undefined;
  const searchTerm = req.query.search as string | undefined;
  logger.info(
    `Fetching indices list. Cursor: ${cursorUrl || "None"}, Search: ${
      searchTerm || "None"
    }`
  );

  try {
    let url: string;
    const headers = { Authorization: `Bearer ${polygonApiKey}` };

    if (cursorUrl) {
      // Use the next_url directly if provided
      url = cursorUrl;
    } else {
      // Construct the initial URL
      const params = new URLSearchParams({
        market: "indices",
        active: "true",
        limit: "100",
        sort: "ticker",
        order: "asc",
      });
      if (searchTerm) {
        params.append("search", searchTerm);
      }
      url = `${polygonApiBaseUrl}/v3/reference/tickers?${params.toString()}`;
    }

    const response = await axios.get(url, { headers });

    res.json({
      results: response.data.results || [],
      next_url: response.data.next_url || null,
    });
  } catch (error: any) {
    logger.error("Error fetching indices from Polygon:", error);
    const status = error.response?.status;
    const errorMessage =
      error.response?.data?.message || error.message || "Unknown Polygon Error";
    const requestId = error.response?.data?.request_id;

    if (status === 429) {
      res
        .status(429)
        .send("Polygon API rate limit exceeded. Please try again later.");
    } else if (status === 403) {
      res
        .status(403)
        .send(
          `Polygon API Authorization Error: ${errorMessage}${
            requestId ? ` (Request ID: ${requestId})` : ""
          }`
        );
    } else if (status === 503) {
      res
        .status(503)
        .send(
          `Polygon API Error: ${errorMessage}${
            requestId ? ` (Request ID: ${requestId})` : ""
          }`
        );
    } else {
      res
        .status(500)
        .send(
          "An internal server error occurred while fetching stock indices."
        );
    }
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

    const url = `${polygonApiBaseUrl}/v2/aggs/ticker/${formattedTicker}/range/1/day/${from}/${to}`;
    const params = { adjusted: "true", sort: "asc" };
    const headers = { Authorization: `Bearer ${polygonApiKey}` };

    const response = await axios.get(url, { params, headers });

    if (!response.data.results) {
      logger.warn(
        `No aggregate data found for ${formattedTicker} from ${from} to ${to}`
      );
      res.json([]);
      return;
    }

    res.json(response.data.results);
  } catch (error: any) {
    logger.error(`Error fetching aggregates for ${ticker}:`, error);
    const status = error.response?.status;
    const errorMessage =
      error.response?.data?.message || error.message || "Unknown Polygon Error";
    const requestId = error.response?.data?.request_id;

    if (status === 429) {
      res
        .status(429)
        .send(
          `Polygon API rate limit exceeded. Please try again later. ${
            requestId ? ` (Request ID: ${requestId})` : ""
          }`
        );
    } else if (status === 403) {
      res
        .status(403)
        .send(
          `Data entitlement required. Upgrade Polygon plan for index aggregates. ${
            requestId ? ` (Request ID: ${requestId})` : ""
          }`
        );
    } else if (status === 503) {
      res
        .status(503)
        .send(
          `Polygon API Error: ${errorMessage}${
            requestId ? ` (Request ID: ${requestId})` : ""
          }`
        );
    } else {
      res
        .status(500)
        .send(
          `An internal server error occurred while fetching aggregate data for ${ticker}.`
        );
    }
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

export const checkPriceAlerts = onSchedule(
  "every 24 hours",
  async (event: ScheduledEvent) => {
    logger.info("Running scheduled check for price alerts");

    if (!sendgridApiKey || !sendgridSender) {
      logger.error("SendGrid not configured, skipping alert check.");
      return;
    }

    const alertsSnapshot = await db.collection("alerts").get();
    if (alertsSnapshot.empty) {
      logger.info("No active alerts found.");
      return;
    }

    const promises = alertsSnapshot.docs.map(async (doc) => {
      const alert = { id: doc.id, ...doc.data() } as any;
      const ticker = alert.ticker;
      const threshold = alert.threshold;
      const condition = alert.condition;
      const userId = alert.userId;

      try {
        const formattedTicker = ticker.startsWith("I:")
          ? ticker
          : `I:${ticker}`;

        const url = `${polygonApiBaseUrl}/v2/last/trade/${formattedTicker}`; // Using Last Trade endpoint
        const headers = { Authorization: `Bearer ${polygonApiKey}` };
        const response = await axios.get(url, { headers });

        if (
          !response.data ||
          !response.data.results ||
          !response.data.results.p
        ) {
          logger.warn(`Could not get last trade price for ${formattedTicker}`);
          return;
        }
        const currentPrice = response.data.results.p;

        logger.info(
          `Checking alert ${alert.id}: ${formattedTicker} - Current Price: ${currentPrice}, Condition: ${condition} ${threshold}`
        );

        let conditionMet = false;
        if (condition === "above" && currentPrice > threshold) {
          conditionMet = true;
        } else if (condition === "below" && currentPrice < threshold) {
          conditionMet = true;
        }

        if (conditionMet) {
          logger.info(
            `Alert condition met for ${alert.id}. Sending notification.`
          );

          const userRecord = await admin.auth().getUser(userId);
          const userEmail = userRecord.email;

          if (!userEmail) {
            logger.error(`Could not find email for user ${userId}`);
            return;
          }

          const msg = {
            to: userEmail,
            from: sendgridSender,
            subject: `Price Alert Triggered for ${ticker}`,
            text: `Your price alert for ${ticker} has been triggered.\nCondition: Price ${condition} ${threshold}\nCurrent Price: ${currentPrice}`,
            html: `<strong>Your price alert for ${ticker} has been triggered.</strong><br>Condition: Price ${condition} ${threshold}<br>Current Price: ${currentPrice}`,
          };

          await sgMail.send(msg);
          logger.info(
            `Notification email sent to ${userEmail} for alert ${alert.id}`
          );

          await db.collection("alerts").doc(alert.id).delete();
          logger.info(`Deleted triggered alert ${alert.id}`);
        }
      } catch (error: any) {
        logger.error(
          `Error processing alert ${alert.id} for ticker ${ticker}:`,
          error
        );
        // Decide if specific error handling (like for 429) is needed here too
        // For now, just log the error and continue with other alerts
      }
    });

    await Promise.all(promises);
    logger.info("Finished checking price alerts.");
  }
);
