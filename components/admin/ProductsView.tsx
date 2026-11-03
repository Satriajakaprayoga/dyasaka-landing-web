"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Category } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import ProductsTable from "./ProductsTable";
import ProductCardList from "./ProductCardList";
import {
  useInfiniteProducts,
  useDebouncedValue,
  type ProductRow,
} from "./useInfiniteProducts";
import { usePersistentFilters } from "./usePersistentFilters";
import ConfirmModal, {
  ImpactBookingList,
  type ImpactBookingRef,
} from "./ConfirmModal";
import { Card, EmptyState, btnSecondary, inputClass } from "./ui";
import { ProductCardsSkeleton, ProductTableRowsSkeleton } from "./skeletons";
import { GridViewIcon, TableIcon } from "./icons";

type Impact = {
  blocked: boolean;
  lines: { text: string; danger: boolean }[];
  bookings: ImpactBookingRef[];
};

const statusFilterOptions = [
  { value: "all", label: "Semua Status" },
  { value: "active", label: "Aktif" },
  { value: "inactive", label: "Nonaktif" },
] as const;

const VIEW_MODE_KEY = "productViewMode";

/**
 * Products list container: owns filter state, the infinite-scroll data
 * source, view switching (phone = cards, larger screens = persisted
 * table/card preference) and the shared add/edit/delete flows. The
 * table and card views are presentation-only.
 */
export default function ProductsView() {
  const router = useRouter();

  // ---------- filters (persisted across navigation, shared by both views) ----------
  const [filters, setFilter, resetFilters] = usePersistentFilters<{
    q: string;
    cat: string;
    status: string;
  }>("admin-products-filters", { q: "", cat: "all", status: "all" });

  const debouncedQ = useDebouncedValue(filters.q, 350);
  const status =
    filters.status === "active" || filters.status === "inactive"
      ? filters.status
      : "all";

  const list = useInfiniteProducts({
    search: debouncedQ,
    category: filters.cat,
    status,
  });

  // ---------- categories for the dropdown (server filter needs ids) ----------
  const [categories, setCategories] = useState<Category[]>([]);
  useEffect(() => {
    let cancelled = false;
    supabase
      .from("categories")
      .select("id, name")
      .order("name")
      .then(({ data }) => {
        if (!cancelled) setCategories((data ?? []) as Category[]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // `cat` held a category NAME before server-side filtering existed —
  // reset stale persisted values so the select never shows a blank option.
  useEffect(() => {
    if (
      categories.length > 0 &&
      filters.cat !== "all" &&
      !categories.some((c) => c.id === filters.cat)
    ) {
      setFilter({ cat: "all" });
    }
  }, [categories, filters.cat, setFilter]);

  // ---------- view mode ----------
  // Phones always get cards; larger screens use the persisted preference
  // (localStorage "productViewMode"), falling back to the table.
  const [viewMode, setViewMode] = useState<"table" | "card">("table");
  const [isPhone, setIsPhone] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_MODE_KEY);
      if (saved === "card" || saved === "table") setViewMode(saved);
    } catch {
      // storage unavailable — default to table
    }
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsPhone(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const switchView = useCallback((mode: "table" | "card") => {
    setViewMode(mode);
    try {
      localStorage.setItem(VIEW_MODE_KEY, mode);
    } catch {
      // storage unavailable — in-memory state still applies
    }
  }, []);

  const showCards = isPhone || viewMode === "card";

  // Filter changes restart from batch 1 — scroll back to the top
  // (skipped on the initial mount).
  const firstFilterRun = useRef(true);
  useEffect(() => {
    if (firstFilterRun.current) {
      firstFilterRun.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
  }, [debouncedQ, filters.cat, filters.status]);

  // ---------- shared delete flow (with impact check) ----------
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmRow, setConfirmRow] = useState<ProductRow | null>(null);
  const [impact, setImpact] = useState<Impact | null>(null);

  function closeConfirm() {
    setConfirmRow(null);
    setImpact(null);
  }

  // bookings.product_id keeps its RESTRICT FK, but the BEFORE DELETE
  // trigger (20261020140000) cancels active bookings and unlinks the
  // rest before the constraint is checked — so deletion proceeds and
  // the modal lists the affected bookings as links to inspect first.
  // Photos + recipe rows cascade (storage files removed by the API).
  async function computeImpact(p: ProductRow): Promise<Impact> {
    const [bookingsRes, images, recipe] = await Promise.all([
      supabase
        .from("bookings")
        .select("id, customer_name, event_date, status")
        .eq("product_id", p.id)
        .order("event_date"),
      supabase
        .from("product_images")
        .select("id", { count: "exact", head: true })
        .eq("product_id", p.id),
      supabase
        .from("product_items")
        .select("id", { count: "exact", head: true })
        .eq("product_id", p.id),
    ]);

    const bookings = (bookingsRes.data ?? []) as unknown as ImpactBookingRef[];
    const activeFirst = [...bookings].sort((a, b) => {
      const aActive = a.status === "pending" || a.status === "confirmed" ? 0 : 1;
      const bActive = b.status === "pending" || b.status === "confirmed" ? 0 : 1;
      return aActive - bActive;
    });

    const activeCount = bookings.filter(
      (b) => b.status === "pending" || b.status === "confirmed",
    ).length;
    const finishedCount = bookings.length - activeCount;

    const lines: Impact["lines"] = [];
    if (activeCount > 0) {
      lines.push({
        text: `${activeCount} booking aktif (pending/confirmed) akan dibatalkan.`,
        danger: true,
      });
    }
    if (finishedCount > 0) {
      lines.push({
        text: `${finishedCount} booking selesai/batal tetap tersimpan, hanya lepas dari produk ini.`,
        danger: false,
      });
    }
    if ((images.count ?? 0) > 0) {
      lines.push({
        text: `${images.count} foto produk (beserta filenya di storage) akan ikut terhapus.`,
        danger: false,
      });
    }
    if ((recipe.count ?? 0) > 0) {
      lines.push({
        text: `${recipe.count} baris Isi Paket (resep) akan ikut terhapus.`,
        danger: false,
      });
    }
    if (lines.length === 0) {
      lines.push({
        text: "Tidak ada data terkait — aman untuk dihapus.",
        danger: false,
      });
    }
    return { blocked: false, lines, bookings: activeFirst };
  }

  async function handleDeleteClick(p: ProductRow) {
    setConfirmRow(p);
    setImpact(null);
    setImpact(await computeImpact(p));
  }

  async function performDelete() {
    if (!confirmRow) return;

    setDeletingId(confirmRow.id);
    setDeleteError(null);

    const res = await fetch(`/api/admin/products?id=${confirmRow.id}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      closeConfirm();
      setDeletingId(null);
      setDeleteError(body.error ?? "Gagal menghapus produk");
      return;
    }

    // Local removal keeps the scroll position; if the remaining items
    // can't fill the screen, the sentinel effect below fetches the next
    // batch automatically.
    list.removeLocal(confirmRow.id);
    closeConfirm();
    setDeletingId(null);
  }

  const onEdit = useCallback(
    (p: ProductRow) => router.push(`/admin/products/${p.id}/edit`),
    [router],
  );

  // ---------- infinite scroll sentinel ----------
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Primary trigger: load when the sentinel approaches the viewport.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !list.error) {
          list.loadMore();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [list.loadMore, list.error]);

  // Catch-up trigger: right after a batch lands (or a delete thins the
  // list) the sentinel may already be on screen with no new intersection
  // event — IntersectionObserver only fires on changes, so re-check
  // manually. Keeps loading until the viewport is filled or data ends.
  useEffect(() => {
    if (list.loading || list.loadingMore || list.error || !list.hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const raf = requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect();
      if (rect.top <= window.innerHeight + 200) list.loadMore();
    });
    return () => cancelAnimationFrame(raf);
  }, [
    list.items,
    list.loading,
    list.loadingMore,
    list.error,
    list.hasMore,
    list.loadMore,
  ]);

  // ---------- render ----------
  const hasFilters =
    filters.q.trim() !== "" || filters.cat !== "all" || filters.status !== "all";

  return (
    <div className="space-y-3">
      {deleteError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {deleteError}
        </p>
      )}

      {/* Toolbar (shared by both views) */}
      <div className="space-y-2 md:space-y-0 md:flex md:flex-wrap md:items-center md:gap-2">
        <div className="w-full md:w-64">
          <input
            type="search"
            placeholder="Cari nama / deskripsi produk…"
            value={filters.q}
            onChange={(e) => setFilter({ q: e.target.value })}
            className={inputClass}
            aria-label="Cari produk"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 md:contents">
          <div className="md:w-44">
            <select
              value={filters.cat}
              onChange={(e) => setFilter({ cat: e.target.value })}
              className={inputClass}
              aria-label="Filter kategori"
            >
              <option value="all">Semua Kategori</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="md:w-36">
            <select
              value={filters.status}
              onChange={(e) => setFilter({ status: e.target.value })}
              className={inputClass}
              aria-label="Filter status"
            >
              {statusFilterOptions.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2 md:ml-auto">
          <span className="text-xs text-gray-400">
            {list.loading ? "Memuat…" : `${list.items.length} dari ${list.total} produk`}
          </span>
          <div
            className="hidden items-center gap-0.5 rounded-lg border border-gray-200 bg-white p-0.5 md:flex"
            role="group"
            aria-label="Mode tampilan"
          >
            <button
              type="button"
              onClick={() => switchView("table")}
              aria-pressed={viewMode === "table"}
              aria-label="Tampilan tabel"
              title="Tampilan tabel"
              className={`rounded-md p-1.5 transition ${
                viewMode === "table"
                  ? "bg-gray-900 text-white"
                  : "text-gray-400 hover:text-gray-900"
              }`}
            >
              <TableIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => switchView("card")}
              aria-pressed={viewMode === "card"}
              aria-label="Tampilan kartu"
              title="Tampilan kartu"
              className={`rounded-md p-1.5 transition ${
                viewMode === "card"
                  ? "bg-gray-900 text-white"
                  : "text-gray-400 hover:text-gray-900"
              }`}
            >
              <GridViewIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {list.loading ? (
        showCards ? (
          <ProductCardsSkeleton count={6} />
        ) : (
          <ProductTableRowsSkeleton rows={8} />
        )
      ) : list.error && list.items.length === 0 ? (
        <Card className="overflow-hidden">
          <EmptyState
            title="Gagal memuat"
            subtitle="Periksa koneksi internet Anda lalu coba lagi."
          >
            <button type="button" onClick={list.retry} className={btnSecondary}>
              Coba Lagi
            </button>
          </EmptyState>
        </Card>
      ) : list.items.length === 0 ? (
        <Card className="overflow-hidden">
          {hasFilters ? (
            <EmptyState
              title="Produk tidak ditemukan"
              subtitle="Coba ubah kata kunci atau reset filter."
            >
              <button
                type="button"
                onClick={resetFilters}
                className="text-sm font-medium text-gray-900 underline underline-offset-4"
              >
                Reset Filter
              </button>
            </EmptyState>
          ) : (
            <EmptyState
              title="Belum ada produk"
              subtitle="Tambahkan produk pertama untuk melengkapi katalog."
            >
              <Link
                href="/admin/products/new"
                className="text-sm font-medium text-gray-900 underline underline-offset-4"
              >
                Tambah Produk
              </Link>
            </EmptyState>
          )}
        </Card>
      ) : showCards ? (
        <ProductCardList
          items={list.items}
          deletingId={deletingId}
          loadingMore={list.loadingMore}
          onEdit={onEdit}
          onDelete={handleDeleteClick}
        />
      ) : (
        <ProductsTable
          items={list.items}
          deletingId={deletingId}
          loadingMore={list.loadingMore}
          onEdit={onEdit}
          onDelete={handleDeleteClick}
        />
      )}

      {/* Single sentinel after the active view */}
      <div ref={sentinelRef} className="h-px w-full" aria-hidden="true" />

      {!list.loading && list.error && list.items.length > 0 && (
        <div className="flex items-center justify-center gap-3 py-2">
          <p className="text-sm text-red-600">Gagal memuat. Coba lagi</p>
          <button
            type="button"
            onClick={list.retry}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {!list.loading && !list.error && !list.hasMore && list.items.length > 0 && (
        <p className="pt-1 text-center text-xs text-gray-400">
          Semua produk sudah ditampilkan
        </p>
      )}

      <ConfirmModal
        open={confirmRow !== null}
        title={confirmRow ? `Hapus produk "${confirmRow.name}"?` : ""}
        description="Tindakan ini tidak dapat dibatalkan."
        busy={deletingId !== null}
        disabled={impact?.blocked ?? false}
        onConfirm={performDelete}
        onClose={closeConfirm}
      >
        {!impact ? (
          <p className="text-gray-500">Memeriksa relasi data…</p>
        ) : (
          <>
            {impact.lines.map((line, i) => (
              <p
                key={i}
                className={
                  line.danger ? "font-medium text-red-600" : "text-gray-600"
                }
              >
                {line.text}
              </p>
            ))}
            {impact.bookings.length > 0 && (
              <>
                <p className="pt-1 text-xs font-medium uppercase tracking-wide text-gray-400">
                  Booking terkait — klik untuk memeriksa
                </p>
                <ImpactBookingList bookings={impact.bookings} />
              </>
            )}
          </>
        )}
      </ConfirmModal>
    </div>
  );
}
