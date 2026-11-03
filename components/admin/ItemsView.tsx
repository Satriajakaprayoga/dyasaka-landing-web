"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import ItemsTable, { type ItemRow } from "./ItemsTable";
import ItemCardList from "./ItemCardList";
import {
  useAdminViewMode,
  useDebouncedValue,
  useInfiniteList,
  useInfiniteSentinel,
} from "./useInfiniteList";
import { usePersistentFilters } from "./usePersistentFilters";
import ConfirmModal, {
  ImpactBookingList,
  ImpactProductList,
  type ImpactBookingRef,
  type ImpactProductRef,
} from "./ConfirmModal";
import { Card, EmptyState, btnSecondary, inputClass } from "./ui";
import { ProductCardsSkeleton, ProductTableRowsSkeleton } from "./skeletons";
import { GridViewIcon, TableIcon } from "./icons";

type Impact = {
  blocked: boolean;
  lines: { text: string; danger: boolean }[];
  bookingRefs: ImpactBookingRef[];
  productRefs: ImpactProductRef[];
};

const VIEW_MODE_KEY = "itemViewMode";

/**
 * Items list container: owns filter state, the infinite-scroll data
 * source, view switching (phone = cards, larger screens = persisted
 * table/card preference) and the shared delete flow. The table and
 * card views are presentation-only.
 */
export default function ItemsView() {
  // ---------- filters (persisted across navigation, shared by both views) ----------
  const [filters, setFilter, resetFilters] = usePersistentFilters<{
    q: string;
    type: string;
    low: boolean;
  }>("admin-items-filters", { q: "", type: "all", low: false });

  const debouncedQ = useDebouncedValue(filters.q, 350);
  const type =
    filters.type === "consumable" || filters.type === "rentable"
      ? filters.type
      : "all";
  const low = Boolean(filters.low);

  const list = useInfiniteList<ItemRow>(
    "/api/admin/items",
    { search: debouncedQ, type, low },
    12,
  );

  // ---------- view mode ----------
  // Phones always get cards; larger screens use the persisted preference
  // (localStorage "itemViewMode"), falling back to the table.
  const { viewMode, switchView, showCards } = useAdminViewMode(VIEW_MODE_KEY);

  // Filter changes restart from batch 1 — scroll back to the top
  // (skipped on the initial mount).
  const firstFilterRun = useRef(true);
  useEffect(() => {
    if (firstFilterRun.current) {
      firstFilterRun.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
  }, [debouncedQ, filters.type, filters.low]);

  // ---------- shared delete flow (with impact check) ----------
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmRow, setConfirmRow] = useState<ItemRow | null>(null);
  const [impact, setImpact] = useState<Impact | null>(null);

  function closeConfirm() {
    setConfirmRow(null);
    setImpact(null);
  }

  // items → item_variants is ON DELETE CASCADE, but each variant is
  // RESTRICT-referenced by four tables: price history, stock movements,
  // product recipes, and booking items — any of them blocks the delete.
  // Referencing bookings/products are fetched so the modal can link to
  // them for inspection before the admin decides.
  async function computeImpact(item: ItemRow): Promise<Impact> {
    const variantIds = item.item_variants.map((v) => v.id);
    const lines: Impact["lines"] = [];

    if (variantIds.length === 0) {
      return {
        blocked: false,
        lines: [{ text: "Item tanpa varian — aman untuk dihapus.", danger: false }],
        bookingRefs: [],
        productRefs: [],
      };
    }

    const [priceHistory, movements, recipeRows, bookingItemRows] =
      await Promise.all([
        supabase
          .from("item_price_history")
          .select("id", { count: "exact", head: true })
          .in("item_variant_id", variantIds),
        supabase
          .from("stock_movements")
          .select("id", { count: "exact", head: true })
          .in("item_variant_id", variantIds),
        supabase
          .from("product_items")
          .select("product_id, products(id, name)")
          .in("item_variant_id", variantIds),
        supabase
          .from("booking_items")
          .select("booking_id, bookings(customer_name, event_date)")
          .in("item_variant_id", variantIds),
      ]);

    // Child→parent embeds come back as objects; dedupe by parent id.
    const productMap = new Map<string, string>();
    for (const row of (recipeRows.data ?? []) as unknown as {
      products: { id: string; name: string } | null;
    }[]) {
      if (row.products) productMap.set(row.products.id, row.products.name);
    }
    const productRefs: ImpactProductRef[] = [...productMap.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const bookingMap = new Map<string, { customer_name: string; event_date: string }>();
    for (const row of (bookingItemRows.data ?? []) as unknown as {
      booking_id: string;
      bookings: { customer_name: string; event_date: string } | null;
    }[]) {
      if (row.bookings) bookingMap.set(row.booking_id, row.bookings);
    }
    const bookingRefs: ImpactBookingRef[] = [...bookingMap.entries()]
      .map(([id, b]) => ({ id, ...b }))
      .sort((a, b) => a.event_date.localeCompare(b.event_date));

    const blockers: string[] = [];
    if ((movements.count ?? 0) > 0)
      blockers.push(`${movements.count} pergerakan stok`);
    if ((priceHistory.count ?? 0) > 0)
      blockers.push(`${priceHistory.count} riwayat harga`);
    if (productRefs.length > 0)
      blockers.push(`${(recipeRows.data ?? []).length} baris resep produk`);
    if ((bookingItemRows.data ?? []).length > 0)
      blockers.push(`${(bookingItemRows.data ?? []).length} item booking`);

    const blocked = blockers.length > 0;
    if (blocked) {
      lines.push({
        text: `Varian masih dipakai (${blockers.join(", ")}) — item tidak dapat dihapus.`,
        danger: true,
      });
    }
    lines.push({
      text: `${variantIds.length} varian (beserta stoknya) akan ikut terhapus.`,
      danger: false,
    });
    return { blocked, lines, bookingRefs, productRefs };
  }

  async function handleDeleteClick(item: ItemRow) {
    setConfirmRow(item);
    setImpact(null);
    setImpact(await computeImpact(item));
  }

  async function performDelete() {
    if (!confirmRow) return;

    setDeletingId(confirmRow.id);
    setDeleteError(null);

    const res = await fetch(`/api/admin/items?id=${confirmRow.id}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      closeConfirm();
      setDeletingId(null);
      setDeleteError(body.error ?? "Gagal menghapus item");
      return;
    }

    // Local removal keeps the scroll position; if the remaining items
    // can't fill the screen, the sentinel effect below fetches the next
    // batch automatically.
    list.removeLocal(confirmRow.id);
    closeConfirm();
    setDeletingId(null);
  }

  // ---------- infinite scroll sentinel ----------
  // IntersectionObserver trigger + post-load catch-up (see the hook).
  const sentinelRef = useInfiniteSentinel({
    items: list.items,
    loading: list.loading,
    loadingMore: list.loadingMore,
    error: list.error,
    hasMore: list.hasMore,
    loadMore: list.loadMore,
  });

  // ---------- render ----------
  const hasFilters = filters.q.trim() !== "" || type !== "all" || low;

  const counter = list.loading
    ? "Memuat…"
    : `${list.items.length} dari ${list.total} item`;

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
            placeholder="Cari nama, kategori, varian…"
            value={filters.q}
            onChange={(e) => setFilter({ q: e.target.value })}
            className={inputClass}
            aria-label="Cari item"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 md:contents">
          <div className="md:w-40">
            <select
              value={filters.type}
              onChange={(e) => setFilter({ type: e.target.value })}
              className={inputClass}
              aria-label="Filter tipe item"
            >
              <option value="all">Semua Tipe</option>
              <option value="consumable">Habis Pakai</option>
              <option value="rentable">Sewa</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={low}
              onChange={(e) => setFilter({ low: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
            />
            Hanya stok rendah
          </label>
        </div>
        <div className="flex items-center gap-2 md:ml-auto">
          <span className="text-xs text-gray-400">{counter}</span>
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
              title="Tidak ada item yang cocok"
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
              title="Belum ada item"
              subtitle="Item adalah komponen penyusun paket — balon, stand, dll."
            >
              <Link
                href="/admin/items/new"
                className="text-sm font-medium text-gray-900 underline underline-offset-4"
              >
                Tambah Item
              </Link>
            </EmptyState>
          )}
        </Card>
      ) : showCards ? (
        <ItemCardList
          items={list.items}
          deletingId={deletingId}
          loadingMore={list.loadingMore}
          onDelete={handleDeleteClick}
        />
      ) : (
        <ItemsTable
          items={list.items}
          deletingId={deletingId}
          loadingMore={list.loadingMore}
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
          Semua item sudah ditampilkan
        </p>
      )}

      <ConfirmModal
        open={confirmRow !== null}
        title={confirmRow ? `Hapus item "${confirmRow.name}"?` : ""}
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
                  line.danger
                    ? "font-medium text-red-600"
                    : "text-gray-600"
                }
              >
                {line.text}
              </p>
            ))}
            {impact.bookingRefs.length > 0 && (
              <>
                <p className="pt-1 text-xs font-medium uppercase tracking-wide text-gray-400">
                  Dipakai di booking — klik untuk memeriksa
                </p>
                <ImpactBookingList bookings={impact.bookingRefs} />
              </>
            )}
            {impact.productRefs.length > 0 && (
              <>
                <p className="pt-1 text-xs font-medium uppercase tracking-wide text-gray-400">
                  Dipakai di resep produk — klik untuk memeriksa
                </p>
                <ImpactProductList products={impact.productRefs} />
              </>
            )}
          </>
        )}
      </ConfirmModal>
    </div>
  );
}
