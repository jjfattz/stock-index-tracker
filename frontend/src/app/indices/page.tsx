"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
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
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasErrorOccurred, setHasErrorOccurred] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const observer = useRef<IntersectionObserver | null>(null);
  const { addToast } = useToast();

  const debouncedSetSearch = useCallback(
    debounce(setDebouncedSearchTerm, 1000),
    []
  );

  useEffect(() => {
    debouncedSetSearch(searchTerm);
  }, [searchTerm, debouncedSetSearch]);

  const fetchIndices = useCallback(
    async (
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
        setHasErrorOccurred(false);
        return data;
      } catch (err: unknown) {
        setHasErrorOccurred(true);
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("An unexpected error occurred while fetching indices.");
        }
        console.error("Error fetching indices:", err);
        return null;
      }
    },
    [addToast]
  );

  const loadInitialIndices = useCallback(
    async (search: string = "") => {
      if (hasErrorOccurred && search === debouncedSearchTerm) return;

      setLoading(true);
      setError(null);
      setHasErrorOccurred(false);
      setNextCursor(null);
      setIndices([]);
      const data = await fetchIndices(null, search);
      if (data) {
        setIndices(data.results);
        setNextCursor(data.next_url);
      }
      setLoading(false);
    },
    [fetchIndices, hasErrorOccurred, debouncedSearchTerm]
  );

  const loadMoreIndices = useCallback(async () => {
    if (!nextCursor || loadingMore || loading || hasErrorOccurred) return;
    setLoadingMore(true);
    setError(null);
    const data = await fetchIndices(nextCursor, debouncedSearchTerm);
    if (data) {
      setIndices((prevIndices) => [...prevIndices, ...data.results]);
      setNextCursor(data.next_url);
    }
    setLoadingMore(false);
  }, [
    nextCursor,
    loadingMore,
    loading,
    debouncedSearchTerm,
    fetchIndices,
    hasErrorOccurred,
  ]);

  const lastIndexElementRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (loading || loadingMore || hasErrorOccurred) return;
      if (observer.current) observer.current.disconnect();

      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && nextCursor) {
          loadMoreIndices();
        }
      });

      if (node) observer.current.observe(node);
    },
    [loading, loadingMore, nextCursor, loadMoreIndices, hasErrorOccurred]
  );

  useEffect(() => {
    if (!authLoading && user) {
      loadInitialIndices(debouncedSearchTerm);
    } else if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router, loadInitialIndices, debouncedSearchTerm]);

  useEffect(() => {
    if (error) {
      addToast(error.replace(/I:/g, ""), "error");
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

  if (loading && indices.length === 0 && !hasErrorOccurred) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading indices...
      </div>
    );
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

  return (
    <div className="container mx-auto p-4">
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
                className="group flex items-center justify-between p-4 border rounded shadow hover:bg-gray-100 cursor-pointer h-full"
              >
                <div>
                  <h2 className="text-xl font-semibold group-hover:text-gray-900">
                    {parseTicker(index.ticker)}
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
          );
        })}
      </div>
      {loadingMore && <div className="text-center py-4">Loading more...</div>}
      {!loadingMore &&
        !nextCursor &&
        indices.length > 0 &&
        !hasErrorOccurred && (
          <div className="text-center py-4 text-gray-500">End of list.</div>
        )}
      {indices.length === 0 &&
        !loading &&
        !loadingMore &&
        !hasErrorOccurred && <p>No indices found matching your criteria.</p>}
      {hasErrorOccurred && !loading && !loadingMore && (
        <p className="text-center py-4 text-red-500">
          An error occurred. Please try searching again or refresh.
        </p>
      )}
    </div>
  );
}
