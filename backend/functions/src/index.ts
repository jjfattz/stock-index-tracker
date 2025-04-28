import * as functions from "firebase-functions";
import express, { Request, Response, NextFunction } from "express";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import sgMail from "@sendgrid/mail";
import { onSchedule, ScheduledEvent } from "firebase-functions/v2/scheduler";
import * as stockApi from "./services/stockApi";

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
  next: NextFunction
) => {
  const idToken = req.headers.authorization?.split("Bearer ")[1];
  if (!idToken) {
    res.status(401).send("Unauthorized: No token provided");
    return;
  }
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    (req as any).user = decodedToken;

    const userRef = db.collection("users").doc(decodedToken.uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      logger.info(
        `User document for ${decodedToken.uid} not found. Creating one.`
      );
      await userRef.set(
        {
          email: decodedToken.email,
          createdAt: FieldValue.serverTimestamp(),
          watchlist: ["SPY", "QQQ", "DIA"],
        },
        { merge: true }
      );
    }

    next();
  } catch (error) {
    logger.error("Error verifying Firebase ID token:", error);
    res.status(401).send("Unauthorized: Invalid token");
    return;
  }
};

interface AuthenticatedRequest extends Request {
  user?: admin.auth.DecodedIdToken;
}

const app = express();
app.use(express.json());

app.get("/", (req: Request, res: Response) => {
  logger.info("API root accessed");
  res.send("Stock Index Tracker API");
});

app.get("/indices", async (req: Request, res: Response) => {
  logger.info(`Fetching predefined list of index ETFs.`);

  try {
    const data = await stockApi.getIndicesList();
    res.json({
      results: data.results || [],
      next_url: data.next_url,
    });
    return;
  } catch (error: any) {
    if (error.status && error.message) {
      logger.error(
        `Stock API Error fetching indices list: Status ${error.status}, Message: ${error.message}`
      );
      res.status(error.status).send(error.message);
    } else {
      logger.error("Error fetching indices list:", error);
      res.status(500).send(error.message || "Error fetching indices list");
    }
    return;
  }
});

app.get("/indices/:ticker/details", async (req: Request, res: Response) => {
  const { ticker } = req.params;
  logger.info(`Fetching details for index: ${ticker}`);

  if (!ticker) {
    res.status(400).send("Ticker parameter is required");
    return;
  }

  try {
    const details = await stockApi.getIndexDetails(ticker);
    res.json(details);
    return;
  } catch (error: any) {
    if (error.status && error.message) {
      logger.error(
        `Stock API Error fetching details for ${ticker}: Status ${error.status}, Message: ${error.message}`
      );
      res.status(error.status).send(error.message);
    } else {
      logger.error(`Error fetching details for ${ticker}:`, error);
      res
        .status(500)
        .send(error.message || `Error fetching details for ${ticker}`);
    }
    return;
  }
});

app.get("/indices/:ticker/aggregates", async (req: Request, res: Response) => {
  const { ticker } = req.params;
  logger.info(`Fetching daily aggregates for index: ${ticker}`);

  if (!ticker) {
    res.status(400).send("Ticker parameter is required");
    return;
  }

  try {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yearAgo = new Date(today);
    yearAgo.setDate(today.getDate() - 365);

    const to = yesterday.toISOString().split("T")[0];
    const from = yearAgo.toISOString().split("T")[0];

    const results = await stockApi.getIndexAggregates(ticker, from, to);

    if (!results || results.length === 0) {
      logger.warn(
        `No aggregate data found for ${ticker} from ${from} to ${to}`
      );
      res.json([]);
      return;
    }
    res.json(results);
    return;
  } catch (error: any) {
    if (error.status && error.message) {
      logger.error(
        `Stock API Error fetching aggregate data for ${ticker}: Status ${error.status}, Message: ${error.message}`
      );
      res.status(error.status).send(error.message);
    } else {
      logger.error(`Error fetching aggregate data for ${ticker}:`, error);
      res
        .status(500)
        .send(error.message || `Error fetching aggregate data for ${ticker}`);
    }
    return;
  }
});

app.post(
  "/alerts",
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.uid;
    if (!userId) {
      res.status(401).send("Authentication error.");
      return;
    }

    const { ticker, threshold, condition } = req.body;
    if (
      !ticker ||
      threshold === undefined ||
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

    const numericThreshold = Number(threshold);
    if (isNaN(numericThreshold)) {
      res.status(400).send("Invalid threshold value: must be a number.");
      return;
    }

    logger.info(
      `User ${userId} creating alert for ${ticker} ${condition} ${numericThreshold}`
    );
    try {
      const alertData = {
        userId,
        ticker: ticker,
        threshold: numericThreshold,
        condition,
        createdAt: FieldValue.serverTimestamp(),
      };
      const docRef = await db.collection("alerts").add(alertData);
      res.status(201).json({ id: docRef.id, ...alertData });
      return;
    } catch (error: any) {
      logger.error(
        `Error creating alert for user ${userId}. Code: ${
          error.code || "N/A"
        }, Message: ${error.message || "Unknown error"}`,
        error
      );
      res.status(500).send("Error creating alert");
      return;
    }
  }
);

app.get(
  "/alerts",
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.uid;
    if (!userId) {
      res.status(401).send("Authentication error.");
      return;
    }

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
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.uid;
    const { alertId } = req.params;
    if (!userId) {
      res.status(401).send("Authentication error.");
      return;
    }

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

app.get(
  "/dashboard/watchlist",
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.uid;
    if (!userId) {
      res.status(401).send("Authentication error.");
      return;
    }

    const tickers = (req.query.tickers as string)?.split(",") || [
      "SPY",
      "QQQ",
      "DIA",
    ];
    logger.info(
      `User ${userId} fetching watchlist data for tickers: ${tickers.join(
        ", "
      )}`
    );

    if (tickers.length === 0) {
      res.json([]);
      return;
    }

    try {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(today.getDate() - 31);

      const to = yesterday.toISOString().split("T")[0];
      const from = thirtyDaysAgo.toISOString().split("T")[0];

      const watchlistDataPromises = tickers.map(async (ticker) => {
        try {
          const [details, price, aggregates] = await Promise.all([
            stockApi.getIndexDetails(ticker),
            stockApi.getLatestQuotePrice(ticker),
            stockApi.getIndexAggregates(ticker, from, to),
          ]);

          return {
            ticker: details.ticker,
            name: details.name,
            price: price,
            aggregates: aggregates,
          };
        } catch (error: any) {
          logger.error(
            `Error fetching data for ticker ${ticker} in watchlist for user ${userId}:`,
            error
          );

          return {
            ticker: ticker,
            name: "Error loading data",
            price: null,
            aggregates: [],
            error: error.message || "Failed to load data",
          };
        }
      });

      const watchlistData = await Promise.all(watchlistDataPromises);
      res.json(watchlistData);
      return;
    } catch (error: any) {
      logger.error(`Error fetching watchlist data for user ${userId}:`, error);
      res.status(500).send("Error fetching watchlist data");
      return;
    }
  }
);

app.get(
  "/watchlist",
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.uid;
    if (!userId) {
      res.status(401).send("Authentication error.");
      return;
    }

    logger.info(`Fetching watchlist for user ${userId}`);
    try {
      const userDoc = await db.collection("users").doc(userId).get();
      const userData = userDoc.data();
      const watchlist = userData?.watchlist || [];
      res.json(watchlist);
      return;
    } catch (error) {
      logger.error(`Error fetching watchlist for user ${userId}:`, error);
      res.status(500).send("Error fetching watchlist");
      return;
    }
  }
);

app.post(
  "/watchlist/:ticker",
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.uid;
    const { ticker } = req.params;

    if (!userId) {
      res.status(401).send("Authentication error.");
      return;
    }
    if (!ticker) {
      res.status(400).send("Ticker parameter is required.");
      return;
    }

    logger.info(`User ${userId} adding ticker ${ticker} to watchlist`);
    const userRef = db.collection("users").doc(userId);

    try {
      await db.runTransaction(async (transaction) => {
        const userDoc = await transaction.get(userRef);
        const userData = userDoc.data();
        const watchlist = userData?.watchlist || [];

        if (watchlist.includes(ticker)) {
          res.status(409).send("Ticker already in watchlist.");
          return;
        }

        if (watchlist.length >= 6) {
          res.status(400).send("Watchlist limit reached (max 6 tickers).");
          return;
        }

        transaction.set(
          userRef,
          { watchlist: FieldValue.arrayUnion(ticker) },
          { merge: true }
        );
        res.status(200).send(`Ticker ${ticker} added to watchlist.`);
      });
      return;
    } catch (error) {
      logger.error(
        `Error adding ticker ${ticker} to watchlist for user ${userId}:`,
        error
      );
      res.status(500).send("Error adding ticker to watchlist");
      return;
    }
  }
);

app.delete(
  "/watchlist/:ticker",
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.uid;
    const { ticker } = req.params;

    if (!userId) {
      res.status(401).send("Authentication error.");
      return;
    }
    if (!ticker) {
      res.status(400).send("Ticker parameter is required.");
      return;
    }

    logger.info(`User ${userId} removing ticker ${ticker} from watchlist`);
    const userRef = db.collection("users").doc(userId);

    try {
      logger.info(
        `Attempting to remove ticker ${ticker} for user ${userId}. Current watchlist state (before update):`,
        (await userRef.get()).data()?.watchlist
      );

      await userRef.update({
        watchlist: FieldValue.arrayRemove(ticker),
      });

      logger.info(
        `Successfully executed update command for removing ${ticker}. Current watchlist state (after update attempt):`,
        (await userRef.get()).data()?.watchlist
      );

      res.status(200).send(`Ticker ${ticker} removed from watchlist.`);
      return;
    } catch (error) {
      logger.error(
        `Error removing ticker ${ticker} from watchlist for user ${userId}:`,
        error
      );
      res.status(500).send("Error removing ticker from watchlist");
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
      const alert = doc.data();
      const alertId = doc.id;
      const { ticker, threshold, condition, userId } = alert;

      try {
        const currentPrice = await stockApi.getLatestQuotePrice(ticker);

        if (currentPrice === null) {
          logger.warn(
            `Could not get last trade price for ${ticker} (Alert ID: ${alertId})`
          );
          return;
        }

        logger.info(
          `Checking alert ${alertId}: ${ticker} - Current Price: ${currentPrice}, Condition: ${condition} ${threshold}`
        );

        let conditionMet =
          (condition === "above" && currentPrice > threshold) ||
          (condition === "below" && currentPrice < threshold);

        if (conditionMet) {
          logger.info(
            `Alert condition met for ${alertId}. Sending notification.`
          );
          const userRecord = await admin.auth().getUser(userId);
          const userEmail = userRecord.email;

          if (!userEmail) {
            logger.error(
              `Could not find email for user ${userId} (Alert ID: ${alertId})`
            );
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
            `Notification email sent to ${userEmail} for alert ${alertId}`
          );

          await db.collection("alerts").doc(alertId).delete();
          logger.info(`Deleted triggered alert ${alertId}`);
        }
      } catch (error: any) {
        if (error.status && error.message) {
          logger.error(
            `Stock API Error processing alert ${alertId} for ticker ${ticker}: Status ${error.status}, Message: ${error.message}`
          );
        } else {
          logger.error(
            `Error processing alert ${alertId} for ticker ${ticker}:`,
            error
          );
        }
      }
    });

    await Promise.all(promises);
    logger.info("Finished checking price alerts.");
  }
);
