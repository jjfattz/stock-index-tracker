"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import ChartComponent from "@/components/ChartComponent";
import { CandlestickData, Time } from "lightweight-charts";
import { useAuth } from "@/context/AuthContext";
import {
  createAlert,
  fetchWatchlist,
  addToWatchlist,
  removeFromWatchlist,
} from "@/lib/apiClient";
import { useToast } from "@/context/ToastContext";
import { Button } from "@/components/ui/button";

interface AggregateData {
  o: number;
  h: number;
  l: number;
  c: number;
  t: number;
  v: number;
  vw: number;
  n: number;
}

export default function IndexDetailPage() {
  const params = useParams();
  const router = useRouter();
  const ticker = params?.ticker as string;
  const { user, loading: authLoading } = useAuth();
  const [chartData, setChartData] = useState<CandlestickData<Time>[]>([]);
  const [indexName, setIndexName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasErrorOccurred, setHasErrorOccurred] = useState(false);
  const [alertThreshold, setAlertThreshold] = useState("");
  const [alertCondition, setAlertCondition] = useState<"above" | "below">(
    "above"
  );
  const [alertMessage, setAlertMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const { addToast } = useToast();
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [isWatchlisted, setIsWatchlisted] = useState(false);
  const [watchlistLoading, setWatchlistLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!ticker) {
      setError("Ticker not found in URL.");
      setLoading(false);
      return;
    }
    if (user && !hasErrorOccurred) {
      const fetchAggregateData = async () => {
        setLoading(true);
        setError(null);
        try {
          const response = await fetch(`/api/indices/${ticker}/aggregates`);
          if (!response.ok) {
            const errorText = await response.text();
            if (
              response.status === 403 ||
              response.status === 429 ||
              response.status === 503
            ) {
              throw new Error(
                errorText || `HTTP error! status: ${response.status}`
              );
            }
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const data: AggregateData[] = await response.json();

          if (!Array.isArray(data)) {
            console.error("Received non-array data:", data);
            throw new Error("Invalid data format received from API.");
          }

          const formattedData: CandlestickData<Time>[] = data.map((agg) => ({
            time: (agg.t / 1000) as Time,
            open: agg.o,
            high: agg.h,
            low: agg.l,
            close: agg.c,
          }));
          setChartData(formattedData);
          setHasErrorOccurred(false);
        } catch (err: unknown) {
          setHasErrorOccurred(true);
          if (err instanceof Error) {
            setError(err.message);
          } else {
            setError("An unexpected error occurred while fetching chart data.");
          }
          console.error(`Error fetching aggregates for ${ticker}:`, err);
        } finally {
          setLoading(false);
        }
      };

      const fetchIndexDetails = async () => {
        try {
          const response = await fetch(`/api/indices/${ticker}/details`);
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
              errorText ||
                `HTTP error fetching details! status: ${response.status}`
            );
          }
          const details = await response.json();
          setIndexName(details.name);
        } catch (err: unknown) {
          if (err instanceof Error) {
            setError((prev) =>
              prev ? `${prev}; ${err.message}` : err.message
            );
          } else {
            setError((prev) =>
              prev
                ? `${prev}; An unexpected error occurred while fetching index details.`
                : "An unexpected error occurred while fetching index details."
            );
          }
          console.error(`Error fetching details for ${ticker}:`, err);
        }
      };

      fetchAggregateData();
      fetchIndexDetails();
    } else if (!authLoading && !user) {
    } else if (!loading && !user) {
      setLoading(false);
    }

    const loadWatchlist = async () => {
      if (user && ticker) {
        setWatchlistLoading(true);
        try {
          const fetchedWatchlist = await fetchWatchlist();
          const currentWatchlist = fetchedWatchlist || [];
          setWatchlist(currentWatchlist);
          setIsWatchlisted(currentWatchlist.includes(ticker));
        } catch (err) {
          console.error("Failed to fetch watchlist:", err);
          addToast("Failed to load watchlist.", "error");
          setIsWatchlisted(false);
        } finally {
          setWatchlistLoading(false);
        }
      } else {
        setIsWatchlisted(false);
        setWatchlist([]);
        setWatchlistLoading(false);
      }
    };
    loadWatchlist();
  }, [ticker, user, authLoading, hasErrorOccurred, addToast]);

  useEffect(() => {
    if (error) {
      addToast(error, "error");
    }
  }, [error, addToast]);

  const handleAddWatchlist = async () => {
    if (!ticker || !user) return;
    setWatchlistLoading(true);
    const success = await addToWatchlist(ticker);
    if (success) {
      setWatchlist((prev) => [...prev, ticker]);
      setIsWatchlisted(true);
      addToast(`${ticker} added to watchlist.`, "success");
    } else {
      addToast(`Failed to add ${ticker} to watchlist.`, "error");
    }
    setWatchlistLoading(false);
  };

  const handleRemoveWatchlist = async () => {
    if (!ticker || !user) return;
    setWatchlistLoading(true);
    const success = await removeFromWatchlist(ticker);
    if (success) {
      setWatchlist((prev) => prev.filter((t) => t !== ticker));
      setIsWatchlisted(false);
      addToast(`${ticker} removed from watchlist.`, "success");
    } else {
      addToast(`Failed to remove ${ticker} from watchlist.`, "error");
    }
    setWatchlistLoading(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Authenticating...
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (loading && chartData.length === 0 && !hasErrorOccurred) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading chart data for {ticker}...
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      {hasErrorOccurred && (
        <div className="mb-4 p-4 border border-destructive bg-destructive/10 text-destructive-foreground rounded flex justify-between items-center">
          <span>Error loading chart data: {error || "Unknown error"}</span>
          <Button
            onClick={() => setHasErrorOccurred(false)}
            variant="outline"
            className="border-white cursor-pointer"
            size="sm"
          >
            Retry
          </Button>
        </div>
      )}
      {chartData.length > 0 && !hasErrorOccurred ? (
        <ChartComponent
          data={chartData}
          ticker={ticker}
          indexName={indexName}
          isUserLoggedIn={!!user && !authLoading}
          isWatchlisted={isWatchlisted}
          watchlistLoading={watchlistLoading}
          watchlistCount={watchlist.length}
          onAddToWatchlist={handleAddWatchlist}
          onRemoveFromWatchlist={handleRemoveWatchlist}
        />
      ) : !hasErrorOccurred && !loading ? (
        <p>No chart data available for {ticker}.</p>
      ) : null}

      {user && chartData.length > 0 && !hasErrorOccurred && (
        <div className="mt-8 p-4 border rounded shadow">
          <h3 className="text-xl font-semibold mb-4">Create Price Alert</h3>
          <form
            onSubmit={handleCreateAlert}
            className="flex flex-col sm:flex-row gap-4 items-end"
          >
            <div className="flex-grow">
              <label
                htmlFor="condition"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Alert me when price is
              </label>
              <select
                id="condition"
                value={alertCondition}
                onChange={(e) =>
                  setAlertCondition(e.target.value as "above" | "below")
                }
                className="shadow-sm block w-full sm:text-sm border-gray-300 rounded-md p-2 border"
              >
                <option value="above">Above</option>
                <option value="below">Below</option>
              </select>
            </div>
            <div className="flex-grow">
              <label
                htmlFor="threshold"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Threshold Price
              </label>
              <input
                type="number"
                id="threshold"
                value={alertThreshold}
                onChange={(e) => setAlertThreshold(e.target.value)}
                className="shadow-sm block w-full sm:text-sm border-gray-300 rounded-md p-2 border"
                step="any"
                required
                placeholder="e.g., 150.50"
              />
            </div>
            <Button
              type="submit"
              variant="outline"
              className="border-white cursor-pointer"
            >
              Set Alert
            </Button>
          </form>
          {alertMessage && (
            <p
              className={`mt-4 text-sm ${
                alertMessage.type === "success"
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              {alertMessage.text}
            </p>
          )}
        </div>
      )}
    </div>
  );

  async function handleCreateAlert(e: React.FormEvent) {
    e.preventDefault();
    setAlertMessage(null);
    if (!ticker || !alertThreshold) return;

    const thresholdValue = parseFloat(alertThreshold);
    if (isNaN(thresholdValue)) {
      setAlertMessage({ type: "error", text: "Invalid threshold value." });
      return;
    }

    const result = await createAlert(ticker, thresholdValue, alertCondition);

    if (result) {
      setAlertMessage({
        type: "success",
        text: `Alert created successfully for ${ticker} ${alertCondition} ${thresholdValue}`,
      });
      setAlertThreshold("");
    } else {
      addToast("Failed to create alert. Please try again.", "error");
    }
  }
}
