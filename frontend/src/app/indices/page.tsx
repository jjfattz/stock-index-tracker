"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useToast } from "@/context/ToastContext";

interface IndexTicker {
  ticker: string;
  name: string;
}

interface ApiResponse {
  results: IndexTicker[];
  next_url: string | null;
}

const debounce = <F extends (...args: any[]) => any>(
  func: F,
  waitFor: number
) => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<F>): Promise<ReturnType<F>> =>
    new Promise((resolve) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => resolve(func(...args)), waitFor);
    });
};

export default function IndicesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [indices, setIndices] = useState<IndexTicker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredIndices, setFilteredIndices] = useState<IndexTicker[]>([]);
  const { addToast } = useToast();

  const debouncedSetSearch = useCallback(debounce(setSearchTerm, 500), []);

  useEffect(() => {
    debouncedSetSearch(searchTerm);
  }, [searchTerm, debouncedSetSearch]);

  const fetchIndices = useCallback(async (): Promise<ApiResponse | null> => {
    const url = "/api/indices";

    try {
      const response = await fetch(url);
      if (!response.ok) {
        const errorText = await response.text();
        if (
          response.status === 403 ||
          response.status === 429 ||
          response.status === 503
        ) {
          throw new Error(
            errorText || `HTTP error! status: ${response.status}`
          );
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: ApiResponse = await response.json();
      if (!Array.isArray(data.results)) {
        throw new Error("Invalid data format received from API.");
      }
      return data;
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred while fetching indices.");
      }
      console.error("Error fetching indices:", err);
      return null;
    }
  }, [addToast]);

  const loadInitialIndices = useCallback(async () => {
    setLoading(true);
    setError(null);
    setIndices([]);
    const data = await fetchIndices();
    if (data) {
      setIndices(data.results);
      setFilteredIndices(data.results);
    }
    setLoading(false);
  }, [fetchIndices]);

  useEffect(() => {
    if (!indices) return;
    const lowerSearchTerm = searchTerm.toLowerCase();
    const filtered = indices.filter(
      (index) =>
        index.ticker.toLowerCase().includes(lowerSearchTerm) ||
        index.name.toLowerCase().includes(lowerSearchTerm)
    );
    setFilteredIndices(filtered);
  }, [searchTerm, indices]);

  useEffect(() => {
    if (!authLoading && user) {
      loadInitialIndices();
    } else if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router, loadInitialIndices]);

  useEffect(() => {
    if (error) {
      addToast(error, "error");
    }
  }, [error, addToast]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Authenticating...
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (loading && !error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading indices...
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-4">Stock Indices</h1>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Search indices by ticker or name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-100 placeholder-gray-500 leading-tight focus:outline-none focus:shadow-outline"
          autoFocus
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredIndices.map((index) => (
          <Link href={`/indices/${index.ticker}`} key={index.ticker}>
            <div className="group flex items-center justify-between p-4 border rounded shadow hover:bg-gray-100 cursor-pointer h-full">
              <div>
                <h2 className="text-xl font-semibold group-hover:text-gray-900">
                  {index.ticker}
                </h2>
                <p className="text-gray-600">{index.name}</p>
              </div>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-6 h-6 text-gray-400"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m8.25 4.5 7.5 7.5-7.5 7.5"
                />
              </svg>
            </div>
          </Link>
        ))}
      </div>

      {filteredIndices.length === 0 && !loading && !error && (
        <p className="text-center py-4">
          No indices found matching your criteria.
        </p>
      )}
      {error && !loading && (
        <p className="text-center py-4 text-red-500">
          An error occurred: {error}. Please try refreshing.
        </p>
      )}
    </div>
  );
}
