"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Category, Product, ProductImage } from "@/lib/types";

export type ProductRow = Product & {
  categories: Pick<Category, "name">;
  product_images: Pick<ProductImage, "image_url" | "sort_order">[];
};

export type ProductFilters = {
  search: string;
  /** Category id, or "all". */
  category: string;
  status: "all" | "active" | "inactive";
};

const PAGE_SIZE = 12;

function buildUrl(page: number, { search, category, status }: ProductFilters) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(PAGE_SIZE),
  });
  if (search.trim()) params.set("search", search.trim());
  if (category && category !== "all") params.set("category", category);
  if (status !== "all") params.set("status", status);
  return `/api/admin/products?${params.toString()}`;
}

/**
 * Infinite-scroll data source for the products list: one batch of
 * PAGE_SIZE items per request, appended to `items` (never replaced).
 *
 * Filter changes reset to page 1. Stale responses are dropped via a
 * monotonically increasing request id plus AbortController, and appended
 * items are deduped so fast scrolling can't insert duplicates.
 */
export function useInfiniteProducts(filters: ProductFilters) {
  const [items, setItems] = useState<ProductRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0); // last page fully loaded
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true); // first batch / filter reset
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);

  const reqIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  // Sync in-flight guard — IntersectionObserver callbacks can coalesce,
  // so a ref is needed to guarantee no duplicate requests.
  const inFlightRef = useRef(false);
  const [reloadTick, setReloadTick] = useState(0);

  const searchKey = filters.search.trim();
  const { category, status } = filters;

  // Initial load + reset whenever the filters change.
  useEffect(() => {
    const reqId = ++reqIdRef.current;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    inFlightRef.current = true;

    setLoading(true);
    setLoadingMore(false);
    setError(false);
    setHasMore(true);

    (async () => {
      try {
        const res = await fetch(
          buildUrl(1, { search: searchKey, category, status }),
          { signal: ac.signal },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = await res.json();
        if (reqId !== reqIdRef.current) return; // stale
        setItems(body.items ?? []);
        setTotal(body.total ?? 0);
        setPage(1);
        setHasMore(Boolean(body.hasMore));
      } catch {
        if (ac.signal.aborted || reqId !== reqIdRef.current) return;
        setError(true);
      } finally {
        if (reqId === reqIdRef.current) {
          setLoading(false);
          inFlightRef.current = false;
        }
      }
    })();

    return () => {
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchKey, category, status, reloadTick]);

  const loadMore = useCallback(() => {
    if (inFlightRef.current || !hasMore || page === 0) return;
    inFlightRef.current = true;
    setLoadingMore(true);
    const reqId = ++reqIdRef.current;
    const ac = new AbortController();
    abortRef.current = ac;

    (async () => {
      try {
        const res = await fetch(
          buildUrl(page + 1, { search: searchKey, category, status }),
          { signal: ac.signal },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = await res.json();
        if (reqId !== reqIdRef.current) return; // stale
        setItems((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          const fresh = (body.items ?? []).filter(
            (p: ProductRow) => !seen.has(p.id),
          );
          return [...prev, ...fresh];
        });
        setTotal(body.total ?? 0);
        setPage((p) => p + 1);
        setHasMore(Boolean(body.hasMore));
        setError(false);
      } catch {
        if (ac.signal.aborted || reqId !== reqIdRef.current) return;
        setError(true);
      } finally {
        if (reqId === reqIdRef.current) {
          setLoadingMore(false);
          inFlightRef.current = false;
        }
      }
    })();
  }, [hasMore, page, searchKey, category, status]);

  // Manual retry after a failed batch: refetch from scratch when nothing
  // is rendered yet, otherwise fetch just the failed next batch.
  const retry = useCallback(() => {
    if (inFlightRef.current) return;
    if (items.length === 0) {
      setReloadTick((t) => t + 1);
    } else {
      loadMore();
    }
  }, [items.length, loadMore]);

  // Local delete: drop the row and decrement total — no refetch, so the
  // scroll position is preserved.
  const removeLocal = useCallback((id: string) => {
    setItems((prev) => prev.filter((p) => p.id !== id));
    setTotal((t) => Math.max(0, t - 1));
  }, []);

  return {
    items,
    total,
    hasMore,
    loading,
    loadingMore,
    error,
    loadMore,
    retry,
    removeLocal,
  };
}

/** Debounce a fast-changing value (e.g. search input) for API calls. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
