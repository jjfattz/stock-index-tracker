"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface IndexTicker {
  ticker: string;
  name: string;
}

export default function IndicesPage() {
  const [indices, setIndices] = useState<IndexTicker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchIndices = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/indices");
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setIndices(data);
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("An unexpected error occurred while fetching indices.");
        }
        console.error("Error fetching indices:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchIndices();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading indices...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-500">
        Error loading indices: {error}
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Stock Indices</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {indices.length > 0 ? (
          indices.map((index) => (
            <Link href={`/indices/${index.ticker}`} key={index.ticker}>
              <div className="block p-4 border rounded shadow hover:bg-gray-100 cursor-pointer">
                <h2 className="text-xl font-semibold">{index.ticker}</h2>
                <p className="text-gray-600">{index.name}</p>
              </div>
            </Link>
          ))
        ) : (
          <p>No indices found.</p>
        )}
      </div>
    </div>
  );
}
