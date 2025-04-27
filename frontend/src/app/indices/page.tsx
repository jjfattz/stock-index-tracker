"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

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
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const observer = useRef<IntersectionObserver | null>(null);

  const debouncedSetSearch = useCallback(
    debounce(setDebouncedSearchTerm, 1000),
    []
  );

  useEffect(() => {
    debouncedSetSearch(searchTerm);
  }, [searchTerm, debouncedSetSearch]);

  const fetchIndices = async (
    cursor: string | null = null,
    search: string = ""
  ): Promise<ApiResponse | null> => {
    let url = "/api/indices";
    const params = new URLSearchParams();
    if (cursor) params.append("cursor", cursor);
    if (search) params.append("search", search);

    const queryString = params.toString();
    if (queryString) {
      url += `?${queryString}`;
    }

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
  };

  const loadInitialIndices = useCallback(async (search: string = "") => {
    setLoading(true);
    setError(null);
    setNextCursor(null);
    setIndices([]);
    const data = await fetchIndices(null, search);
    if (data) {
      setIndices(data.results);
      setNextCursor(data.next_url);
    }
    setLoading(false);
  }, []);

  const loadMoreIndices = useCallback(async () => {
    if (!nextCursor || loadingMore || loading) return;
    setLoadingMore(true);
    setError(null);
    const data = await fetchIndices(nextCursor, debouncedSearchTerm);
    if (data) {
      setIndices((prevIndices) => [...prevIndices, ...data.results]);
      setNextCursor(data.next_url);
    }
    setLoadingMore(false);
  }, [nextCursor, loadingMore, loading, debouncedSearchTerm]);

  const lastIndexElementRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (loading || loadingMore) return;
      if (observer.current) observer.current.disconnect();

      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && nextCursor) {
          loadMoreIndices();
        }
      });

      if (node) observer.current.observe(node);
    },
    [loading, loadingMore, nextCursor, loadMoreIndices]
  );

  useEffect(() => {
    if (!authLoading && user) {
      loadInitialIndices(debouncedSearchTerm);
    } else if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router, loadInitialIndices, debouncedSearchTerm]);

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

  if (loading && indices.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading indices...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-500">
        Error loading indices: {error.replace(/I:/g, "")}
      </div>
    );
  }

  const parseTicker = (ticker: string) => {
    if (ticker.startsWith("I:")) {
      return ticker.substring(2);
    }
    if (ticker.startsWith("I%3A")) {
      return ticker.substring(4); // Remove "I%3A"
    }
    return ticker;
  };

  return (
    <div className="container mx-auto p-4">
      <div className="mb-4 flex justify-between items-center">
        <Link href="/">
          <span className="text-blue-500 hover:underline">
            &larr; Back to Dashboard
          </span>
        </Link>
      </div>
      <h1 className="text-3xl font-bold mb-4">Stock Indices</h1>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Search indices by ticker or name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {indices.map((index, idx) => {
          const isLastElement = indices.length === idx + 1;
          return (
            <Link href={`/indices/${index.ticker}`} key={index.ticker}>
              <div
                ref={isLastElement ? lastIndexElementRef : null}
                className="block p-4 border rounded shadow hover:bg-gray-100 cursor-pointer"
              >
                <h2 className="text-xl font-semibold">
                  {parseTicker(index.ticker)}
                </h2>
                <p className="text-gray-600">{index.name}</p>
              </div>
            </Link>
          );
        })}
      </div>
      {loadingMore && <div className="text-center py-4">Loading more...</div>}
      {!loadingMore && !nextCursor && indices.length > 0 && (
        <div className="text-center py-4 text-gray-500">End of list.</div>
      )}
      {indices.length === 0 && !loading && !error && (
        <p>No indices found matching your criteria.</p>
      )}
    </div>
  );
}
