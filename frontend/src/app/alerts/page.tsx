"use client";

import React, { useState, useEffect } from "react";
import { fetchAlerts, deleteAlert } from "@/lib/apiClient";
// import { useAuth } from "@/context/AuthContext"; // Removed unused import
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { useToast } from "@/context/ToastContext";
import ProtectedRoute from "@/components/ProtectedRoute"; // Import ProtectedRoute

interface Alert {
  id: string;
  ticker: string;
  condition: "above" | "below";
  threshold: number;
  createdAt: {
    _seconds: number;
    _nanoseconds: number;
  };
}

export default function AlertsPage() {
  // Remove useAuth hook call from here
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const fetchedAlerts = await fetchAlerts();
      setAlerts(fetchedAlerts || []);
    } catch (error) {
      console.error("Failed to fetch alerts:", error);
      addToast("Failed to load alerts.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Fetch alerts when component mounts (ProtectedRoute handles auth check)
    loadAlerts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Dependency array is empty as loadAlerts doesn't depend on changing props/state here

  const handleDeleteAlert = async (alertId: string) => {
    const success = await deleteAlert(alertId);
    if (success) {
      addToast("Alert deleted successfully.", "success");
      setAlerts((prevAlerts) =>
        prevAlerts.filter((alert) => alert.id !== alertId)
      );
    } else {
      addToast("Failed to delete alert.", "error");
    }
  };

  const formatTimestamp = (timestamp: {
    _seconds: number;
    _nanoseconds: number;
  }) => {
    if (!timestamp?._seconds) return "N/A";
    const date = new Date(timestamp._seconds * 1000);
    return date.toLocaleString();
  };

  // Loading state handled by ProtectedRoute initially, then local loading
  // if (loading) { // Remove this local loading check if ProtectedRoute handles it sufficiently
  //   return <div>Loading alerts...</div>;
  // }

  return (
    <ProtectedRoute>
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-6">My Price Alerts</h1>
        {loading ? (
          <div>Loading alerts...</div>
        ) : alerts.length === 0 ? (
          <p>You have no active price alerts.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-700/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    Ticker
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    Condition
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    Threshold
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    Created At
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-background divide-y divide-gray-700">
                {alerts.map((alert) => (
                  <tr key={alert.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {alert.ticker}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      Price is {alert.condition}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      ${alert.threshold.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {formatTimestamp(alert.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteAlert(alert.id)}
                        className="text-destructive hover:text-destructive/80"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
