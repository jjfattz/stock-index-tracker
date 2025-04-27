import * as functions from "firebase-functions";
import express, {
  Request,
  Response,
  NextFunction,
  RequestHandler,
} from "express";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import sgMail from "@sendgrid/mail";
import { onSchedule, ScheduledEvent } from "firebase-functions/v2/scheduler";
import axios, { AxiosError } from "axios";

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

const polygonApiClient = axios.create({
  baseURL: polygonApiBaseUrl,
  headers: {
    Authorization: `Bearer ${polygonApiKey}`,
  },
});

interface AuthenticatedRequest extends Request {
  user?: admin.auth.DecodedIdToken;
}

const handlePolygonApiError = (error: any, res: Response, context: string) => {
  logger.error(`Error ${context}:`, error);

  let statusCode = 500;
  let message = `An internal server error occurred while ${context}.`;

  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError;
    const status = axiosError.response?.status;
    const responseData = axiosError.response?.data as any;
    const responseMessage =
      responseData?.message || axiosError.message || "Unknown Polygon Error";

    const errorMap: { [key: number]: { status: number; message: string } } = {
      403: {
        status: 403,
        message: `Polygon API Authorization Error: ${responseMessage}`,
      },
      429: {
        status: 429,
        message: `Polygon API rate limit exceeded. Please try again later.`,
      },
      503: {
        status: 503,
        message: `Polygon API Error: ${responseMessage}`,
      },
    };

    if (status && errorMap[status]) {
      statusCode = errorMap[status].status;
      message = errorMap[status].message;
    }
  }

  res.status(statusCode).send(message);
  return;
};

const app = express();
app.use(express.json());

app.get("/", (req: Request, res: Response) => {
  logger.info("API root accessed");
  res.send("Stock Index Tracker API");
});

app.get("/indices", async (req: Request, res: Response) => {
  const cursorUrl = req.query.cursor as string | undefined;
  const searchTerm = req.query.search as string | undefined;
  logger.info(
    `Fetching indices list. Cursor: ${cursorUrl || "None"}, Search: ${
      searchTerm || "None"
    }`
  );

  try {
    if (cursorUrl) {
      const response = await axios.get(cursorUrl, {
        headers: { Authorization: `Bearer ${polygonApiKey}` },
      });
      res.json({
        results: response.data.results || [],
        next_url: response.data.next_url || null,
      });
      return;
    } else {
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
      const response = await polygonApiClient.get(`/v3/reference/tickers`, {
        params,
      });
      res.json({
        results: response.data.results || [],
        next_url: response.data.next_url || null,
      });
      return;
    }
  } catch (error) {
    handlePolygonApiError(error, res, "fetching stock indices");
    return;
  }
});

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

    const url = `/v2/aggs/ticker/${formattedTicker}/range/1/day/${from}/${to}`;
    const params = { adjusted: "true", sort: "asc" };

    const response = await polygonApiClient.get(url, { params });

    if (!response.data.results) {
      logger.warn(
        `No aggregate data found for ${formattedTicker} from ${from} to ${to}`
      );
      res.json([]);
      return;
    }
    res.json(response.data.results);
    return;
  } catch (error) {
    handlePolygonApiError(error, res, `fetching aggregate data for ${ticker}`);
    return;
  }
};
app.get("/indices/:ticker/aggregates", getAggregatesHandler);

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

    const parseTicker = (tickerStr: string): string => {
      if (tickerStr.startsWith("I:")) {
        return tickerStr.substring(2);
      }
      if (tickerStr.startsWith("I%3A")) {
        return tickerStr.substring(4);
      }
      return tickerStr;
    };
    const cleanedTicker = parseTicker(ticker);

    logger.info(
      `User ${userId} creating alert for ${cleanedTicker} ${condition} ${numericThreshold}`
    );
    try {
      const alertData = {
        userId,
        ticker: cleanedTicker,
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

export const api = functions.https.onRequest(app);

export const checkPriceAlerts = onSchedule(
  "every 24 hours",
  async (event: ScheduledEvent) => {
    logger.info("Running scheduled check for price alerts");

    if (!polygonApiKey) {
      logger.error("Polygon API key not configured. Skipping alert check.");
      return;
    }
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
        const formattedTicker = ticker.startsWith("I:")
          ? ticker
          : `I:${ticker}`;
        const url = `${polygonApiBaseUrl}/v2/last/trade/${formattedTicker}`;
        const headers = { Authorization: `Bearer ${polygonApiKey}` };

        const response = await axios.get(url, { headers });

        if (!response.data?.results?.p) {
          logger.warn(
            `Could not get last trade price for ${formattedTicker} (Alert ID: ${alertId})`
          );
          return;
        }
        const currentPrice = response.data.results.p;

        logger.info(
          `Checking alert ${alertId}: ${formattedTicker} - Current Price: ${currentPrice}, Condition: ${condition} ${threshold}`
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
        logger.error(
          `Error processing alert ${alertId} for ticker ${ticker}:`,
          error
        );
      }
    });

    await Promise.all(promises);
    logger.info("Finished checking price alerts.");
  }
);
