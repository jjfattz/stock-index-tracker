"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { fetchWatchlistData } from "@/lib/apiClient";
import WatchlistTile from "./WatchlistTile";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";

interface WatchlistData {
  ticker: string;
  name: string;
  price: number | null;
  aggregates: any[];
  error?: string;
}

const DEFAULT_WATCHLIST = ["SPY", "QQQ", "DIA"];

const Watchlist: React.FC = () => {
  const { user } = useAuth();
  const [watchlistData, setWatchlistData] = useState<WatchlistData[]>([]);
  const [watchedTickers, setWatchedTickers] =
    useState<string[]>(DEFAULT_WATCHLIST);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadWatchlistData = useCallback(async () => {
    if (!user || watchedTickers.length === 0) {
      setWatchlistData([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchWatchlistData(watchedTickers);
      if (Array.isArray(data)) {
        setWatchlistData(data);
      } else {
        throw new Error("Invalid data format received from API");
      }
    } catch (err: any) {
      console.error("Error loading watchlist data:", err);
      setError(err.message || "Failed to load watchlist data.");
      setWatchlistData([]);
    } finally {
      setIsLoading(false);
    }
  }, [user, watchedTickers]);

  useEffect(() => {
    loadWatchlistData();
  }, [loadWatchlistData]);

  const handleRemoveTicker = (tickerToRemove: string) => {
    setWatchedTickers((prevTickers) =>
      prevTickers.filter((ticker) => ticker !== tickerToRemove)
    );
  };

  const renderSkeletons = () => {
    return Array.from({ length: watchedTickers.length }).map((_, index) => (
      <div
        key={`skeleton-${index}`}
        className="bg-card p-4 rounded-lg shadow w-full border border-border"
      >
        <div className="flex justify-between items-start mb-2">
          <div className="space-y-2">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-6 w-12" />
        </div>
        <Skeleton className="h-20 w-full" />
      </div>
    ));
  };

  return (
    <section className="mb-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold">Watch List</h2>
        {watchedTickers.length < 6 && (
          <Button asChild variant="outline">
            <Link href="/indices">Add</Link>
          </Button>
        )}
      </div>
      {error && <p className="text-destructive mb-4">{error}</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading
          ? renderSkeletons()
          : watchlistData.map((item) => (
              <WatchlistTile
                key={item.ticker}
                ticker={item.ticker}
                name={item.name}
                price={item.price}
                aggregates={item.aggregates}
                onRemove={handleRemoveTicker}
                error={item.error}
              />
            ))}
        {!isLoading && watchlistData.length === 0 && !error && (
          <p className="text-muted-foreground col-span-full text-center">
            Your watchlist is empty. Add indices from the Track Indexes page.
          </p>
        )}
      </div>
    </section>
  );
};

export default Watchlist;
