import * as functions from "firebase-functions";
import express from "express";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import sgMail from "@sendgrid/mail";
import { onSchedule, ScheduledEvent } from "firebase-functions/v2/scheduler";

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

const app = express();
app.use(express.json());

app.get("/", (req: express.Request, res: express.Response) => {
  logger.info("API root accessed");
  res.send("Stock Index Tracker API");
});

app.get("/indices", async (req: express.Request, res: express.Response) => {
  const cursorUrl = req.query.cursor as string | undefined;
  logger.info(`Fetching indices list. Cursor: ${cursorUrl || "None"}`);

  try {
    const { restClient } = await import("@polygon.io/client-js");
    const polygon = restClient(polygonApiKey);

    let response;
    if (cursorUrl) {
      // Polygon SDK doesn't directly support next_url, so we fetch it manually
      const rawResponse = await fetch(cursorUrl, {
        headers: { Authorization: `Bearer ${polygonApiKey}` },
      });
      if (!rawResponse.ok) {
        throw new Error(
          `Polygon API error fetching next page: ${rawResponse.statusText}`
        );
      }
      response = await rawResponse.json();
    } else {
      response = await polygon.reference.tickers({
        market: "indices",
        active: "true",
        limit: 100, // Limit per page
        sort: "ticker",
        order: "asc",
      });
    }

    res.json({
      results: response.results || [],
      next_url: response.next_url || null, // Pass next_url for pagination
    });
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

    const { restClient } = await import("@polygon.io/client-js");
    const polygon = restClient(polygonApiKey);
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

        const { restClient } = await import("@polygon.io/client-js");
        const polygon = restClient(polygonApiKey);
        const quote = await polygon.stocks.lastQuote(formattedTicker);

        if (!quote || !quote.results || !quote.results.p) {
          logger.warn(`Could not get last quote for ${formattedTicker}`);
          return;
        }
        const currentPrice = quote.results.p;

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
      } catch (error) {
        logger.error(
          `Error processing alert ${alert.id} for ticker ${ticker}:`,
          error
        );
      }
    });

    await Promise.all(promises);
    logger.info("Finished checking price alerts.");
  }
);
