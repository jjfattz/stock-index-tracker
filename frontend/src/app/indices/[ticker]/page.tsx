"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import ChartComponent from "@/components/ChartComponent";
import { CandlestickData, Time } from "lightweight-charts";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { createAlert } from "@/lib/apiClient";

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
  const [alertThreshold, setAlertThreshold] = useState("");
  const [alertCondition, setAlertCondition] = useState<"above" | "below">(
    "above"
  );
  const [alertMessage, setAlertMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

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
    if (user) {
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
        } catch (err: unknown) {
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
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [ticker, user, authLoading]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading chart data for {ticker}...
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-red-500">
        <p className="mb-4">
          Error loading chart data for {ticker}: {error}
        </p>
        <Link href="/indices">
          <span className="text-blue-500 hover:underline">Back to Indices</span>
        </Link>
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
      {chartData.length > 0 ? (
        <ChartComponent data={chartData} ticker={ticker} />
      ) : (
        <p>No chart data available for {ticker}.</p>
      )}

      {user && chartData.length > 0 && (
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
        text: `Alert created successfully for ${ticker} ${alertCondition} ${thresholdValue}`,
      });
      setAlertThreshold("");
    } else {
      setAlertMessage({
        type: "error",
        text: "Failed to create alert. Please try again.",
      });
    }
  }
}
