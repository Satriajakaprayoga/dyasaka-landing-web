"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

export type FilterValue = string | boolean;

/**
 * Filter state that survives navigation.
 *
 * Priority on mount:
 *   1. URL search params  (shareable links, browser back/forward)
 *   2. sessionStorage mirror (returning to the feature from another page)
 *   3. defaults
 *
 * Updates hit state instantly, are mirrored to sessionStorage immediately,
 * and are pushed to the URL with a short debounce via history.replaceState
 * (no router navigation, no scroll jump).
 */
export function usePersistentFilters<T extends Record<string, FilterValue>>(
  storageKey: string,
  defaults: T,
) {
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<T>(() => {
    const init = { ...defaults } as Record<string, FilterValue>;
    for (const key of Object.keys(defaults)) {
      const value = searchParams.get(key);
      if (value !== null) {
        init[key] =
          typeof defaults[key] === "boolean" ? value === "true" : value;
      }
    }
    return init as T;
  });

  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const urlTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const syncUrl = useCallback((next: T) => {
    if (urlTimer.current) clearTimeout(urlTimer.current);
    urlTimer.current = setTimeout(() => {
      const params = new URLSearchParams();
      for (const key of Object.keys(defaults)) {
        if (next[key] !== defaults[key]) params.set(key, String(next[key]));
      }
      const qs = params.toString();
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`,
      );
    }, 400);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setFilter = useCallback(
    (patch: Partial<T>) => {
      const next = { ...filtersRef.current, ...patch };
      filtersRef.current = next;
      setFilters(next);
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // storage unavailable — URL sync still applies
      }
      syncUrl(next);
    },
    [storageKey, syncUrl],
  );

  const resetFilters = useCallback(() => {
    if (urlTimer.current) clearTimeout(urlTimer.current);
    setFilters({ ...defaults });
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.hash}`,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Session fallback: only when the URL carries no filter params at all.
  useEffect(() => {
    const hasUrlState = Object.keys(defaults).some(
      (key) => searchParams.get(key) !== null,
    );
    if (hasUrlState) return;
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as Record<string, FilterValue>;
      if (!saved || typeof saved !== "object") return;
      const restored = { ...filtersRef.current } as Record<string, FilterValue>;
      for (const key of Object.keys(defaults)) {
        if (key in saved) restored[key] = saved[key];
      }
      setFilters(restored as T);
    } catch {
      // corrupted storage — start from defaults
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (urlTimer.current) clearTimeout(urlTimer.current);
    };
  }, []);

  return [filters, setFilter, resetFilters] as const;
}
