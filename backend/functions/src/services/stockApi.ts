import * as logger from "firebase-functions/logger";
import Alpaca from "@alpacahq/alpaca-trade-api";
import * as functions from "firebase-functions";

let alpaca: Alpaca | null = null;

const INDEX_ETFS = [
  "SPY",
  "QQQ",
  "DIA",
  "IWM",
  "IVV",
  "VOO",
  "VTI",
  "IVW",
  "XLK",
  "XLF",
  "XLV",
  "XLE",
  "XLY",
  "XLP",
  "XLU",
  "XLI",
  "XLB",
  "XLC",
];

const getAlpacaClient = (): Alpaca => {
  if (!alpaca) {
    const keyId = functions.config().alpaca?.key_id;
    const secretKey = functions.config().alpaca?.secret_key;

    if (!keyId || !secretKey) {
      logger.error(
        "Stock API keys not configured. Ensure Firebase config is set and emulator restarted if needed."
      );
      throw new Error("Stock API keys not configured.");
    }
    alpaca = new Alpaca({
      keyId: keyId,
      secretKey: secretKey,
      paper: true,
    });
  }
  return alpaca;
};

export const handleStockApiError = (
  error: any,
  context: string
): { status: number; message: string } => {
  logger.error(`Stock API Error ${context}:`, error);
  let statusCode = 500;
  let message = `An internal server error occurred while ${context}.`;

  if (error.response && error.response.status) {
    statusCode = error.response.status;
    message = `Stock API Error (${statusCode}): ${
      error.message || "Unknown Stock API Error"
    }`;
  } else if (error.message) {
    message = `Stock API Error: ${error.message}`;
  }

  if (statusCode === 401 || statusCode === 403) {
    message = `Stock API Authorization Error. Check credentials. (${error.message})`;
  } else if (statusCode === 429) {
    message = `Stock API rate limit exceeded. Please try again later.`;
  }

  return { status: statusCode, message: message };
};

export const getIndicesList = async () => {
  logger.info(`Fetching predefined index ETFs: ${INDEX_ETFS.join(", ")}`);
  try {
    const client = getAlpacaClient();
    const assetPromises = INDEX_ETFS.map((symbol) => client.getAsset(symbol));
    const assets = await Promise.all(assetPromises);

    return {
      results: assets.map((asset: any) => ({
        ticker: asset.symbol,
        name: asset.name,
        market: asset.exchange,
        locale: "us",
        primary_exchange: asset.exchange,
        type: asset.class,
        active: asset.status === "active",
        currency_name: "usd",
        cik: null,
        composite_figi: null,
        share_class_figi: null,
        last_updated_utc: null,
      })),
      next_url: null,
    };
  } catch (error) {
    const { status, message } = handleStockApiError(
      error,
      "fetching predefined index ETFs"
    );
    throw { status, message };
  }
};

export const getIndexDetails = async (ticker: string) => {
  logger.info(`Fetching details for index: ${ticker}`);
  try {
    const client = getAlpacaClient();
    const asset = await client.getAsset(ticker);
    return {
      ticker: asset.symbol,
      name: asset.name,
      market: asset.exchange,
      locale: "us",
      primary_exchange: asset.exchange,
      type: asset.class,
      active: asset.status === "active",
      currency_name: "usd",
      cik: null,
      composite_figi: null,
      share_class_figi: null,
      last_updated_utc: null,
    };
  } catch (error) {
    const { status, message } = handleStockApiError(
      error,
      `fetching details for ${ticker}`
    );
    throw { status, message };
  }
};

export const getIndexAggregates = async (
  ticker: string,
  from: string,
  to: string
) => {
  logger.info(`Fetching daily aggregates for ${ticker} from ${from} to ${to}`);
  try {
    const client = getAlpacaClient();
    const bars = await client.getBarsV2(ticker, {
      start: from,
      end: to,
      timeframe: client.newTimeframe(1, client.timeframeUnit.DAY),
      adjustment: "raw",
    });

    const results = [];
    for await (const bar of bars) {
      results.push({
        v: bar.Volume,
        vw: bar.VWAP,
        o: bar.OpenPrice,
        c: bar.ClosePrice,
        h: bar.HighPrice,
        l: bar.LowPrice,
        t: new Date(bar.Timestamp).getTime(),
        n: bar.TradeCount,
      });
    }
    return results;
  } catch (error) {
    const { status, message } = handleStockApiError(
      error,
      `fetching aggregate data for ${ticker}`
    );
    throw { status, message };
  }
};

export const getLatestQuotePrice = async (ticker: string) => {
  logger.info(`Fetching latest quote price for ${ticker}`);
  try {
    const client = getAlpacaClient();
    const latestQuote = await client.getLatestQuote(ticker);
    if (!latestQuote?.AskPrice) {
      logger.warn(`Could not get latest quote price for ${ticker}`);
      return null;
    }
    return latestQuote.AskPrice;
  } catch (error) {
    const { status, message } = handleStockApiError(
      error,
      `fetching latest quote price for ${ticker}`
    );
    throw { status, message };
  }
};
