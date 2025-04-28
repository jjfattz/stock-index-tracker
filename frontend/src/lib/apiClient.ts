import { auth } from "./firebase";

const getAuthToken = async (): Promise<string | null> => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.error("No user logged in");
    return null;
  }
  try {
    return await currentUser.getIdToken();
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
