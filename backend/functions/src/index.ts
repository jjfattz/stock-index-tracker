import * as functions from "firebase-functions";
import express from "express";
import * as logger from "firebase-functions/logger";

const app = express();

app.get("/", (req: express.Request, res: express.Response) => {
  logger.info("API root accessed");
  res.send("Stock Index Tracker API");
});

export const api = functions.https.onRequest(app);
