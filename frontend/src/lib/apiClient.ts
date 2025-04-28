import { auth } from "./firebase";

const getAuthToken = async (): Promise<string | null> => {
  if (!auth) {
    console.error("Auth service is not initialized yet.");
    return null;
  }
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.log("getAuthToken: No current user found.");
    return null;
  }
  try {
    const token = await currentUser.getIdToken();
    console.log("getAuthToken: Successfully retrieved token.");
    return token;
  } catch (error) {
    console.error("Error getting auth token:", error);
    return null;
  }
};

export const fetchAlerts = async () => {
  const token = await getAuthToken();
  if (!token) return [];

  try {
    const response = await fetch("/api/alerts", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching alerts:", error);
    return [];
  }
};

export const fetchWatchlist = async () => {
  const token = await getAuthToken();
  if (!token) return [];

  try {
    const response = await fetch(`/api/watchlist`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching watchlist:", error);
    return [];
  }
};

export const addToWatchlist = async (ticker: string) => {
  const token = await getAuthToken();
  if (!token) return false;

  try {
    const response = await fetch(`/api/watchlist/${ticker}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `Error adding to watchlist: ${response.status} - ${errorText}`
      );
      throw new Error(
        `HTTP error! status: ${response.status}, message: ${errorText}`
      );
    }
    return true;
  } catch (error) {
    console.error(`Error adding ${ticker} to watchlist:`, error);
    return false;
  }
};

export const removeFromWatchlist = async (ticker: string) => {
  const token = await getAuthToken();
  if (!token) return false;

  try {
    const response = await fetch(`/api/watchlist/${ticker}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `Error removing from watchlist: ${response.status} - ${errorText}`
      );
      throw new Error(
        `HTTP error! status: ${response.status}, message: ${errorText}`
      );
    }
    return true;
  } catch (error) {
    console.error(`Error removing ${ticker} from watchlist:`, error);
    return false;
  }
};

export const createAlert = async (
  ticker: string,
  threshold: number,
  condition: "above" | "below"
) => {
  const token = await getAuthToken();
  if (!token) return null;

  try {
    const response = await fetch("/api/alerts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ ticker, threshold, condition }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `HTTP error! status: ${response.status}, message: ${errorText}`
      );
    }
    return await response.json();
  } catch (error) {
    console.error("Error creating alert:", error);
    return null;
  }
};

export const deleteAlert = async (alertId: string) => {
  const token = await getAuthToken();
  if (!token) return false;

  try {
    const response = await fetch(`/api/alerts/${alertId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return true;
  } catch (error) {
    console.error("Error deleting alert:", error);
    return false;
  }
};

export const fetchWatchlistData = async (tickers?: string[]) => {
  const token = await getAuthToken();
  if (!token) return [];

  let url = "/api/dashboard/watchlist";
  if (tickers && tickers.length > 0) {
    url += `?tickers=${tickers.join(",")}`;
  }

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching watchlist data:", error);
    return [];
  }
};
