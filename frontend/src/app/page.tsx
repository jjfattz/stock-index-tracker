"use client";

import React from "react";
import Watchlist from "@/components/Watchlist";
import RecentAlerts from "@/components/RecentAlerts";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function Home() {
  return (
    <ProtectedRoute>
      <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-8">
        <Watchlist />
        <RecentAlerts />
      </div>
    </ProtectedRoute>
  );
}
