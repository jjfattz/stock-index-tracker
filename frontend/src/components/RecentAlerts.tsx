"use client";

import React, { useState, useEffect } from "react";
import { fetchAlerts } from "@/lib/apiClient";
import { useAuth } from "@/context/AuthContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";

interface Alert {
  id: string;
  ticker: string;
  threshold: number;
  condition: "above" | "below";
  createdAt: {
    _seconds: number;
    _nanoseconds: number;
  };
}

const RecentAlerts: React.FC = () => {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadAlerts = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const fetchedAlerts = await fetchAlerts();
        if (Array.isArray(fetchedAlerts)) {
          setAlerts(fetchedAlerts.slice(0, 4));
        } else {
          throw new Error("Invalid data format received for alerts");
        }
      } catch (err: any) {
        console.error("Error loading recent alerts:", err);
        setError(err.message || "Failed to load recent alerts.");
        setAlerts([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadAlerts();
  }, [user]);

  const formatTimestamp = (timestamp: Alert["createdAt"]) => {
    if (!timestamp || typeof timestamp._seconds !== "number") {
      return "Invalid Date";
    }
    const date = new Date(timestamp._seconds * 1000);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const renderSkeletonRows = () => {
    return Array.from({ length: 4 }).map((_, index) => (
      <TableRow key={`skeleton-alert-${index}`}>
        <TableCell>
          <Skeleton className="h-4 w-16" />
        </TableCell>
        <TableCell>
          <Skeleton className="h-4 w-24" />
        </TableCell>
        <TableCell>
          <Skeleton className="h-4 w-20" />
        </TableCell>
      </TableRow>
    ));
  };

  return (
    <section>
      <h2 className="text-2xl font-semibold mb-4">Recently Added Alerts</h2>
      {error && <p className="text-destructive mb-4">{error}</p>}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ticker</TableHead>
              <TableHead>Condition</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              renderSkeletonRows()
            ) : alerts.length > 0 ? (
              alerts.map((alert) => (
                <TableRow key={alert.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/indices/${alert.ticker}`}
                      className="hover:underline hover:text-primary"
                    >
                      {alert.ticker}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {`Price ${alert.condition} ${alert.threshold}`}
                  </TableCell>
                  <TableCell>{formatTimestamp(alert.createdAt)}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="text-center text-muted-foreground"
                >
                  No recent alerts found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
};

export default RecentAlerts;
