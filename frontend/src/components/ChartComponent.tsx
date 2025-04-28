"use client";

import React, { useEffect, useRef } from "react";
import {
  createChart,
  ColorType,
  CandlestickData,
  LineData,
  Time,
  LineStyle,
  CrosshairMode,
  IChartApi,
  CandlestickSeries,
  LineSeries,
  LineWidth,
} from "lightweight-charts";
import { Button } from "@/components/ui/button";

interface ChartComponentProps {
  data: CandlestickData<Time>[] | LineData<Time>[];
  chartType?: "candlestick" | "line";
  height?: number;
  showTooltip?: boolean;
  showLegend?: boolean;
  ticker?: string;
  indexName?: string | null;
  isUserLoggedIn?: boolean;
  isWatchlisted?: boolean;
  watchlistLoading?: boolean;
  watchlistCount?: number;
  onAddToWatchlist?: () => void;
  onRemoveFromWatchlist?: () => void;
}

const ChartComponent: React.FC<ChartComponentProps> = ({
  data,
  chartType = "candlestick",
  height,
  showTooltip = true,
  showLegend = true,
  ticker,
  indexName,
  isUserLoggedIn = false,
  isWatchlisted = false,
  watchlistLoading = false,
  watchlistCount = 0,
  onAddToWatchlist = () => {},
  onRemoveFromWatchlist = () => {},
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (!chartContainerRef.current || data.length === 0) {
      return;
    }

    const chartHeight = height ?? Math.round(window.innerHeight * 0.6);

    const handleResize = () => {
      if (chartInstanceRef.current && chartContainerRef.current) {
        chartInstanceRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartHeight,
        });
      }
    };

    const chartOptions = {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#333",
      },
      grid: {
        vertLines: { color: "#e1e1e1", visible: showLegend },
        horzLines: { color: "#e1e1e1", visible: showLegend },
      },
      width: chartContainerRef.current.clientWidth,
      height: chartHeight,
      timeScale: {
        visible: showLegend,
        borderVisible: showLegend,
      },
      rightPriceScale: {
        visible: showLegend,
        borderVisible: showLegend,
      },
      crosshair: {
        mode: showTooltip ? CrosshairMode.Normal : CrosshairMode.Hidden,
      },
      handleScroll: showLegend,
      handleScale: showLegend,
    };

    const chart: IChartApi = createChart(
      chartContainerRef.current,
      chartOptions
    );
    chartInstanceRef.current = chart;

    if (chartType === "candlestick") {
      const seriesOptions = {
        upColor: "#26a69a",
        downColor: "#ef5350",
        borderVisible: false,
        wickUpColor: "#26a69a",
        wickDownColor: "#ef5350",
      };
      const candlestickSeries = chart.addSeries(
        CandlestickSeries,
        seriesOptions
      );
      candlestickSeries.setData(data as CandlestickData<Time>[]);
    } else if (chartType === "line") {
      const seriesOptions = {
        color: "#2962FF",
        lineWidth: 2 as LineWidth,
        lineStyle: LineStyle.Solid,
        lastValueVisible: false,
        priceLineVisible: false,
      };
      const lineSeries = chart.addSeries(LineSeries, seriesOptions);
      lineSeries.setData(data as LineData<Time>[]);
    }

    chart.timeScale().fitContent();

    if (height === undefined) {
      window.addEventListener("resize", handleResize);
    }

    return () => {
      if (height === undefined) {
        window.removeEventListener("resize", handleResize);
      }
      if (chartInstanceRef.current) {
        chartInstanceRef.current.remove();
        chartInstanceRef.current = null;
      }
    };
  }, [data, chartType, height, showTooltip, showLegend]);

  return (
    <div className="w-full h-full">
      {showLegend && (
        <div className="flex justify-between items-center mb-4">
          <div>
            {ticker && (
              <h2 className="text-2xl font-semibold">{ticker} - Daily Chart</h2>
            )}
            {indexName && (
              <h3 className="text-lg text-gray-600">{indexName}</h3>
            )}
          </div>
          {isUserLoggedIn && ticker && (
            <div>
              {watchlistLoading ? (
                <Button variant="secondary" disabled>
                  Loading...
                </Button>
              ) : isWatchlisted ? (
                <Button
                  onClick={onRemoveFromWatchlist}
                  variant="destructive"
                  className="cursor-pointer px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded"
                >
                  Remove from Watch List
                </Button>
              ) : (watchlistCount ?? 0) < 6 ? (
                <Button
                  onClick={onAddToWatchlist}
                  variant="default"
                  className="cursor-pointer px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded"
                >
                  Add to Watch List
                </Button>
              ) : (
                <Button variant="secondary" disabled>
                  Watchlist Full (Max 6)
                </Button>
              )}
            </div>
          )}
        </div>
      )}
      <div
        ref={chartContainerRef}
        className={`w-full h-full ${showLegend ? "border rounded shadow" : ""}`}
      />
    </div>
  );
};

export default ChartComponent;
