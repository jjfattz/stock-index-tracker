"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { fetchAlerts, deleteAlert } from "@/lib/apiClient";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Alert {
  id: string;
  ticker: string;
  threshold: number;
  condition: "above" | "below";
  createdAt:
    | {
        _seconds: number;
        _nanoseconds: number;
      }
    | any;
}

const parseTicker = (ticker: string) => {
  if (ticker.startsWith("I:")) {
    return ticker.substring(2);
  }
  if (ticker.startsWith("I%3A")) {
    return ticker.substring(4);
  }
  return ticker;
};

export default function AlertsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteStatus, setDeleteStatus] = useState<{ [key: string]: boolean }>(
    {}
  );

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      const loadAlerts = async () => {
        setLoading(true);
        setError(null);
        try {
          const fetchedAlerts = await fetchAlerts();
          setAlerts(fetchedAlerts);
        } catch (err) {
          setError("Failed to load alerts.");
          console.error(err);
        } finally {
          setLoading(false);
        }
      };
      loadAlerts();
    }
  }, [user]);

  const handleDelete = async (alertId: string) => {
    setDeleteStatus((prev) => ({ ...prev, [alertId]: true }));
    const success = await deleteAlert(alertId);
    if (success) {
      setAlerts((prevAlerts) =>
        prevAlerts.filter((alert) => alert.id !== alertId)
      );
    } else {
      alert(`Failed to delete alert ${alertId}. Please try again.`);
    }
    setDeleteStatus((prev) => ({ ...prev, [alertId]: false }));
  };

  const formatTimestamp = (timestamp: Alert["createdAt"]) => {
    if (timestamp && typeof timestamp === "object" && "_seconds" in timestamp) {
      return new Date(timestamp._seconds * 1000).toLocaleString();
    }
    return "N/A";
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading your alerts...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-500">
        Error: {error}
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="container mx-auto p-4">
      <div className="mb-4">
        <Link href="/">
          <span className="text-blue-500 hover:underline">
            &larr; Back to Dashboard
          </span>
        </Link>
      </div>
      <h1 className="text-3xl font-bold mb-6">My Price Alerts</h1>
      {alerts.length === 0 ? (
        <p>You have no active alerts.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border">
            <thead>
              <tr className="w-full bg-gray-100 border-b">
                <th className="text-left py-3 px-4 uppercase font-semibold text-sm">
                  Ticker
                </th>
                <th className="text-left py-3 px-4 uppercase font-semibold text-sm">
                  Condition
                </th>
                <th className="text-left py-3 px-4 uppercase font-semibold text-sm">
                  Threshold
                </th>
                <th className="text-left py-3 px-4 uppercase font-semibold text-sm">
                  Created At
                </th>
                <th className="text-left py-3 px-4 uppercase font-semibold text-sm">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert) => (
                <tr
                  key={alert.id}
                  className="text-gray-700 border-b hover:bg-gray-50"
                >
                  <td className="py-3 px-4">
                    <Link href={`/indices/${alert.ticker}`}>
                      <span className="text-blue-600 hover:underline">
                        {parseTicker(alert.ticker)}
                      </span>
                    </Link>
                  </td>
                  <td className="py-3 px-4">
                    {alert.condition === "above" ? "Above" : "Below"}
                  </td>
                  <td className="py-3 px-4">{alert.threshold}</td>
                  <td className="py-3 px-4">
                    {formatTimestamp(alert.createdAt)}
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => handleDelete(alert.id)}
                      disabled={deleteStatus[alert.id]}
                      className={`bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-3 rounded text-xs focus:outline-none focus:shadow-outline ${
                        deleteStatus[alert.id]
                          ? "opacity-50 cursor-not-allowed"
                          : ""
                      }`}
                    >
                      {deleteStatus[alert.id] ? "Deleting..." : "Delete"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
