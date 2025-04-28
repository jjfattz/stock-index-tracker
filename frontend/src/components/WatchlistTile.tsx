"use client";

import React from "react";
import Link from "next/link";
import ChartComponent from "./ChartComponent";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreVertical } from "lucide-react";
import { LineData, Time } from "lightweight-charts";

interface Aggregate {
  c: number;
  h: number;
  l: number;
  n: number;
  o: number;
  t: number;
  v: number;
  vw: number;
}

interface WatchlistTileProps {
  ticker: string;
  name: string;
  price: number | null;
  aggregates: Aggregate[];
  onRemove: (ticker: string) => void;
  error?: string;
}

const WatchlistTile: React.FC<WatchlistTileProps> = ({
  ticker,
  name,
  price,
  aggregates,
  onRemove,
  error,
}) => {
  const chartData = aggregates.map((agg) => ({
    time: agg.t / 1000,
    value: agg.c,
  }));

  const formatPrice = (value: number | null) => {
    if (value === null || value === undefined) return "N/A";
    return `$${value.toFixed(2)}`;
  };

  return (
    <div className="bg-card p-4 rounded-lg shadow w-full relative border border-border">
      {error ? (
        <div className="text-destructive text-center py-8">
          <p>Error loading data for {ticker}</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      ) : (
        <>
          <div className="absolute top-2 right-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 cursor-pointer"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => onRemove(ticker)}
                  className="cursor-pointer"
                >
                  Remove from list
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <Link
            href={`/indices/${ticker}`}
            className="block group flex-grow flex flex-col"
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="text-lg font-semibold group-hover:text-primary transition-colors">
                  {ticker}
                </h3>
                <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                  {name}
                </p>
              </div>
              <p className="text-lg font-bold pr-8">{formatPrice(price)}</p>
            </div>
            <div className="h-20 w-full mt-auto overflow-hidden">
              <ChartComponent
                data={chartData as LineData<Time>[]}
                chartType="line"
                height={80}
                showTooltip={false}
                showLegend={false}
              />
            </div>
          </Link>
        </>
      )}
    </div>
  );
};

export default WatchlistTile;
