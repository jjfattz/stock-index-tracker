"use client";

import React, { useEffect, useRef } from "react";
import {
  createChart,
  ColorType,
  CandlestickData,
  Time,
  CandlestickSeries,
} from "lightweight-charts";

interface ChartComponentProps {
  data: CandlestickData<Time>[];
  ticker: string;
}

const ChartComponent: React.FC<ChartComponentProps> = ({ data, ticker }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartContainerRef.current || data.length === 0) {
      return;
    }

    const handleResize = () => {
      chart.applyOptions({ width: chartContainerRef.current!.clientWidth });
    };

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#ffffff" },
        textColor: "#333",
      },
      grid: {
        vertLines: { color: "#e1e1e1" },
        horzLines: { color: "#e1e1e1" },
      },
      width: chartContainerRef.current.clientWidth,
      height: 400,
    });

    const seriesOptions = {
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderVisible: false,
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
    };

    const candlestickSeries = chart.addSeries(CandlestickSeries, seriesOptions);

    candlestickSeries.setData(data);

    chart.timeScale().fitContent();

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [data, ticker]);

  return (
    <div className="w-full">
      <h2 className="text-2xl font-semibold mb-4">
        {ticker} - Daily Chart (60 Days)
      </h2>
      <div ref={chartContainerRef} className="border rounded shadow" />
    </div>
  );
};

export default ChartComponent;
