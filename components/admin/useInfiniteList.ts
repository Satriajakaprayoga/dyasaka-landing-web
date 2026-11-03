"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Filter values accepted by useInfiniteList. Strings are trimmed,
 * empty strings / "all" / false / undefined are dropped, true is sent
 * as "1" — so callers can pass their raw filter state directly.
 */
export type InfiniteFilters = Record<
  string,
  string | number | boolean | undefined
>;

function normalizeFilters(
  filters: InfiniteFilters,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === false) continue;
    if (value === true) {
      out[key] = "1";
    } else if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed && trimmed !== "all") out[key] = trimmed;
    } else {
      out[key] = String(value);
    }
  }
  return out;
}

function buildUrl(
  endpoint: string,
  page: number,
  limit: number,
  filters: Record<string, string>,
) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  for (const [key, value] of Object.entries(filters)) params.set(key, value);
  return `${endpoint}?${params.toString()}`;
}

/**
 * Infinite-scroll data source for admin lists backed by a paginated
 * GET endpoint (`{ items, total, hasMore }`): one batch per request,
 * appended to `items` (never replaced).
 *
 * Filter changes reset to page 1. Stale responses are dropped via a
 * monotonically increasing request id plus AbortController, and
 * appended items are deduped so fast scrolling can't insert duplicates.
 *
 * The filters object may be an inline literal — a normalized JSON key
 * is used as the effect dependency instead of object identity.
 */
export function useInfiniteList<T extends { id: string }>(
  endpoint: string,
  filters: InfiniteFilters,
  pageSize = 12,
) {
  const [items, setItems] = useState<T[]>([]);
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

  const filterKey = JSON.stringify(normalizeFilters(filters));

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
          buildUrl(endpoint, 1, pageSize, JSON.parse(filterKey)),
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
  }, [endpoint, filterKey, pageSize, reloadTick]);

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
          buildUrl(endpoint, page + 1, pageSize, JSON.parse(filterKey)),
          { signal: ac.signal },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = await res.json();
        if (reqId !== reqIdRef.current) return; // stale
        setItems((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          const fresh = (body.items ?? []).filter(
            (p: T) => !seen.has(p.id),
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
  }, [endpoint, filterKey, hasMore, page, pageSize]);

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

  // Local patch (e.g. after a successful inline edit) — no refetch.
  const updateLocal = useCallback((id: string, patch: Partial<T>) => {
    setItems((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    );
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
    updateLocal,
  };
}

/**
 * Infinite-scroll sentinel: primary trigger via IntersectionObserver
 * (rootMargin 200px) plus a post-load catch-up — right after a batch
 * lands (or a delete thins the list) the sentinel may already be on
 * screen with no new intersection event, so re-check manually. Keeps
 * loading until the viewport is filled or data ends.
 */
export function useInfiniteSentinel({
  items,
  loading,
  loadingMore,
  error,
  hasMore,
  loadMore,
}: {
  items: unknown[];
  loading: boolean;
  loadingMore: boolean;
  error: boolean;
  hasMore: boolean;
  loadMore: () => void;
}) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !error) {
          loadMore();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore, error]);

  useEffect(() => {
    if (loading || loadingMore || error || !hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const raf = requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect();
      if (rect.top <= window.innerHeight + 200) loadMore();
    });
    return () => cancelAnimationFrame(raf);
  }, [items, loading, loadingMore, error, hasMore, loadMore]);

  return sentinelRef;
}

/**
 * Admin list view mode: phones always render cards; larger screens use
 * the persisted localStorage preference, falling back to the table.
 */
export function useAdminViewMode(storageKey: string) {
  const [viewMode, setViewMode] = useState<"table" | "card">("table");
  const [isPhone, setIsPhone] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved === "card" || saved === "table") setViewMode(saved);
    } catch {
      // storage unavailable — default to table
    }
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsPhone(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [storageKey]);

  const switchView = useCallback(
    (mode: "table" | "card") => {
      setViewMode(mode);
      try {
        localStorage.setItem(storageKey, mode);
      } catch {
        // storage unavailable — in-memory state still applies
      }
    },
    [storageKey],
  );

  const showCards = isPhone || viewMode === "card";
  return { viewMode, switchView, isPhone, showCards };
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
