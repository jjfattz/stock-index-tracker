import * as logger from "firebase-functions/logger";
import Alpaca from "@alpacahq/alpaca-trade-api";
import * as functions from "firebase-functions";

let alpaca: Alpaca | null = null;

class StockApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "StockApiError";
    this.status = status;
  }
}

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
      const errorMsg =
        "Stock API keys not configured. Ensure Firebase config is set " +
        "and emulator restarted if needed.";
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }
    alpaca = new Alpaca({
      keyId: keyId,
      secretKey: secretKey,
      paper: true,
    });
  }
  return alpaca;
};

interface AlpacaErrorResponse {
  response?: {
    status?: number;
  };
  message?: string;
}

export const handleStockApiError = (
  error: unknown,
  context: string
): { status: number; message: string } => {
  logger.error(`Stock API Error ${context}:`, error);
  let statusCode = 500;
  let baseMessage = `An internal server error occurred while ${context}.`;
  const err = error as AlpacaErrorResponse;
  const errorMessage = err.message || "Unknown Stock API Error";

  if (err.response && err.response.status) {
    statusCode = err.response.status;
    baseMessage = `Stock API Error (${statusCode}): ${errorMessage}`;
  } else if (err.message) {
    baseMessage = `Stock API Error: ${errorMessage}`;
  }

  if (statusCode === 401 || statusCode === 403) {
    baseMessage = `Stock API Authorization Error. Check credentials. (${errorMessage})`;
  } else if (statusCode === 429) {
    baseMessage = "Stock API rate limit exceeded. Please try again later.";
  }

  return { status: statusCode, message: baseMessage };
};

export const getIndicesList = async () => {
  logger.info(`Fetching predefined index ETFs: ${INDEX_ETFS.join(", ")}`);
  try {
    const client = getAlpacaClient();
    const assetPromises = INDEX_ETFS.map((symbol) => client.getAsset(symbol));
    const assets = await Promise.all(assetPromises);

    return {
      results: assets.map((asset) => ({
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
    throw new StockApiError(message, status);
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
    throw new StockApiError(message, status);
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
    throw new StockApiError(message, status);
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
    throw new StockApiError(message, status);
  }
};
