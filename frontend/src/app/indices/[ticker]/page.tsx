"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import ChartComponent from "@/components/ChartComponent";
import { CandlestickData, Time } from "lightweight-charts";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { createAlert } from "@/lib/apiClient";
import { useToast } from "@/context/ToastContext";

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

  const parseTicker = (tickerStr: string | undefined) => {
    if (!tickerStr) return "";
    if (tickerStr.startsWith("I:")) {
      return tickerStr.substring(2);
    }
    if (tickerStr.startsWith("I%3A")) {
      return tickerStr.substring(4);
    }
    return tickerStr;
  };

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

      fetchAggregateData();
    } else if (!authLoading && !user) {
    } else if (!loading && !user) {
      setLoading(false);
    }
  }, [ticker, user, authLoading, hasErrorOccurred]);

  useEffect(() => {
    if (error) {
      addToast(error.replace(/I:|I%3A/g, ""), "error");
    }
  }, [error, addToast]);

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
        Loading chart data for {parseTicker(ticker)}...
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="mb-4">
        <Link href="/indices">
          <span className="text-blue-500 hover:underline">
            &larr; Back to Indices
          </span>
        </Link>
      </div>
      {hasErrorOccurred && (
        <div className="mb-4 p-4 border border-red-500 bg-red-100 text-red-700 rounded">
          Error loading chart data:{" "}
          {error?.replace(/I:|I%3A/g, "") || "Unknown error"}
          <button
            onClick={() => setHasErrorOccurred(false)}
            className="ml-4 text-blue-500 underline"
          >
            Retry
          </button>
        </div>
      )}
      {chartData.length > 0 && !hasErrorOccurred ? (
        <ChartComponent data={chartData} ticker={parseTicker(ticker)} />
      ) : !hasErrorOccurred ? (
        <p>No chart data available for {parseTicker(ticker)}.</p>
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
            <button
              type="submit"
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline h-10"
            >
              Set Alert
            </button>
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
        text: `Alert created successfully for ${parseTicker(
          ticker
        )} ${alertCondition} ${thresholdValue}`,
      });
      setAlertThreshold("");
    } else {
      addToast("Failed to create alert. Please try again.", "error");
    }
  }
}
