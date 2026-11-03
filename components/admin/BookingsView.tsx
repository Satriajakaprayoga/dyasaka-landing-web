"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { BookingStatus } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import BookingsTable, {
  bookingStatusOptions,
  type BookingRow,
} from "./BookingsTable";
import BookingCardList from "./BookingCardList";
import {
  useAdminViewMode,
  useDebouncedValue,
  useInfiniteList,
  useInfiniteSentinel,
} from "./useInfiniteList";
import { usePersistentFilters } from "./usePersistentFilters";
import ConfirmModal, { ModalLinkRow } from "./ConfirmModal";
import { Card, EmptyState, btnSecondary, formatDate, inputClass } from "./ui";
import { ProductCardsSkeleton, ProductTableRowsSkeleton } from "./skeletons";
import { GridViewIcon, TableIcon } from "./icons";

type Impact = { blocked: boolean; lines: { text: string; danger: boolean }[] };

const statusFilterOptions = [
  { value: "all", label: "Semua Status" },
  ...bookingStatusOptions,
];

const VIEW_MODE_KEY = "bookingViewMode";

/**
 * Bookings list container: owns filter state, the infinite-scroll data
 * source, view switching (phone = cards, larger screens = persisted
 * table/card preference) and the shared status/delete flows. The
 * table and card views are presentation-only.
 */
export default function BookingsView() {
  // ---------- filters (persisted across navigation, shared by both views) ----------
  const [filters, setFilter, resetFilters] = usePersistentFilters<{
    q: string;
    status: string;
    period: string;
  }>("admin-bookings-filters", { q: "", status: "all", period: "all" });

  const debouncedQ = useDebouncedValue(filters.q, 350);
  const status =
    bookingStatusOptions.some((s) => s.value === filters.status)
      ? (filters.status as BookingStatus)
      : "all";
  const period =
    filters.period === "upcoming" || filters.period === "past"
      ? filters.period
      : "all";

  const list = useInfiniteList<BookingRow>(
    "/api/admin/bookings",
    { search: debouncedQ, status, period },
    12,
  );

  // ---------- view mode ----------
  // Phones always get cards; larger screens use the persisted preference
  // (localStorage "bookingViewMode"), falling back to the table.
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
  }, [debouncedQ, filters.status, filters.period]);

  // ---------- inline status editing ----------
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  async function handleStatusChange(b: BookingRow, next: BookingStatus) {
    setStatusBusyId(b.id);
    setStatusError(null);

    const res = await fetch("/api/admin/bookings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: b.id, status: next }),
    });
    setStatusBusyId(null);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setStatusError(body.error ?? "Gagal mengubah status");
      return;
    }

    // Update the row in place — the capacity/trigger side effects are
    // date-level and don't change this list's rows.
    list.updateLocal(b.id, { status: next });
  }

  // ---------- shared delete flow (with impact check) ----------
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmRow, setConfirmRow] = useState<BookingRow | null>(null);
  const [impact, setImpact] = useState<Impact | null>(null);

  function closeConfirm() {
    setConfirmRow(null);
    setImpact(null);
  }

  // Deleting a booking cascades to booking_items + checklist_items and
  // the capacity trigger recalculates the event date afterwards.
  async function computeImpact(b: BookingRow): Promise<Impact> {
    const [items, checklist] = await Promise.all([
      supabase
        .from("booking_items")
        .select("id", { count: "exact", head: true })
        .eq("booking_id", b.id),
      supabase
        .from("checklist_items")
        .select("id", { count: "exact", head: true })
        .eq("booking_id", b.id),
    ]);

    const lines: Impact["lines"] = [];
    if ((items.count ?? 0) > 0) {
      lines.push({
        text: `${items.count} item booking akan ikut terhapus.`,
        danger: false,
      });
    }
    if ((checklist.count ?? 0) > 0) {
      lines.push({
        text: `${checklist.count} baris checklist akan ikut terhapus.`,
        danger: false,
      });
    }
    if (b.status === "confirmed") {
      lines.push({
        text: "Booking confirmed — ketersediaan tanggal acara akan dihitung ulang.",
        danger: false,
      });
    }
    if (lines.length === 0) {
      lines.push({
        text: "Tidak ada data terkait — aman untuk dihapus.",
        danger: false,
      });
    }
    return { blocked: false, lines };
  }

  async function handleDeleteClick(b: BookingRow) {
    setConfirmRow(b);
    setImpact(null);
    setImpact(await computeImpact(b));
  }

  async function performDelete() {
    if (!confirmRow) return;

    setDeletingId(confirmRow.id);
    setDeleteError(null);

    const res = await fetch(`/api/admin/bookings?id=${confirmRow.id}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      closeConfirm();
      setDeletingId(null);
      setDeleteError(body.error ?? "Gagal menghapus booking");
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
  const hasFilters =
    filters.q.trim() !== "" ||
    filters.status !== "all" ||
    filters.period !== "all";

  const counter = list.loading
    ? "Memuat…"
    : `${list.items.length} dari ${list.total} booking`;

  return (
    <div className="space-y-3">
      {(deleteError || statusError) && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {deleteError ?? statusError}
        </p>
      )}

      {/* Toolbar (shared by both views) */}
      <div className="space-y-2 md:space-y-0 md:flex md:flex-wrap md:items-center md:gap-2">
        <div className="w-full md:w-64">
          <input
            type="search"
            placeholder="Cari customer, telepon, tema…"
            value={filters.q}
            onChange={(e) => setFilter({ q: e.target.value })}
            className={inputClass}
            aria-label="Cari booking"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 md:contents">
          <div className="md:w-40">
            <select
              value={filters.status}
              onChange={(e) => setFilter({ status: e.target.value })}
              className={inputClass}
              aria-label="Filter status booking"
            >
              {statusFilterOptions.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="md:w-40">
            <select
              value={filters.period}
              onChange={(e) => setFilter({ period: e.target.value })}
              className={inputClass}
              aria-label="Filter periode acara"
            >
              <option value="all">Semua Periode</option>
              <option value="upcoming">Akan Datang</option>
              <option value="past">Sudah Lewat</option>
            </select>
          </div>
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
              title="Tidak ada booking yang cocok"
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
              title="Belum ada booking"
              subtitle="Catat booking pertama Anda untuk mulai mengelola jadwal."
            >
              <Link
                href="/admin/bookings/new"
                className="text-sm font-medium text-gray-900 underline underline-offset-4"
              >
                Tambah Booking
              </Link>
            </EmptyState>
          )}
        </Card>
      ) : showCards ? (
        <BookingCardList
          items={list.items}
          deletingId={deletingId}
          statusBusyId={statusBusyId}
          loadingMore={list.loadingMore}
          onStatusChange={handleStatusChange}
          onDelete={handleDeleteClick}
        />
      ) : (
        <BookingsTable
          items={list.items}
          deletingId={deletingId}
          statusBusyId={statusBusyId}
          loadingMore={list.loadingMore}
          onStatusChange={handleStatusChange}
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
          Semua booking sudah ditampilkan
        </p>
      )}

      <ConfirmModal
        open={confirmRow !== null}
        title={
          confirmRow
            ? `Hapus booking ${confirmRow.customer_name} (${formatDate(confirmRow.event_date)})?`
            : ""
        }
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
            {confirmRow && (
              <ModalLinkRow
                href={`/admin/bookings/${confirmRow.id}`}
                main="Lihat detail booking"
                sub={confirmRow.products?.name ?? "Custom"}
              />
            )}
          </>
        )}
      </ConfirmModal>
    </div>
  );
}
