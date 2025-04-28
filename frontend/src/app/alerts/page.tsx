"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { fetchAlerts, deleteAlert } from "@/lib/apiClient";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/context/ToastContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

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
  const { addToast } = useToast();

  useEffect(() => {
    if (error) {
      addToast(`Error loading alerts: ${error}`, "error");
    }
  }, [error, addToast]);

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
      addToast(`Alert deleted successfully.`, "success");
    } else {
      addToast(`Failed to delete alert. Please try again.`, "error");
    }
    setDeleteStatus((prev) => ({ ...prev, [alertId]: false }));
  };

  const formatTimestamp = (timestamp: Alert["createdAt"]) => {
    if (timestamp && typeof timestamp === "object" && "_seconds" in timestamp) {
      return new Date(timestamp._seconds * 1000).toLocaleString();
    }
    return "N/A";
  };

  if (!user) {
    return null;
  }

  const renderSkeletonRows = () => {
    return Array.from({ length: 5 }).map((_, index) => (
      <TableRow key={`skeleton-alert-${index}`}>
        <TableCell>
          <Skeleton className="h-4 w-16" />
        </TableCell>
        <TableCell>
          <Skeleton className="h-4 w-24" />
        </TableCell>
        <TableCell>
          <Skeleton className="h-4 w-12" />
        </TableCell>
        <TableCell>
          <Skeleton className="h-4 w-20" />
        </TableCell>
        <TableCell>
          <Skeleton className="h-8 w-16" />
        </TableCell>
      </TableRow>
    ));
  };

  if (authLoading) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-3xl font-bold mb-6">My Price Alerts</h1>
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticker</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead>Threshold</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>{renderSkeletonRows()}</TableBody>
          </Table>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">My Price Alerts</h1>
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ticker</TableHead>
              <TableHead>Condition</TableHead>
              <TableHead>Threshold</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              renderSkeletonRows()
            ) : alerts.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center text-muted-foreground h-24"
                >
                  You have no active alerts.
                </TableCell>
              </TableRow>
            ) : (
              alerts.map((alert) => (
                <TableRow key={alert.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/indices/${alert.ticker}`}
                      className="hover:underline hover:text-primary"
                    >
                      {parseTicker(alert.ticker)}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {alert.condition === "above" ? "Above" : "Below"}
                  </TableCell>
                  <TableCell>{alert.threshold}</TableCell>
                  <TableCell>{formatTimestamp(alert.createdAt)}</TableCell>
                  <TableCell>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="border border-white cursor-pointer"
                      onClick={() => handleDelete(alert.id)}
                      disabled={deleteStatus[alert.id]}
                    >
                      {deleteStatus[alert.id] ? "Deleting..." : "Delete"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
